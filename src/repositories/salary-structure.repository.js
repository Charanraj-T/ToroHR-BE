import Employee from "../models/employee.model.js";
import SalaryStructure from "../models/salary-structure.model.js";
import mongoose from "mongoose";

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

export const listEmployeesWithSalaryStructures = async ({ employeeIds, salaryQuery, page, limit }) => {
  const skip = (page - 1) * limit;
  const matchStage = { _id: { $in: employeeIds.map(id => new mongoose.Types.ObjectId(id)) } };

  const lookupPipeline = [
    { $match: { $expr: { $eq: ["$employeeId", "$$empId"] }, ...salaryQuery } },
    { $sort: { effectiveYear: -1, effectiveMonth: -1 } },
    { $limit: 1 }
  ];

  const facetPipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "salarystructures",
        let: { empId: "$_id" },
        pipeline: lookupPipeline,
        as: "salaryStructure"
      }
    },
    { $unwind: { path: "$salaryStructure", preserveNullAndEmptyArrays: true } },
    { $sort: { "fullName": 1 } },
    {
      $facet: {
        totalCount: [{ $count: "count" }],
        data: [{ $skip: skip }, { $limit: limit }]
      }
    }
  ];

  const [result] = await Employee.aggregate(facetPipeline);
  const totalCount = result.totalCount[0]?.count || 0;

  return {
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit) || 1,
    data: result.data
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
    "employeeId fullName email department designation employmentType status joiningDate reportingManagerId tenantId"
  );
};

export const getTeamEmployeeIds = async (managerId) => {
  const employees = await Employee.find({ reportingManagerId: managerId }).select("_id").lean();
  return employees.map((employee) => employee._id);
};
