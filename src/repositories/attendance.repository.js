import mongoose from "mongoose";
import Attendance from "../models/attendance.model.js";

const attendancePopulateOptions = [
  {
    path: "employeeId",
    select: "employeeId fullName email department reportingManagerId userId",
    populate: {
      path: "userId",
      select: "role isActive"
    }
  },
  {
    path: "markedBy",
    select: "employeeId fullName designation"
  }
];

export const findAttendanceById = (id) => {
  return Attendance.findById(id).populate(attendancePopulateOptions);
};

export const findAttendanceByEmployeeAndDate = (employeeId, date) => {
  const [y, m, d] = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  const startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  return Attendance.findOne({
    employeeId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }).select("checkInTime checkOutTime status hoursWorked").populate(attendancePopulateOptions);
};

const buildDateFilter = (startDate, endDate) => {
  const dateFilter = {};
  if (startDate) {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    dateFilter.$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }
  return dateFilter;
};

const projectFields = {
  $project: {
    _id: 1,
    employeeId: 1,
    employee: 1,
    date: 1,
    checkInTime: 1,
    checkOutTime: 1,
    hoursWorked: 1,
    status: 1,
    markedBy: 1,
    markingMethod: 1,
    isLateCheckIn: 1,
    lateCheckInMinutes: 1
  }
};

export const findAttendanceWithFilters = async (filters) => {
  const {
    employeeId,
    startDate,
    endDate,
    status,
    department,
    managerId,
    search,
    page = 1,
    limit = 20
  } = filters;

  const query = {};

  if (employeeId) {
    query.employeeId = new mongoose.Types.ObjectId(employeeId);
  }

  const dateFilter = buildDateFilter(startDate, endDate);
  if (Object.keys(dateFilter).length > 0) {
    query.date = dateFilter;
  }

  if (status) {
    query.status = status;
  }

  const pipeline = [
    { $match: query },
    projectFields
  ];

  const afterLookupMatch = [];
  if (department) {
    afterLookupMatch.push({ $match: { "employee.department": department } });
  }
  if (managerId) {
    afterLookupMatch.push({
      $match: { "employee.reportingManagerId": new mongoose.Types.ObjectId(managerId) }
    });
  }
  if (search) {
    const searchRegex = new RegExp(search, "i");
    afterLookupMatch.push({
      $match: {
        $or: [
          { "employee.fullName": searchRegex },
          { "employee.employeeId": searchRegex },
          { "employee.email": searchRegex }
        ]
      }
    });
  }

  if (afterLookupMatch.length > 0) {
    pipeline.push({
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee"
      }
    });
    pipeline.push({ $unwind: "$employee" });
    pipeline.push(...afterLookupMatch);
    pipeline.push(projectFields);
  }

  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await Attendance.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  const skip = (page - 1) * limit;
  pipeline.push({ $sort: { date: -1 } });
  pipeline.push({ $skip: skip }, { $limit: limit });

  if (afterLookupMatch.length === 0) {
    pipeline.push({
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee"
      }
    });
    pipeline.push({ $unwind: "$employee" });
  }

  pipeline.push(projectFields);

  const records = await Attendance.aggregate(pipeline);

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    records
  };
};

export const findTeamAttendance = async (managerId, filters = {}) => {
  const { startDate, endDate, status, page = 1, limit = 20 } = filters;

  const pipeline = [
    {
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee"
      }
    },
    { $unwind: "$employee" },
    {
      $match: {
        "employee.reportingManagerId": new mongoose.Types.ObjectId(managerId)
      }
    },
    projectFields
  ];

  if (startDate || endDate) {
    const dateMatch = buildDateFilter(startDate, endDate);
    pipeline.push({ $match: { date: dateMatch } });
  }

  if (status) {
    pipeline.push({ $match: { status } });
  }

  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await Attendance.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  const skip = (page - 1) * limit;
  pipeline.push({ $sort: { date: -1 } });
  pipeline.push({ $skip: skip }, { $limit: limit });

  const records = await Attendance.aggregate(pipeline);

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    records
  };
};

