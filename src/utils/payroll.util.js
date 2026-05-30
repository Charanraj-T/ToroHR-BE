import PDFDocument from "pdfkit";
import { getEndOfDay, getStartOfDay, isWeekend, parseDateOnly } from "./date.util.js";

export const PAYROLL_STATUSES = ["Draft", "Processed", "Paid"];

export const PAID_LEAVE_TYPES = ["CL", "SL", "PL"];

const ALLOWED_TRANSITIONS = {
  Draft: ["Processed"],
  Processed: ["Paid"],
  Paid: []
};

export const validatePayrollTransition = (currentStatus, nextStatus) => {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      message: `Cannot transition payroll from "${currentStatus}" to "${nextStatus}"`
    };
  }
  return { valid: true };
};

export const roundRupee = (value) => Math.max(0, Math.round(Number(value) || 0));

export const getMonthBoundaries = (month, year) => {
  const monthIndex = month - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return { start, end, daysInMonth: end.getUTCDate() };
};

export const generatePayrollNumber = (year, month, employeeCode) => {
  const monthStr = String(month).padStart(2, "0");
  return `PS-${year}-${monthStr}-${employeeCode}`;
};

export const buildCompanyAddress = (settings) => {
  const parts = [
    settings.addressLine1,
    settings.addressLine2,
    [settings.city, settings.state].filter(Boolean).join(", "),
    [settings.country, settings.postalCode].filter(Boolean).join(" ")
  ].filter(Boolean);
  return parts.join("\n");
};

export const getEligiblePeriod = (employee, month, year) => {
  const { start: monthStart, end: monthEnd } = getMonthBoundaries(month, year);
  const joiningDate = getStartOfDay(employee.joiningDate);

  if (joiningDate > monthEnd) {
    return null;
  }

  const periodStart = joiningDate > monthStart ? joiningDate : monthStart;
  return { periodStart, periodEnd: monthEnd };
};

