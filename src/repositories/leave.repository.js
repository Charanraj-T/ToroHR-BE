import Attendance from "../models/attendance.model.js";
import Employee from "../models/employee.model.js";
import Leave from "../models/leave.model.js";
import LeaveBalance from "../models/leave-balance.model.js";
import { getStartOfDayIST } from "../utils/date.util.js";
import { ACTIVE_LEAVE_STATUSES, getEndOfDay, getStartOfDay } from "../utils/leave.util.js";

const leavePopulateOptions = [
  {
    path: "employeeId",
    select: "employeeId fullName email department designation reportingManagerId"
  },
  {
    path: "appliedBy",
    select: "name email role"
  },
  {
    path: "modifiedBy",
    select: "name email role"
  }
];

const listLeavePopulateOptions = [
  {
    path: "employeeId",
    select: "employeeId fullName email department designation reportingManagerId"
  },
  {
    path: "modifiedBy",
    select: "name email role"
  }
];

export const hasAttendanceConflict = async ({ employeeId, fromDate, toDate, dayType, session = null }) => {
  const conflictingStatuses = ["Present", "Leave"];
  if (dayType === "Full-day") {
    conflictingStatuses.push("Half-day");
  }

  const existing = await Attendance.findOne({
    employeeId,
    date: { $gte: getStartOfDay(fromDate), $lte: getEndOfDay(toDate) },
    status: { $in: conflictingStatuses }
  }).session(session);

  return existing;
};

export const findEmployeeById = (employeeId, session = null) => {
  return Employee.findById(employeeId).select("status reportingManagerId").session(session);
};

export const findLeaveById = (id, session = null) => {
  return Leave.findById(id).session(session).populate(leavePopulateOptions);
};

export const createLeave = async (leaveData, session) => {
  const [leave] = await Leave.create([leaveData], { session });
  return leave;
};

export const updateLeaveById = (id, updateData, session = null) => {
  return Leave.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    session
  }).populate(leavePopulateOptions);
};

export const hasOverlappingLeave = async ({ employeeId, fromDate, toDate, ignoredLeaveId = null, session = null }) => {
  const query = {
    employeeId,
    status: { $in: ACTIVE_LEAVE_STATUSES },
    fromDate: { $lte: getEndOfDay(toDate) },
    toDate: { $gte: getStartOfDay(fromDate) }
  };

  if (ignoredLeaveId) {
    query._id = { $ne: ignoredLeaveId };
  }

  return Leave.exists(query).session(session);
};

export const getOrCreateLeaveBalance = async (employeeId, year, session = null) => {
  let balance = await LeaveBalance.findOne({ employeeId, year }).session(session);

  if (balance) {
    return balance;
  }

  const [created] = await LeaveBalance.create(
    [
      {
        employeeId,
        year
      }
    ],
    { session }
  );

  return created;
};

export const updateLeaveBalance = (employeeId, year, update, session = null) => {
  return LeaveBalance.findOneAndUpdate(
    { employeeId, year },
    update,
    {
      new: true,
      runValidators: true,
      session,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
};

export const applyLeaveBalanceApproval = (employeeId, year, leaveType, leaveDays, session = null) => {
  const filter = { employeeId, year };
  const update = leaveType === "LOP" ? { $inc: { LOP: leaveDays } } : { $inc: { [leaveType]: -leaveDays } };

  if (leaveType !== "LOP") {
    filter[leaveType] = { $gte: leaveDays };
  }

  return LeaveBalance.findOneAndUpdate(filter, update, {
    new: true,
    runValidators: true,
    session
  });
};

export const listLeaves = async ({ query, page, limit }) => {
  const skip = (page - 1) * limit;

  const [total, data] = await Promise.all([
    Leave.countDocuments(query),
    Leave.find(query, { rejectionReason: 0, cancellationReason: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(listLeavePopulateOptions)
      .lean()
  ]);

  return {
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit) || 1,
    data
  };
};

export const getTeamEmployeeIds = async (managerId) => {
  const employees = await Employee.find({ reportingManagerId: managerId }).select("_id").lean();
  return employees.map((employee) => employee._id);
};

export const findEmployeeIdsBySearch = async (search) => {
  const searchRegex = new RegExp(search, "i");
  const employees = await Employee.find({
    $or: [
      { fullName: searchRegex },
      { employeeId: searchRegex },
      { email: searchRegex },
      { department: searchRegex },
      { designation: searchRegex }
    ]
  })
    .select("_id")
    .lean();

  return employees.map((employee) => employee._id);
};

export const markAttendanceAsLeave = async ({ employeeId, dates, dayType, markedBy, markingMethod, session }) => {
  const attendanceStatus = dayType === "Half-day" ? "Half-day" : "Leave";

  const operations = dates.map((date) => ({
    updateOne: {
      filter: {
        employeeId,
        date: getStartOfDayIST(date)
      },
      update: {
        $set: {
          employeeId,
          date: getStartOfDayIST(date),
          status: attendanceStatus,
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: 0,
          markedBy,
          markingMethod
        }
      },
      upsert: true
    }
  }));

  if (operations.length === 0) {
    return;
  }

  await Attendance.bulkWrite(operations, { session });
};

export const clearLeaveAttendance = async ({ employeeId, dates, session }) => {
  if (dates.length === 0) {
    return;
  }

  await Attendance.updateMany(
    {
      employeeId,
      date: { $in: dates.map((date) => getStartOfDayIST(date)) },
      status: { $in: ["Leave", "Half-day"] }
    },
    {
      $set: {
        status: "Absent",
        checkInTime: null,
        checkOutTime: null,
        hoursWorked: 0,
        markedBy: null
      }
    },
    { session }
  );
};
