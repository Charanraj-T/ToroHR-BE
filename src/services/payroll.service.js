import mongoose from "mongoose";
import Payroll from "../models/payroll.model.js";
import {
  normalizePayroll,
  normalizePayrollList,
  normalizePayrollSummary
} from "../dtos/payroll.dto.js";
import * as payrollRepository from "../repositories/payroll.repository.js";
import * as salaryStructureRepository from "../repositories/salary-structure.repository.js";
import { getCompanySettings } from "../repositories/settings.repository.js";
import { findHolidaysInDateRange } from "../repositories/holiday.repository.js";
import { getPayrollSettingsInternal } from "./payroll-settings.service.js";
import {
  buildCompanyAddress,
  buildHolidayDateSet,
  calculateContractPay,
  calculateFullTimePay,
  computeAttendanceSnapshot,
  generatePayrollNumber,
  generatePayslipPdf,
  getEligiblePeriod,
  resolveSalaryStructure,
  validatePayrollTransition
} from "../utils/payroll.util.js";

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validateObjectId = (id, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throwError(`${label} is invalid`, 400);
  }
};

const parsePageLimit = (queryParams) => ({
  page: Math.max(parseInt(queryParams.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100)
});

const buildVisibilityQuery = async (requestingUser) => {
  if (requestingUser.role === "Admin") {
    return {};
  }

  if (requestingUser.role === "Manager") {
    const teamIds = await payrollRepository.getTeamEmployeeIds(requestingUser.employeeId);
    return {
      employeeId: {
        $in: [new mongoose.Types.ObjectId(requestingUser.employeeId), ...teamIds]
      }
    };
  }

  return { employeeId: new mongoose.Types.ObjectId(requestingUser.employeeId) };
};

const applyFilters = (query, filters) => {
  if (filters.month) query.month = parseInt(filters.month, 10);
  if (filters.year) query.year = parseInt(filters.year, 10);
  if (filters.employee) query.employeeId = new mongoose.Types.ObjectId(filters.employee);
  if (filters.status) query.status = filters.status;
  return query;
};

const mergeEmployeeVisibility = (baseQuery, filterQuery) => {
  if (!baseQuery.employeeId || !filterQuery.employeeId) {
    return { ...baseQuery, ...filterQuery };
  }

  return {
    ...baseQuery,
    ...filterQuery,
    $and: [{ employeeId: baseQuery.employeeId }, { employeeId: filterQuery.employeeId }]
  };
};

const ensurePayrollViewAccess = async (requestingUser, payroll) => {
  if (requestingUser.role === "Admin") return;

  const employeeId = payroll.employeeId?._id?.toString() || payroll.employeeId.toString();

  if (requestingUser.role === "Employee") {
    if (employeeId !== requestingUser.employeeId) {
      throwError("You do not have permission to access this payslip", 403);
    }
    return;
  }

  if (requestingUser.role === "Manager") {
    if (employeeId === requestingUser.employeeId) return;

    const employee = await payrollRepository.findEmployeeById(employeeId);
    if (employee?.reportingManagerId?.toString() !== requestingUser.employeeId) {
      throwError("You do not have permission to access this payslip", 403);
    }
  }
};

const buildCompanySnapshot = (settings) => ({
  companyName: settings.companyName || "",
  logo: settings.companyLogo || "",
  address: buildCompanyAddress(settings)
});

const buildPayrollRecord = async ({
  employee,
  month,
  year,
  salaryStructure,
  payrollSettings,
  companySettings,
  generatedBy = null
}) => {
  const period = getEligiblePeriod(employee, month, year);
  if (!period) return null;

  const { periodStart, periodEnd } = period;
  const holidays = await findHolidaysInDateRange(periodStart, periodEnd);
  const holidayDateSet = buildHolidayDateSet(holidays);

  const [attendanceRecords, approvedLeaves] = await Promise.all([
    payrollRepository.findAttendanceForPeriod(employee._id, periodStart, periodEnd),
    payrollRepository.findApprovedLeavesForPeriod(employee._id, periodStart, periodEnd)
  ]);

  const attendanceSnapshot = computeAttendanceSnapshot({
    periodStart,
    periodEnd,
    holidayDateSet,
    attendanceRecords,
    approvedLeaves
  });

  let salarySnapshot;
  if (employee.employmentType === "Contract") {
    salarySnapshot = calculateContractPay(salaryStructure, attendanceSnapshot);
  } else {
    salarySnapshot = calculateFullTimePay(
      salaryStructure,
      attendanceSnapshot,
      payrollSettings.defaultPF
    );
  }

  const payrollNumber = generatePayrollNumber(year, month, employee.employeeId);
  const companySnapshot = buildCompanySnapshot(companySettings);

  const payrollData = {
    payrollNumber,
    employeeId: employee._id,
    employeeName: employee.fullName,
    employeeCode: employee.employeeId,
    designation: employee.designation,
    employmentType: employee.employmentType,
    month,
    year,
    companySnapshot,
    attendanceSnapshot,
    salarySnapshot,
    status: "Draft",
    processedAt: null,
    paidAt: null,
    generatedBy
  };

  const pdfBuffer = await generatePayslipPdf(payrollData);
  payrollData.pdfData = pdfBuffer;

  return payrollData;
};

export const generatePayrollForMonth = async (month, year, requestingUser = null) => {
  const employees = await payrollRepository.findActiveEmployees();
  const payrollSettings = await getPayrollSettingsInternal();
  const companySettings = await getCompanySettings();

  const employeeIds = employees.map((employee) => employee._id);
  const allStructures = await salaryStructureRepository.findSalaryStructuresForEmployees(employeeIds);

  const structuresByEmployee = allStructures.reduce((acc, structure) => {
    const key = structure.employeeId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(structure);
    return acc;
  }, {});

  const existingPayrolls = await payrollRepository.findPayrollsByEmployeeMonth(employeeIds, month, year);
  const existingByEmployeeId = existingPayrolls.reduce((acc, p) => {
    acc[p.employeeId.toString()] = p.status;
    return acc;
  }, {});

  let generatedCount = 0;
  let skippedCount = 0;
  const warnings = [];

  for (const employee of employees) {
    const existingStatus = existingByEmployeeId[employee._id.toString()];
    if (existingStatus === "Paid") {
      skippedCount += 1;
      continue;
    }

    const employeeStructures = structuresByEmployee[employee._id.toString()] || [];
    const salaryStructure = resolveSalaryStructure(employeeStructures, month, year);

    if (!salaryStructure) {
      skippedCount += 1;
      continue;
    }

    const period = getEligiblePeriod(employee, month, year);
    if (!period) {
      skippedCount += 1;
      continue;
    }

    const payrollData = await buildPayrollRecord({
      employee,
      month,
      year,
      salaryStructure,
      payrollSettings,
      companySettings,
      generatedBy: requestingUser?.userId || null
    });

    if (!payrollData) {
      skippedCount += 1;
      continue;
    }

    await payrollRepository.upsertPayroll(
      { employeeId: employee._id, month, year },
      {
        $set: {
          ...payrollData,
          status: "Draft",
          processedAt: null,
          paidAt: null,
          processedBy: null,
          paidBy: null
        }
      }
    );

    generatedCount += 1;
  }

  if (skippedCount > 0) {
    warnings.push(`${skippedCount} employees skipped due to missing salary or ineligible status`);
  }

  return {
    generatedCount,
    skippedCount,
    warnings
  };
};

export const generatePayroll = async (data, requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can generate payroll", 403);
  }

  return generatePayrollForMonth(data.month, data.year, requestingUser);
};

