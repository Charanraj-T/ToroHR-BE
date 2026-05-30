import Employee from "../models/employee.model.js";
import SalaryStructure from "../models/salary-structure.model.js";

const salaryPopulateOptions = [
  {
    path: "employeeId",
    select: "employeeId fullName email department designation employmentType reportingManagerId status"
  }
];

export const createSalaryStructure = async (data, session = null) => {
  const [structure] = await SalaryStructure.create([data], { session });
  return findSalaryStructureById(structure._id, session);
};

export const updateSalaryStructureById = (id, updateData, session = null) => {
  return SalaryStructure.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    session
  }).populate(salaryPopulateOptions);
};

export const findSalaryStructureById = (id, session = null) => {
  return SalaryStructure.findById(id).session(session).populate(salaryPopulateOptions);
};

export const listSalaryStructures = async ({ query, page, limit }) => {
  const skip = (page - 1) * limit;

  const [totalCount, data] = await Promise.all([
    SalaryStructure.countDocuments(query),
    SalaryStructure.find(query)
      .sort({ effectiveYear: -1, effectiveMonth: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(salaryPopulateOptions)
      .lean()
  ]);

  return {
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit) || 1,
    data
  };
};

export const findSalaryStructuresByEmployee = (employeeId) => {
  return SalaryStructure.find({ employeeId })
    .sort({ effectiveYear: -1, effectiveMonth: -1 })
    .lean();
};

export const findSalaryStructuresForEmployees = (employeeIds) => {
  return SalaryStructure.find({ employeeId: { $in: employeeIds } })
    .sort({ effectiveYear: -1, effectiveMonth: -1 })
    .lean();
};

export const findEmployeeById = (employeeId) => {
  return Employee.findById(employeeId).select(
    "employeeId fullName email department designation employmentType status joiningDate reportingManagerId"
  );
};

export const findActiveEmployees = () => {
  return Employee.find({ status: "Active" })
    .select("employeeId fullName designation employmentType status joiningDate")
    .lean();
};

export const getTeamEmployeeIds = async (managerId) => {
  const employees = await Employee.find({ reportingManagerId: managerId }).select("_id").lean();
  return employees.map((employee) => employee._id);
};
