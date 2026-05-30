export const normalizePayrollSettings = (settings) => {
  if (!settings) return null;

  return {
    id: settings._id,
    payrollGenerationDay: settings.payrollGenerationDay,
    defaultPF: settings.defaultPF,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt
  };
};

const normalizeEmployeeBrief = (employee) => {
  if (!employee) return null;

  return {
    id: employee._id,
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department,
    designation: employee.designation,
    reportingManagerId: employee.reportingManagerId
  };
};

export const normalizePayroll = (payroll) => {
  if (!payroll) return null;

  return {
    id: payroll._id,
    payrollNumber: payroll.payrollNumber,
    employee: payroll.employeeId?._id
      ? normalizeEmployeeBrief(payroll.employeeId)
      : { id: payroll.employeeId },
    employeeName: payroll.employeeName,
    employeeCode: payroll.employeeCode,
    designation: payroll.designation,
    employmentType: payroll.employmentType,
    month: payroll.month,
    year: payroll.year,
    companySnapshot: payroll.companySnapshot,
    attendanceSnapshot: payroll.attendanceSnapshot,
    salarySnapshot: payroll.salarySnapshot,
    status: payroll.status,
    processedAt: payroll.processedAt,
    paidAt: payroll.paidAt,
    createdAt: payroll.createdAt,
    updatedAt: payroll.updatedAt
  };
};

export const normalizePayrollList = (records) => records.map((record) => normalizePayroll(record));

export const normalizePayrollSummary = (summary) => ({
  Draft: summary.Draft || 0,
  Processed: summary.Processed || 0,
  Paid: summary.Paid || 0
});
