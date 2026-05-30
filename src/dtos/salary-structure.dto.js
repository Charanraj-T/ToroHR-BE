export const normalizeSalaryStructure = (structure) => {
  if (!structure) return null;

  const gross =
    (structure.basic || 0) +
    (structure.houseRentAllowance || 0) +
    (structure.specialAllowance || 0);

  return {
    id: structure._id,
    employee: structure.employeeId?._id
      ? {
          id: structure.employeeId._id,
          employeeId: structure.employeeId.employeeId,
          fullName: structure.employeeId.fullName,
          email: structure.employeeId.email,
          department: structure.employeeId.department,
          designation: structure.employeeId.designation,
          employmentType: structure.employeeId.employmentType
        }
      : { id: structure.employeeId },
    employmentType: structure.employmentType,
    effectiveMonth: structure.effectiveMonth,
    effectiveYear: structure.effectiveYear,
    basic: structure.basic,
    houseRentAllowance: structure.houseRentAllowance,
    specialAllowance: structure.specialAllowance,
    gross: structure.employmentType === "Full-time" ? gross : undefined,
    pf: structure.pf,
    dailyAmount: structure.dailyAmount,
    createdAt: structure.createdAt,
    updatedAt: structure.updatedAt
  };
};

export const normalizeSalaryStructureList = (records) =>
  records.map((record) => normalizeSalaryStructure(record));