export const iterateDatesInRange = (startDate, endDate) => {
  const dates = [];
  const cursor = getStartOfDay(startDate);
  const end = getStartOfDay(endDate);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

export const buildHolidayDateSet = (holidays) => {
  const set = new Set();
  for (const holiday of holidays) {
    const date = getStartOfDay(holiday.date);
    set.add(date.toISOString().split("T")[0]);
  }
  return set;
};

const dateKey = (date) => getStartOfDay(date).toISOString().split("T")[0];

export const isDateInApprovedLeave = (date, approvedLeaves) => {
  const dayStart = getStartOfDay(date);
  const dayEnd = getEndOfDay(date);

  for (const leave of approvedLeaves) {
    const leaveStart = getStartOfDay(leave.fromDate);
    const leaveEnd = getStartOfDay(leave.toDate);

    if (dayStart >= leaveStart && dayStart <= leaveEnd) {
      const fraction = leave.dayType === "Half-day" ? 0.5 : 1;
      return { leaveType: leave.leaveType, fraction };
    }
  }

  return null;
};

export const computeAttendanceSnapshot = ({
  periodStart,
  periodEnd,
  holidayDateSet,
  attendanceRecords,
  approvedLeaves
}) => {
  const attendanceMap = new Map();
  for (const record of attendanceRecords) {
    attendanceMap.set(dateKey(record.date), record.status);
  }

  let workingDays = 0;
  let presentDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;
  let lopDays = 0;

  const dates = iterateDatesInRange(periodStart, periodEnd);

  for (const date of dates) {
    if (isWeekend(date)) continue;

    const key = dateKey(date);
    const isHoliday = holidayDateSet.has(key);

    if (isHoliday) {
      workingDays += 1;
      holidayDays += 1;
      continue;
    }

    workingDays += 1;
    const status = attendanceMap.get(key);
    const leaveInfo = isDateInApprovedLeave(date, approvedLeaves);

    if (leaveInfo) {
      if (PAID_LEAVE_TYPES.includes(leaveInfo.leaveType)) {
        leaveDays += leaveInfo.fraction;
      } else {
        lopDays += leaveInfo.fraction;
      }
      continue;
    }

    if (status === "Present") {
      presentDays += 1;
    } else if (status === "Half-day") {
      presentDays += 0.5;
      lopDays += 0.5;
    } else if (status === "Holiday") {
      holidayDays += 1;
    } else if (status === "Leave") {
      lopDays += 1;
    } else {
      lopDays += 1;
    }
  }

  return {
    workingDays,
    presentDays: roundRupee(presentDays * 100) / 100,
    leaveDays: roundRupee(leaveDays * 100) / 100,
    holidayDays,
    lopDays: roundRupee(lopDays * 100) / 100
  };
};

export const calculateFullTimePay = (salaryStructure, attendanceSnapshot, defaultPF) => {
  const basic = salaryStructure.basic || 0;
  const houseRentAllowance = salaryStructure.houseRentAllowance || 0;
  const specialAllowance = salaryStructure.specialAllowance || 0;
  const gross = basic + houseRentAllowance + specialAllowance;
  const pf = salaryStructure.pf ?? defaultPF ?? 0;

  const { workingDays, lopDays } = attendanceSnapshot;
  const perDay = workingDays > 0 ? gross / workingDays : 0;
  const lopDeduction = roundRupee(perDay * lopDays);
  const netPay = roundRupee(gross - pf - lopDeduction);

  return {
    basic,
    houseRentAllowance,
    specialAllowance,
    gross,
    pf,
    lopDeduction,
    netPay
  };
};

export const calculateContractPay = (salaryStructure, attendanceSnapshot) => {
  const dailyAmount = salaryStructure.dailyAmount || 0;
  const payableDays = attendanceSnapshot.workingDays;
  const totalPay = roundRupee(payableDays * dailyAmount);

  return {
    dailyAmount,
    payableDays,
    totalPay
  };
};

export const resolveSalaryStructure = (structures, month, year) => {
  if (!structures || structures.length === 0) return null;

  const exact = structures.find(
    (item) => item.effectiveMonth === month && item.effectiveYear === year
  );

  if (exact) return exact;

  const previous = structures
    .filter(
      (item) =>
        item.effectiveYear < year ||
        (item.effectiveYear === year && item.effectiveMonth <= month)
    )
    .sort((a, b) => {
      if (a.effectiveYear !== b.effectiveYear) return b.effectiveYear - a.effectiveYear;
      return b.effectiveMonth - a.effectiveMonth;
    });

  return previous[0] || null;
};

export const generatePayslipPdf = (payroll) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const company = payroll.companySnapshot || {};
      const attendance = payroll.attendanceSnapshot || {};
      const salary = payroll.salarySnapshot || {};

      doc.fontSize(18).text(company.companyName || "ToroHR", { align: "center" });
      if (company.address) {
        doc.fontSize(9).fillColor("#555555").text(company.address, { align: "center" });
      }
      doc.moveDown();
      doc.fillColor("#000000").fontSize(14).text("Payslip", { align: "center" });
      doc.fontSize(10).text(`Payroll #: ${payroll.payrollNumber}`, { align: "center" });
      doc.text(`Period: ${String(payroll.month).padStart(2, "0")}/${payroll.year}`, {
        align: "center"
      });
      doc.moveDown();

      doc.fontSize(11).text(`Employee: ${payroll.employeeName}`);
      doc.text(`Employee ID: ${payroll.employeeCode}`);
      doc.text(`Designation: ${payroll.designation || "-"}`);
      doc.text(`Employment Type: ${payroll.employmentType}`);
      doc.moveDown();

      doc.fontSize(12).text("Attendance Summary", { underline: true });
      doc.fontSize(10);
      doc.text(`Working Days: ${attendance.workingDays ?? 0}`);
      doc.text(`Present Days: ${attendance.presentDays ?? 0}`);
      doc.text(`Leave Days: ${attendance.leaveDays ?? 0}`);
      doc.text(`Holiday Days: ${attendance.holidayDays ?? 0}`);
      doc.text(`LOP Days: ${attendance.lopDays ?? 0}`);
      doc.moveDown();

      doc.fontSize(12).text("Salary Details", { underline: true });
      doc.fontSize(10);

      if (payroll.employmentType === "Contract") {
        doc.text(`Daily Amount: INR ${salary.dailyAmount ?? 0}`);
        doc.text(`Payable Days: ${salary.payableDays ?? 0}`);
        doc.text(`Total Pay: INR ${salary.totalPay ?? 0}`);
      } else {
        doc.text(`Basic: INR ${salary.basic ?? 0}`);
        doc.text(`HRA: INR ${salary.houseRentAllowance ?? 0}`);
        doc.text(`Special Allowance: INR ${salary.specialAllowance ?? 0}`);
        doc.text(`Gross: INR ${salary.gross ?? 0}`);
        doc.text(`PF Deduction: INR ${salary.pf ?? 0}`);
        doc.text(`LOP Deduction: INR ${salary.lopDeduction ?? 0}`);
        doc.fontSize(12).text(`Net Pay: INR ${salary.netPay ?? 0}`, { underline: true });
      }

      doc.moveDown(2);
      doc.fontSize(9).fillColor("#666666");
      doc.text(`Status: ${payroll.status}`);
      if (payroll.paidAt) {
        doc.text(`Paid Date: ${new Date(payroll.paidAt).toLocaleDateString("en-IN")}`);
      }
      doc.text("This is a system-generated payslip.", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let _payrollInterval = null;

const getISTDateParts = (date = new Date()) => {
  const [year, month, day] = date
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-")
    .map(Number);
  return { year, month, day };
};

export const startPayrollGenerationJob = (generateCallback) => {
  if (_payrollInterval) {
    clearInterval(_payrollInterval);
  }

  let lastRunKey = null;

  const runIfDue = async () => {
    try {
      const { year, month, day } = getISTDateParts();
      const settings = await generateCallback.getSettings?.();

      if (!settings) return;

      const generationDay = settings.payrollGenerationDay || 1;
      if (day !== generationDay) return;

      const runKey = `${year}-${month}-${day}`;
      if (lastRunKey === runKey) return;
      lastRunKey = runKey;

      let targetMonth = month - 1;
      let targetYear = year;
      if (targetMonth === 0) {
        targetMonth = 12;
        targetYear -= 1;
      }

      const result = await generateCallback.runAutoGeneration(targetMonth, targetYear);
      console.log(`Auto payroll generated for ${targetMonth}/${targetYear}`, result);
    } catch (error) {
      console.error("Auto payroll generation failed", error);
    }
  };

  runIfDue();
  _payrollInterval = setInterval(runIfDue, ONE_DAY_MS);
  return _payrollInterval;
};