export const regeneratePayroll = async (employeeId, data, requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can regenerate payroll", 403);
  }

  validateObjectId(employeeId, "Employee ID");

  const employee = await payrollRepository.findEmployeeById(employeeId);
  if (!employee || employee.status !== "Active") {
    throwError("Employee not found or inactive", 404);
  }

  const existing = await payrollRepository.findPayrollByEmployeeMonth(
    employeeId,
    data.month,
    data.year
  );

  if (existing?.status === "Paid") {
    throwError("Paid payroll cannot be regenerated", 400);
  }

  const structures = await salaryStructureRepository.findSalaryStructuresByEmployee(employeeId);
  const salaryStructure = resolveSalaryStructure(structures, data.month, data.year);

  if (!salaryStructure) {
    throwError("No salary structure found for this employee and period", 404);
  }

  const payrollSettings = await getPayrollSettingsInternal();
  const companySettings = await getCompanySettings();

  const payrollData = await buildPayrollRecord({
    employee,
    month: data.month,
    year: data.year,
    salaryStructure,
    payrollSettings,
    companySettings,
    generatedBy: requestingUser.userId
  });

  if (!payrollData) {
    throwError("Employee is not eligible for payroll in this period", 400);
  }

  const payroll = await payrollRepository.upsertPayroll(
    { employeeId, month: data.month, year: data.year },
    {
      $set: {
        ...payrollData,
        status: "Draft",
        processedAt: null,
        paidAt: null,
        processedBy: null,
        paidBy: null
      }
    }
  );

  return normalizePayroll(payroll);
};