export const getAttendanceSummaryForToday = async (filters = {}) => {
  const now = new Date();
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  const todayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const todayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  const { department, managerId, employeeId } = filters;

  const pipeline = [];

  const match = { date: { $gte: todayStart, $lte: todayEnd } };
  if (employeeId) match.employeeId = new mongoose.Types.ObjectId(employeeId);

  if (department || managerId) {
    const empQuery = {};
    if (department) empQuery.department = department;
    if (managerId) empQuery.reportingManagerId = new mongoose.Types.ObjectId(managerId);

    const employees = await mongoose.model("Employee").find(empQuery).select("_id").lean();
    const ids = employees.map(e => e._id);
    if (ids.length > 0) match.employeeId = { $in: ids };
    else return { present: 0, absent: 0, leave: 0, weekend: 0, halfday: 0, total: 0 };
  }

  pipeline.push({ $match: match });
  pipeline.push({
    $group: {
      _id: null,
      present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
      leave: { $sum: { $cond: [{ $eq: ["$status", "Leave"] }, 1, 0] } },
      weekend: { $sum: { $cond: [{ $eq: ["$status", "Weekend"] }, 1, 0] } },
      halfday: { $sum: { $cond: [{ $eq: ["$status", "Half-day"] }, 1, 0] } }
    }
  });

  const results = await Attendance.aggregate(pipeline);

  if (results.length === 0) {
    return { present: 0, absent: 0, leave: 0, weekend: 0, halfday: 0, total: 0 };
  }

  const r = results[0];
  r.total = r.present + r.absent + r.leave + r.halfday;
  return r;
};

export const getEmployeeAttendanceStats = async (employeeId, month, year) => {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const pipeline = [
    {
      $match: {
        employeeId: new mongoose.Types.ObjectId(employeeId),
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalHours: { $sum: "$hoursWorked" }
      }
    }
  ];

  const results = await Attendance.aggregate(pipeline);

  const stats = {
    present: 0,
    absent: 0,
    leave: 0,
    halfday: 0,
    presentHours: 0,
    absentHours: 0,
    leaveHours: 0,
    halfdayHours: 0,
  };

  for (const result of results) {
    const status = result._id.toLowerCase().replace("-", "");

    if (status in stats) {
      stats[status] = result.count;

      const hoursKey = `${status}Hours`;
      if (hoursKey in stats) {
        stats[hoursKey] = result.totalHours || 0;
      }
    }
  }

  return stats;
};

export const deleteAttendance = (id) => {
  return Attendance.findByIdAndDelete(id);
};

export const getAttendanceSummaryForDateRange = async (startDate, endDate, filters = {}) => {
  const { employeeId, department, managerId } = filters;

  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  const match = {
    date: { $gte: start, $lte: end }
  };
  if (employeeId) match.employeeId = new mongoose.Types.ObjectId(employeeId);

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee"
      }
    },
    { $unwind: "$employee" }
  ];

  if (department) {
    pipeline.push({ $match: { "employee.department": department } });
  }
  if (managerId) {
    pipeline.push({ $match: { "employee.reportingManagerId": new mongoose.Types.ObjectId(managerId) } });
  }

  pipeline.push({
    $group: {
      _id: "$employee._id",
      employeeName: { $first: "$employee.fullName" },
      present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
      leave: { $sum: { $cond: [{ $eq: ["$status", "Leave"] }, 1, 0] } },
      halfday: { $sum: { $cond: [{ $eq: ["$status", "Half-day"] }, 1, 0] } },
      totalHours: { $sum: "$hoursWorked" }
    }
  });
  pipeline.push({ $sort: { employeeName: 1 } });

  return Attendance.aggregate(pipeline);
};
