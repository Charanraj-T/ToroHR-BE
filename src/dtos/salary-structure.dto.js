export const normalizeSalaryStructure = (record) => {
  if (!record) return null;

  const isAggregationResult = record.salaryStructure !== undefined;

  if (isAggregationResult) {
    const employee = record;
    const s = record.salaryStructure;

    if (!s) {
      return {
        id: null,
        employee: employee._id
          ? {
              id: employee._id,
              employeeId: employee.employeeId,
              fullName: employee.fullName,
              email: employee.email,
              department: employee.department,
              designation: employee.designation,
              employmentType: employee.employmentType,
              status: employee.status
            }
          : null,
        employmentType: employee.employmentType || null,
        effectiveMonth: null,
        effectiveYear: null,
        basic: null,
        houseRentAllowance: null,
        specialAllowance: null,
        gross: null,
        pf: null,
        dailyAmount: null,
        createdAt: null,
        updatedAt: null
      };
    }

    const gross =
      (s.basic || 0) +
      (s.houseRentAllowance || 0) +
      (s.specialAllowance || 0);

    return {
      id: s._id,
      employee: employee._id
        ? {
            id: employee._id,
            employeeId: employee.employeeId,
            fullName: employee.fullName,
            email: employee.email,
            department: employee.department,
            designation: employee.designation,
            employmentType: employee.employmentType,
            status: employee.status
          }
        : null,
      employmentType: s.employmentType,
      effectiveMonth: s.effectiveMonth,
      effectiveYear: s.effectiveYear,
      basic: s.basic,
      houseRentAllowance: s.houseRentAllowance,
      specialAllowance: s.specialAllowance,
      gross: s.employmentType === "Full-time" ? gross : undefined,
      pf: s.pf,
      dailyAmount: s.dailyAmount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  }

  const s = record;
  const gross =
    (s.basic || 0) +
    (s.houseRentAllowance || 0) +
    (s.specialAllowance || 0);

  return {
    id: s._id,
      employee: s.employeeId?._id
        ? {
            id: s.employeeId._id,
            employeeId: s.employeeId.employeeId,
            fullName: s.employeeId.fullName,
            email: s.employeeId.email,
            department: s.employeeId.department,
            designation: s.employeeId.designation,
            employmentType: s.employeeId.employmentType,
            status: s.employeeId.status
          }
        : { id: s.employeeId },
      employmentType: s.employmentType,
      effectiveMonth: s.effectiveMonth,
      effectiveYear: s.effectiveYear,
      basic: s.basic,
      houseRentAllowance: s.houseRentAllowance,
      specialAllowance: s.specialAllowance,
      gross: s.employmentType === "Full-time" ? gross : undefined,
      pf: s.pf,
      dailyAmount: s.dailyAmount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
};

export const normalizeSalaryStructureList = (records) =>
  records.map((record) => normalizeSalaryStructure(record));