export const processPayroll = async (payrollId, requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can process payroll", 403);
  }

  validateObjectId(payrollId, "Payroll ID");

  const payroll = await payrollRepository.findPayrollById(payrollId);
  if (!payroll) {
    throwError("Payroll record not found", 404);
  }

  const transition = validatePayrollTransition(payroll.status, "Processed");
  if (!transition.valid) {
    throwError(transition.message, 400);
  }

  const updated = await payrollRepository.updatePayrollById(payrollId, {
    status: "Processed",
    processedAt: new Date(),
    processedBy: requestingUser.userId
  });

  return normalizePayroll(updated);
};

export const markPayrollPaid = async (payrollId, requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can mark payroll as paid", 403);
  }

  validateObjectId(payrollId, "Payroll ID");

  const payroll = await payrollRepository.findPayrollById(payrollId);
  if (!payroll) {
    throwError("Payroll record not found", 404);
  }

  const transition = validatePayrollTransition(payroll.status, "Paid");
  if (!transition.valid) {
    throwError(transition.message, 400);
  }

  const updated = await payrollRepository.updatePayrollById(payrollId, {
    status: "Paid",
    paidAt: new Date(),
    paidBy: requestingUser.userId
  });

  return normalizePayroll(updated);
};

export const listPayrolls = async (filters, requestingUser) => {
  const { page, limit } = parsePageLimit(filters);
  const visibilityQuery = await buildVisibilityQuery(requestingUser);
  const filterQuery = applyFilters({}, filters);
  const query = mergeEmployeeVisibility(visibilityQuery, filterQuery);

  const result = await payrollRepository.listPayrolls({ query, page, limit });

  return {
    totalCount: result.totalCount,
    currentPage: result.currentPage,
    totalPages: result.totalPages,
    data: normalizePayrollList(result.data)
  };
};

export const getPayrollSummary = async (requestingUser) => {
  const visibilityQuery = await buildVisibilityQuery(requestingUser);
  const summary = await payrollRepository.getPayrollSummary(visibilityQuery);
  return normalizePayrollSummary(summary);
};

export const getMyPayslips = async (filters, requestingUser) => {
  if (!requestingUser.employeeId) {
    return { totalCount: 0, currentPage: 1, totalPages: 1, data: [] };
  }

  return listPayrolls({ ...filters, employee: requestingUser.employeeId }, requestingUser);
};

export const getPayrollPdf = async (payrollId, requestingUser) => {
  validateObjectId(payrollId, "Payroll ID");

  const payroll = await payrollRepository.findPayrollById(payrollId);
  if (!payroll) {
    throwError("Payroll record not found", 404);
  }

  await ensurePayrollViewAccess(requestingUser, payroll);

  const pdfRecord = await Payroll.findById(payrollId).select("pdfData payrollNumber employeeName month year status").lean();

  if (!pdfRecord?.pdfData) {
    throwError("Payslip PDF is not available", 404);
  }

  return {
    payrollNumber: pdfRecord.payrollNumber,
    employeeName: pdfRecord.employeeName,
    month: pdfRecord.month,
    year: pdfRecord.year,
    status: pdfRecord.status,
    pdfBuffer: pdfRecord.pdfData
  };
};

export const runAutoPayrollGeneration = async (month, year) => {
  return generatePayrollForMonth(month, year, null);
};
