import https from "https";
import http from "http";
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
  const presentDays = attendanceSnapshot.presentDays;
  const totalPay = roundRupee(presentDays * dailyAmount);

  return {
    dailyAmount,
    payableDays: presentDays,
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

const isValidImage = (buf) => {
  if (!buf || buf.length < 8) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  return false;
};

export const fetchImageBuffer = async (url) => {
  if (!url) return null;

  if (url.startsWith("data:")) {
    const matches = url.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
    if (!matches) return null;
    const buf = Buffer.from(matches[2], "base64");
    return isValidImage(buf) ? buf : null;
  }

  try {
    const mod = url.startsWith("https") ? https : http;
    return new Promise((resolve) => {
      const req = mod.get(url, { timeout: 5000 }, (res) => {
        if (res.statusCode !== 200) { resolve(null); return; }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve(isValidImage(buf) ? buf : null);
        });
        res.on("error", () => resolve(null));
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    });
  } catch {
    return null;
  }
};

const formatINR = (amount) =>
  "Rs. " + new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0, minimumFractionDigits: 0
  }).format(amount || 0);

export const generatePayslipPdf = (payroll, logoSrc = null) =>
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
      const ML = doc.page.margins.left;
      const MR = doc.page.margins.right;
      const W = doc.page.width - ML - MR;

      const hr = (yy) => {
        doc.moveTo(ML, yy).lineTo(ML + W, yy).strokeColor("#cccccc").stroke();
      };

      const row = (label, value, yy, opts = {}) => {
        const { labelW = 140, bold = false, valSize = 9, lblSize = 9, labelColor = "#666666", valueColor = "#222222" } = opts;
        const lf = bold ? "Helvetica-Bold" : "Helvetica";
        const vf = bold ? "Helvetica-Bold" : "Helvetica";
        const vx = ML + labelW + 12;
        const vw = W - labelW - 12;
        doc.fontSize(lblSize).fillColor(labelColor).font(lf)
          .text(label, ML, yy, { width: labelW });
        doc.fontSize(valSize).fillColor(valueColor).font(vf)
          .text(value, vx, yy, { width: vw, align: "right" });
        return yy + 16;
      };

      let y = ML;

      // ═══════════════════  HEADER  ═══════════════════

      const hasLogo = logoSrc && Buffer.isBuffer(logoSrc) && logoSrc.length > 0;
      if (hasLogo) {
        try { doc.image(logoSrc, ML, y, { width: 50 }); } catch { /* skip */ }
      }
      const hx = hasLogo ? ML + 62 : ML;
      const hw = hasLogo ? W - 62 : W;

      doc.fontSize(18).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text(company.companyName || "ToroHR", hx, y + 2, { width: hw, align: hasLogo ? "left" : "center" });
      y += 26;

      if (company.address) {
        const lines = company.address.split("\n").filter(Boolean);
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
          doc.fontSize(8).fillColor("#777777").font("Helvetica")
            .text(lines[i], hx, y, { width: hw, align: hasLogo ? "left" : "center" });
          y += 11;
        }
      }

      y += 8;
      hr(y);
      y += 12;

      doc.fontSize(14).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("PAYSLIP", ML, y, { align: "center", width: W });
      y += 18;

      doc.fontSize(9).fillColor("#555555").font("Helvetica")
        .text(`Payroll #: ${payroll.payrollNumber}  |  Period: ${String(payroll.month).padStart(2, "0")}/${payroll.year}`,
          ML, y, { align: "center", width: W });
      y += 22;

      // ═══════════════════  EMPLOYEE DETAILS  ═══════════════════

      doc.fontSize(11).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("Employee Details", ML, y);
      y += 16;
      hr(y);
      y += 8;

      y = row("Employee Name", payroll.employeeName, y, { labelW: 130 });
      y = row("Employee ID", payroll.employeeCode, y, { labelW: 130 });
      y = row("Designation", payroll.designation || "-", y, { labelW: 130 });
      y = row("Employment Type", payroll.employmentType, y, { labelW: 130 });
      y += 4;

      // ═══════════════════  ATTENDANCE  ═══════════════════

      doc.fontSize(11).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("Attendance", ML, y);
      y += 16;
      hr(y);
      y += 8;

      const attrs = [
        { l: "Working Days", v: String(attendance.workingDays ?? 0) },
        { l: "Present Days", v: String(attendance.presentDays ?? 0) },
        { l: "Leave Days", v: String(attendance.leaveDays ?? 0) },
        { l: "Holiday Days", v: String(attendance.holidayDays ?? 0) },
        { l: "LOP Days", v: String(attendance.lopDays ?? 0) },
      ];
      const colW = W / attrs.length;
      attrs.forEach((a, i) => {
        const cx = ML + i * colW;
        doc.fontSize(8).fillColor("#666666").font("Helvetica")
          .text(a.l, cx, y, { width: colW, align: "center" });
        doc.fontSize(10).fillColor("#222222").font("Helvetica-Bold")
          .text(a.v, cx, y + 12, { width: colW, align: "center" });
      });
      y += 28;

      // ═══════════════════  SALARY DETAILS  ═══════════════════

      doc.fontSize(11).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("Salary Details", ML, y);
      y += 16;

      if (payroll.employmentType === "Contract") {
        hr(y);
        y += 8;
        y = row("Daily Amount", formatINR(salary.dailyAmount ?? 0), y);
        y = row("Present Days", String(salary.payableDays ?? 0), y);
        hr(y - 4);
        y += 4;

        // Total Pay highlighted
        doc.rect(ML, y, W, 28).fillColor("#f4f4f4").fill();
        doc.rect(ML, y, W, 28).strokeColor("#cccccc").stroke();
        doc.fontSize(11).fillColor("#1a1a1a").font("Helvetica-Bold")
          .text("Total Pay", ML + 10, y + 7, { width: 120 });
        doc.fontSize(13).fillColor("#1a1a1a").font("Helvetica-Bold")
          .text(formatINR(salary.totalPay ?? 0), ML + 130, y + 7, {
            width: W - 140, align: "right" });
        y += 34;
      } else {
        hr(y);
        y += 8;

        const items = [
          { l: "Basic", v: salary.basic ?? 0 },
          { l: "House Rent Allowance", v: salary.houseRentAllowance ?? 0 },
          { l: "Special Allowance", v: salary.specialAllowance ?? 0 },
          { l: "PF", v: salary.pf ?? 0 },
          { l: "LOP Deduction", v: salary.lopDeduction ?? 0 },
        ];

        const vlw = 100;
        for (const item of items) {
          doc.fontSize(9).fillColor("#666666").font("Helvetica")
            .text(item.l, ML + 8, y + 4, { width: vlw });
          doc.fontSize(9).fillColor("#222222").font("Helvetica")
            .text(formatINR(item.v), ML + vlw + 16, y + 4, {
              width: W - vlw - 24, align: "right" });
          hr(y + 18);
          y += 18;
        }

        doc.fontSize(9).fillColor("#222222").font("Helvetica-Bold")
          .text("Gross", ML + 8, y + 4, { width: vlw });
        doc.fontSize(9).fillColor("#222222").font("Helvetica-Bold")
          .text(formatINR(salary.gross ?? 0), ML + vlw + 16, y + 4, {
            width: W - vlw - 24, align: "right" });
        y += 20;

        // Net Pay highlighted
        doc.rect(ML, y, W, 28).fillColor("#f4f4f4").fill();
        doc.rect(ML, y, W, 28).strokeColor("#cccccc").stroke();
        doc.fontSize(11).fillColor("#1a1a1a").font("Helvetica-Bold")
          .text("Net Pay", ML + 10, y + 7, { width: 120 });
        doc.fontSize(13).fillColor("#1a1a1a").font("Helvetica-Bold")
          .text(formatINR(salary.netPay ?? 0), ML + 130, y + 7, {
            width: W - 140, align: "right" });
        y += 34;
      }

      // ═══════════════════  FOOTER  ═══════════════════

      hr(y);
      y += 8;

      if (payroll.paidAt) {
        doc.fontSize(8).fillColor("#888888").font("Helvetica")
          .text(`Paid on: ${new Date(payroll.paidAt).toLocaleDateString("en-IN")}`,
            ML, y, { width: W / 3 });
      }
      y += 14;

      doc.fontSize(7.5).fillColor("#aaaaaa").font("Helvetica")
        .text("This is a system-generated payslip.", ML, y, { align: "center", width: W });

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
