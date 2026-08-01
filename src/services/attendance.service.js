import mongoose from "mongoose";
import Attendance from "../models/attendance.model.js";
import Employee from "../models/employee.model.js";
import Leave from "../models/leave.model.js";
import { findHolidaysInDateRange } from "../repositories/holiday.repository.js";
import * as attendanceRepository from "../repositories/attendance.repository.js";
import { getTenantEmployeeIds } from "../utils/tenant.util.js";
import { getStartOfDay, getEndOfDay, getStartOfDayIST, getEndOfDayIST, isWeekend } from "../utils/date.util.js";
import { buildWeekendDays } from "../utils/weekend.util.js";
import {
  isFutureDate,
  checkIfLate,
  findOpenPunch,
  sumPunchHours,
  normalizePunches,
} from "../utils/attendance.util.js";
import { normalizeAttendance, normalizeAttendanceList } from "../dtos/attendance.dto.js";

const populateAndNormalize = async (attendanceId) => {
  const populated = await Attendance.findById(attendanceId).populate([
    {
      path: "employeeId",
      select: "employeeId fullName email department"
    },
    {
      path: "markedBy",
      select: "employeeId fullName"
    }
  ]);

  return normalizeAttendance(populated);
};

export const checkIn = async (employeeId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await Employee.findById(employeeId).populate("userId").session(session);
    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    if (employee.userId?.role === "Admin") {
      const error = new Error("Admin cannot mark attendance");
      error.statusCode = 403;
      throw error;
    }

    const now = new Date();
    const today = getStartOfDayIST(now);

    const todayDateStr = today.toISOString().split('T')[0];
    const todayStart = new Date(todayDateStr + 'T00:00:00.000Z');
    const todayEnd = new Date(todayDateStr + 'T23:59:59.999Z');

    const holidays = await findHolidaysInDateRange(todayStart, todayEnd, employee.userId?.tenantId);
    if (holidays.length > 0) {
      const error = new Error(`Today is a holiday: ${holidays[0].name}`);
      error.statusCode = 400;
      throw error;
    }

    const weekendDays = await buildWeekendDays(employee.userId?.tenantId);
    if (isWeekend(today, weekendDays)) {
      const error = new Error("Cannot check in on a weekend");
      error.statusCode = 400;
      throw error;
    }

    const approvedLeave = await Leave.findOne({
      employeeId,
      status: { $in: ["Approved"] },
      fromDate: { $lte: todayEnd },
      toDate: { $gte: todayStart }
    }).session(session);

    if (approvedLeave) {
      const error = new Error("Cannot check in - you have an approved leave today");
      error.statusCode = 400;
      throw error;
    }

    const existingAttendance = await Attendance.findOne(
      {
        employeeId,
        date: {
          $gte: getStartOfDayIST(now),
          $lte: getEndOfDayIST(now)
        }
      },
      null,
      { session }
    );

    if (existingAttendance && findOpenPunch(existingAttendance.punches)) {
      const error = new Error("You already have an active check-in. Please check out first");
      error.statusCode = 400;
      throw error;
    }

    let attendance;

    if (existingAttendance) {
      const isFirstSession = !(existingAttendance.punches?.length);
      const { isLate, minutesLate } = isFirstSession
        ? checkIfLate([{ checkInTime: now }])
        : { isLate: existingAttendance.isLateCheckIn, minutesLate: existingAttendance.lateCheckInMinutes };

      attendance = await Attendance.findByIdAndUpdate(
        existingAttendance._id,
        {
          $push: {
            punches: { checkInTime: now, checkOutTime: null }
          },
          status: "Present",
          markingMethod: "Self",
          ...(isFirstSession ? { isLateCheckIn: isLate, lateCheckInMinutes: minutesLate } : {})
        },
        { new: true, runValidators: true, session }
      );
    } else {
      const { isLate, minutesLate } = checkIfLate([{ checkInTime: now }]);

      attendance = await Attendance.create(
        [
          {
            employeeId,
            date: today,
            punches: [{ checkInTime: now, checkOutTime: null }],
            markingMethod: "Self",
            isLateCheckIn: isLate,
            lateCheckInMinutes: minutesLate,
            status: "Present",
            weekendDays,
            tenantId: employee.userId?.tenantId
          }
        ],
        { session }
      );
      attendance = attendance[0];
    }

    await session.commitTransaction();

    return populateAndNormalize(attendance._id);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const checkOut = async (employeeId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();

    const attendance = await Attendance.findOne(
      {
        employeeId,
        date: {
          $gte: getStartOfDayIST(now),
          $lte: getEndOfDayIST(now)
        }
      },
      null,
      { session }
    );

    if (!attendance) {
      const error = new Error("No check-in found for today. Please check-in first");
      error.statusCode = 400;
      throw error;
    }

    const openPunch = findOpenPunch(attendance.punches);

    if (!openPunch) {
      const error = new Error("No active check-in found. Please check-in first");
      error.statusCode = 400;
      throw error;
    }

    if (now < openPunch.checkInTime) {
      const error = new Error("Check-out time cannot be before check-in time");
      error.statusCode = 400;
      throw error;
    }

    const hoursWorked = sumPunchHours(
      attendance.punches.map((p) => {
        const isOpenPunch = p === openPunch;
        return isOpenPunch
          ? { checkInTime: p.checkInTime, checkOutTime: now }
          : { checkInTime: p.checkInTime, checkOutTime: p.checkOutTime };
      })
    );

    const openPunchIndex = attendance.punches.findIndex((p) => p === openPunch);

    const updatedAttendance = await Attendance.findByIdAndUpdate(
      attendance._id,
      {
        $set: {
          [`punches.${openPunchIndex}.checkOutTime`]: now,
          hoursWorked
        }
      },
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();

    return populateAndNormalize(updatedAttendance._id);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const markAttendanceManual = async (
  employeeId,
  date,
  status,
  checkInTime,
  checkOutTime,
  markedBy,
  markingMethod,
  punches = null,
  tenantId = null
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await Employee.findById(employeeId).populate("userId").session(session);
    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    if (tenantId && employee.userId?.tenantId?.toString() !== tenantId) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    const dateStr = date.split('T')[0];
    const dateStart = new Date(dateStr + 'T00:00:00.000Z');
    const dateEnd = new Date(dateStr + 'T23:59:59.999Z');

    const holidays = await findHolidaysInDateRange(dateStart, dateEnd, employee.userId?.tenantId);
    if (holidays.length > 0 && status !== "Holiday") {
      const error = new Error(`Cannot mark attendance - ${dateStr} is a holiday: ${holidays[0].name}`);
      error.statusCode = 400;
      throw error;
    }

    const weekendDays = await buildWeekendDays(employee.userId?.tenantId);
    if (isWeekend(dateStart, weekendDays) && status !== "Holiday") {
      const error = new Error(`Cannot mark attendance - ${dateStr} is a weekend`);
      error.statusCode = 400;
      throw error;
    }

    const approvedLeave = await Leave.findOne({
      employeeId,
      status: { $in: ["Approved"] },
      fromDate: { $lte: dateEnd },
      toDate: { $gte: dateStart }
    }).session(session);

    if (approvedLeave && status !== "Leave" && status !== "Half-day") {
      const error = new Error(`Employee has an approved leave on ${dateStr}`);
      error.statusCode = 400;
      throw error;
    }

    const startOfDay = getStartOfDayIST(date);
    const endOfDay = getEndOfDayIST(date);

    let attendance = await Attendance.findOne(
      {
        employeeId,
        date: { $gte: startOfDay, $lte: endOfDay }
      },
      null,
      { session }
    );

    let punchesToStore = null;
    if (Array.isArray(punches)) {
      punchesToStore = normalizePunches(punches, date);
    } else if (checkInTime || checkOutTime) {
      punchesToStore = normalizePunches([{ checkInTime, checkOutTime }], date);
    }

    const isLeaveLikeStatus = status === "Absent" || status === "Leave" || status === "Half-day";
    const finalPunches = isLeaveLikeStatus ? [] : (punchesToStore || []);
    const hoursWorked = isLeaveLikeStatus ? 0 : sumPunchHours(finalPunches);

    const updateData = {
      status,
      markedBy,
      markingMethod,
      hoursWorked,
      weekendDays,
      punches: finalPunches
    };

    if (attendance) {
      attendance = await Attendance.findByIdAndUpdate(
        attendance._id,
        updateData,
        { new: true, runValidators: true, session }
      );
    } else {
      attendance = await Attendance.create(
        [
          {
            employeeId,
            date: startOfDay,
            tenantId: employee.userId?.tenantId,
            ...updateData
          }
        ],
        { session }
      );
      attendance = attendance[0];
    }

    await session.commitTransaction();

    return populateAndNormalize(attendance._id);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const updateAttendanceRecord = async (attendanceId, updateData, requestingUser) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const attendance = await Attendance.findById(attendanceId).session(session);
    if (!attendance) {
      const error = new Error("Attendance record not found");
      error.statusCode = 404;
      throw error;
    }

    if (requestingUser.role === "Manager" || requestingUser.role === "Admin") {
      const ownerId = attendance.employeeId?.toString();
      if (ownerId !== requestingUser.employeeId) {
        const owner = await Employee.findById(ownerId).session(session);

        if (!owner) {
          const error = new Error("Attendance record not found");
          error.statusCode = 404;
          throw error;
        }

        if (requestingUser?.tenantId && owner.tenantId?.toString() !== requestingUser.tenantId) {
          const error = new Error("Attendance record not found");
          error.statusCode = 404;
          throw error;
        }

        if (
          requestingUser.role === "Manager" &&
          (!owner.reportingManagerId || owner.reportingManagerId.toString() !== requestingUser.employeeId)
        ) {
          const error = new Error("You can only update attendance for your team members");
          error.statusCode = 403;
          throw error;
        }
      }
    }

    if (updateData.date && isFutureDate(updateData.date)) {
      const error = new Error("Cannot set attendance for future date");
      error.statusCode = 400;
      throw error;
    }

    if (updateData.status && ["Absent", "Leave", "Half-day"].includes(updateData.status)) {
      updateData.punches = [];
      updateData.hoursWorked = 0;
    } else if (Array.isArray(updateData.punches)) {
      const dateStr = attendance.date.toISOString().split("T")[0];
      updateData.punches = normalizePunches(updateData.punches, dateStr);
      updateData.hoursWorked = sumPunchHours(updateData.punches);
    } else {
      updateData.hoursWorked = sumPunchHours(attendance.punches || []);
    }

    if (!updateData.weekendDays) {
      const weekendDays = await buildWeekendDays(requestingUser?.tenantId);
      updateData.weekendDays = weekendDays;
    }

    const updated = await Attendance.findByIdAndUpdate(
      attendanceId,
      updateData,
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();

    return populateAndNormalize(updated._id);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const getAttendanceById = async (attendanceId, requestingUser = null) => {
  const attendance = await attendanceRepository.findAttendanceById(attendanceId);

  if (!attendance) {
    const error = new Error("Attendance record not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    requestingUser?.tenantId &&
    attendance.employeeId?.tenantId?.toString() !== requestingUser.tenantId
  ) {
    const error = new Error("Attendance record not found");
    error.statusCode = 404;
    throw error;
  }

  return normalizeAttendance(attendance);
};

export const getMyAttendance = async (employeeId, filters) => {
  const { page, limit, status, startDate, endDate } = filters;

  const result = await attendanceRepository.findAttendanceWithFilters({
    employeeId,
    page,
    limit,
    status,
    startDate,
    endDate
  });

  return {
    success: true,
    data: normalizeAttendanceList(result.records),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      pages: result.pages
    }
  };
};

export const getAllAttendance = async (filters) => {
  const { page, limit, employeeId, status, department, managerId, startDate, endDate, search, tenantId } =
    filters;

  let tenantEmployeeIds;
  if (tenantId) {
    tenantEmployeeIds = await getTenantEmployeeIds(tenantId);
  }

  const result = await attendanceRepository.findAttendanceWithFilters({
    employeeIds: tenantEmployeeIds,
    employeeId,
    status,
    department,
    managerId,
    startDate,
    endDate,
    search,
    page,
    limit
  });

  return {
    success: true,
    data: normalizeAttendanceList(result.records),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      pages: result.pages
    }
  };
};

export const getTeamAttendance = async (managerId, filters) => {
  const { page, limit, status, startDate, endDate } = filters;

  const result = await attendanceRepository.findTeamAttendance(managerId, {
    page,
    limit,
    status,
    startDate,
    endDate
  });

  return {
    success: true,
    data: normalizeAttendanceList(result.records),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      pages: result.pages
    }
  };
};

export const getAttendanceForExport = async (startDate, endDate, filters = {}) => {
  let employeeIds = filters.employeeIds;

  if (!employeeIds && !filters.employeeId && !filters.managerId && filters.tenantId) {
    employeeIds = await getTenantEmployeeIds(filters.tenantId);
  }

  const employeeSummaries = await attendanceRepository.getAttendanceSummaryForDateRange(startDate, endDate, {
    ...filters,
    employeeIds
  });

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  const holidays = await findHolidaysInDateRange(start, end, filters.tenantId);
  const holidayDateSet = new Set(holidays.map(h => {
    const d = new Date(h.date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }));

  const weekendDays = await buildWeekendDays(filters.tenantId);
  let weekendCount = 0;
  let holidayCount = 0;
  const current = new Date(start);
  while (current <= end) {
    const dateStr = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`;
    if (isWeekend(current, weekendDays)) {
      weekendCount++;
    } else if (holidayDateSet.has(dateStr)) {
      holidayCount++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const totalHoliday = weekendCount + holidayCount;
  const totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const workingDays = totalDays - totalHoliday;

  return employeeSummaries.map((emp) => ({
    employeeName: emp.employeeName,
    worked: (emp.present || 0) + (emp.halfday || 0) * 0.5,
    leave: emp.leave || 0,
    holiday: totalHoliday,
    absent: emp.absent || 0,
    workingDays
  }));
};

export const getAttendanceSummary = async (filters = {}) => {
  const summary = await attendanceRepository.getAttendanceSummaryForToday(filters);

  return {
    success: true,
    data: {
      present: summary.present,
      absent: summary.absent,
      onLeave: summary.leave,
      total: summary.total
    }
  };
};

export const getEmployeeStats = async (employeeId, month, year) => {
  const stats = await attendanceRepository.getEmployeeAttendanceStats(employeeId, month, year);

  return {
    success: true,
    data: stats
  };
};

export const deleteAttendanceRecord = async (attendanceId, requestingUser = null) => {
  const attendance = await attendanceRepository.findAttendanceById(attendanceId);

  if (!attendance) {
    const error = new Error("Attendance record not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    requestingUser?.tenantId &&
    attendance.employeeId?.tenantId?.toString() !== requestingUser.tenantId
  ) {
    const error = new Error("Attendance record not found");
    error.statusCode = 404;
    throw error;
  }

  const deleted = await attendanceRepository.deleteAttendance(attendanceId);

  if (!deleted) {
    const error = new Error("Attendance record not found");
    error.statusCode = 404;
    throw error;
  }

  return {
    success: true,
    message: "Attendance record deleted successfully"
  };
};
