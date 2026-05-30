import Attendance from "../models/attendance.model.js";
import Leave from "../models/leave.model.js";
import Payroll from "../models/payroll.model.js";
import Employee from "../models/employee.model.js";
import { getEndOfDay, getStartOfDay } from "../utils/date.util.js";

const payrollPopulateOptions = [
  {
    path: "employeeId",
    select: "employeeId fullName email department designation reportingManagerId"
  }
];

export const findPayrollById = (id, session = null) => {
  return Payroll.findById(id, { pdfData: 0 }).session(session).populate(payrollPopulateOptions);
};

export const findPayrollByEmployeeMonth = (employeeId, month, year, session = null) => {
  return Payroll.findOne({ employeeId, month, year }, { status: 1 }).session(session);
};

export const updatePayrollById = (id, updateData, session = null) => {
  return Payroll.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    session
  }).populate(payrollPopulateOptions);
};

export const upsertPayroll = (filter, updateData, session = null) => {
  return Payroll.findOneAndUpdate(filter, updateData, {
    new: true,
    upsert: true,
    runValidators: true,
    session,
    setDefaultsOnInsert: true
  }).populate(payrollPopulateOptions);
};

export const listPayrolls = async ({ query, page, limit }) => {
  const skip = (page - 1) * limit;

  const [totalCount, data] = await Promise.all([
    Payroll.countDocuments(query),
    Payroll.find(query, { pdfData: 0 })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(payrollPopulateOptions)
      .lean()
  ]);

  return {
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit) || 1,
    data
  };
};

export const getPayrollSummary = async (query) => {
  const results = await Payroll.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  const summary = { Draft: 0, Processed: 0, Paid: 0 };
  for (const item of results) {
    if (Object.prototype.hasOwnProperty.call(summary, item._id)) {
      summary[item._id] = item.count;
    }
  }
  return summary;
};

export const getTeamEmployeeIds = async (managerId) => {
  const employees = await Employee.find({ reportingManagerId: managerId }).select("_id").lean();
  return employees.map((employee) => employee._id);
};

export const findAttendanceForPeriod = (employeeId, periodStart, periodEnd) => {
  return Attendance.find({
    employeeId,
    date: {
      $gte: getStartOfDay(periodStart),
      $lte: getEndOfDay(periodEnd)
    }
  })
    .select("date status")
    .lean();
};

export const findApprovedLeavesForPeriod = (employeeId, periodStart, periodEnd) => {
  return Leave.find({
    employeeId,
    status: "Approved",
    fromDate: { $lte: getEndOfDay(periodEnd) },
    toDate: { $gte: getStartOfDay(periodStart) }
  })
    .select("fromDate toDate leaveType dayType")
    .lean();
};

export const findEmployeeById = (employeeId) => {
  return Employee.findById(employeeId).select(
    "employeeId fullName designation employmentType status joiningDate reportingManagerId"
  );
};

export const findActiveEmployees = () => {
  return Employee.find({ status: "Active" })
    .select("employeeId fullName designation employmentType status joiningDate")
    .lean();
};

export const findPayrollsByEmployeeMonth = (employeeIds, month, year) => {
  return Payroll.find({ employeeId: { $in: employeeIds }, month, year })
    .select("employeeId status")
    .lean();
};
