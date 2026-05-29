import mongoose from "mongoose";
import Attendance from "../models/attendance.model.js";
import Employee from "../models/employee.model.js";
import Leave from "../models/leave.model.js";
import { findHolidaysInDateRange } from "../repositories/holiday.repository.js";
import * as attendanceRepository from "../repositories/attendance.repository.js";
import {
  calculateHoursWorked,
  isFutureDate,
  checkIfLate,
  getStartOfDayIST,
  getEndOfDayIST
} from "../utils/attendance.util.js";
import { normalizeAttendance, normalizeAttendanceList } from "../dtos/attendance.dto.js";

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

    const holidays = await findHolidaysInDateRange(todayStart, todayEnd);
    if (holidays.length > 0) {
      const error = new Error(`Today is a holiday: ${holidays[0].name}`);
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

    if (existingAttendance && existingAttendance.checkInTime) {
      const error = new Error("Already checked in today");
      error.statusCode = 400;
      throw error;
    }

    let attendance;

    if (existingAttendance) {
      attendance = await Attendance.findByIdAndUpdate(
        existingAttendance._id,
        {
          checkInTime: now,
          markingMethod: "Self"
        },
        { new: true, runValidators: true, session }
      );
    } else {
      const { isLate, minutesLate } = checkIfLate(now);

      attendance = await Attendance.create(
        [
          {
            employeeId,
            date: today,
            checkInTime: now,
            markingMethod: "Self",
            isLateCheckIn: isLate,
            lateCheckInMinutes: minutesLate,
            status: "Present"
          }
        ],
        { session }
      );
      attendance = attendance[0];
    }

    await session.commitTransaction();

    const populatedAttendance = await Attendance.findById(attendance._id).populate([
      {
        path: "employeeId",
        select: "employeeId fullName email department"
      }
    ]);

    return normalizeAttendance(populatedAttendance);
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

    if (attendance.checkOutTime) {
      const error = new Error("Already checked out today");
      error.statusCode = 400;
      throw error;
    }

    if (!attendance.checkInTime) {
      const error = new Error("Cannot check-out before checking in");
      error.statusCode = 400;
      throw error;
    }

    if (now < attendance.checkInTime) {
      const error = new Error("Check-out time cannot be before check-in time");
      error.statusCode = 400;
      throw error;
    }

    const hoursWorked = calculateHoursWorked(attendance.checkInTime, now);

    const updatedAttendance = await Attendance.findByIdAndUpdate(
      attendance._id,
      {
        checkOutTime: now,
        hoursWorked
      },
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();

    const populatedAttendance = await Attendance.findById(updatedAttendance._id).populate([
      {
        path: "employeeId",
        select: "employeeId fullName email department"
      }
    ]);

    return normalizeAttendance(populatedAttendance);
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
  markingMethod
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await Employee.findById(employeeId).session(session);
    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    const adminUser = await employee.populate("userId");
    if (adminUser.userId?.role === "Admin") {
      const error = new Error("Cannot mark attendance for admin");
      error.statusCode = 403;
      throw error;
    }

    const parsedDate = new Date(date);
    if (isFutureDate(parsedDate)) {
      const error = new Error("Cannot mark attendance for future date");
      error.statusCode = 400;
      throw error;
    }

    const dateStr = date.split('T')[0];
    const dateStart = new Date(dateStr + 'T00:00:00.000Z');
    const dateEnd = new Date(dateStr + 'T23:59:59.999Z');

    const holidays = await findHolidaysInDateRange(dateStart, dateEnd);
    if (holidays.length > 0 && status !== "Holiday") {
      const error = new Error(`Cannot mark attendance - ${dateStr} is a holiday: ${holidays[0].name}`);
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

    const startOfDay = getStartOfDayIST(parsedDate);
    const endOfDay = getEndOfDayIST(parsedDate);

    let attendance = await Attendance.findOne(
      {
        employeeId,
        date: { $gte: startOfDay, $lte: endOfDay }
      },
      null,
      { session }
    );

    let hoursWorked = 0;
    if (checkInTime && checkOutTime) {
      const checkInDate = new Date(`${date}T${checkInTime}+05:30`);
      const checkOutDate = new Date(`${date}T${checkOutTime}+05:30`);
      
      if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        hoursWorked = calculateHoursWorked(checkInDate, checkOutDate);
      }
    }

    const updateData = {
      status,
      markedBy,
      markingMethod,
      hoursWorked
    };

    if (checkInTime) {
      const checkInDate = new Date(`${date}T${checkInTime}+05:30`);
      updateData.checkInTime = checkInDate;
    } else if (checkInTime === "") {
      updateData.checkInTime = null;
    }

    if (checkOutTime) {
      const checkOutDate = new Date(`${date}T${checkOutTime}+05:30`);
      updateData.checkOutTime = checkOutDate;
    } else if (checkOutTime === "") {
      updateData.checkOutTime = null;
    }

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
            ...updateData
          }
        ],
        { session }
      );
      attendance = attendance[0];
    }

    await session.commitTransaction();

    const populatedAttendance = await Attendance.findById(attendance._id).populate([
      {
        path: "employeeId",
        select: "employeeId fullName email department"
      },
      {
        path: "markedBy",
        select: "employeeId fullName"
      }
    ]);

    return normalizeAttendance(populatedAttendance);
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

    if (updateData.date && isFutureDate(updateData.date)) {
      const error = new Error("Cannot set attendance for future date");
      error.statusCode = 400;
      throw error;
    }

    const clearCheckIn = updateData.checkInTime === "";
    const clearCheckOut = updateData.checkOutTime === "";

    if (clearCheckIn) updateData.checkInTime = null;
    if (clearCheckOut) updateData.checkOutTime = null;

    let hoursWorked = 0;
    if (!clearCheckIn && !clearCheckOut) {
      let ci = updateData.checkInTime ?? attendance.checkInTime;
      let co = updateData.checkOutTime ?? attendance.checkOutTime;

      if (typeof ci === 'string') {
        ci = new Date(`${attendance.date.toISOString().split('T')[0]}T${ci}+05:30`);
        updateData.checkInTime = ci;
      }
      if (typeof co === 'string') {
        co = new Date(`${attendance.date.toISOString().split('T')[0]}T${co}+05:30`);
        updateData.checkOutTime = co;
      }

      if (ci && co) {
        if (co < ci) {
          const error = new Error("Check-out time cannot be before check-in time");
          error.statusCode = 400;
          throw error;
        }
        hoursWorked = calculateHoursWorked(ci, co);
      }
    }

    updateData.hoursWorked = hoursWorked;

    const updated = await Attendance.findByIdAndUpdate(
      attendanceId,
      updateData,
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();

    const populatedAttendance = await Attendance.findById(updated._id).populate([
      {
        path: "employeeId",
        select: "employeeId fullName email department"
      },
      {
        path: "markedBy",
        select: "employeeId fullName"
      }
    ]);

    return normalizeAttendance(populatedAttendance);
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const getAttendanceById = async (attendanceId) => {
  const attendance = await attendanceRepository.findAttendanceById(attendanceId);

  if (!attendance) {
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
  const { page, limit, employeeId, status, department, managerId, startDate, endDate, search } =
    filters;

  const result = await attendanceRepository.findAttendanceWithFilters({
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
  const employeeSummaries = await attendanceRepository.getAttendanceSummaryForDateRange(startDate, endDate, filters);

  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  const holidays = await findHolidaysInDateRange(start, end);
  const holidayDateSet = new Set(holidays.map(h => {
    const d = new Date(h.date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }));

  let weekendCount = 0;
  let holidayCount = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getUTCDay();
    const dateStr = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
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

export const deleteAttendanceRecord = async (attendanceId) => {
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

export const hasCheckedInToday = async (employeeId) => {
  const now = new Date();
  const attendance = await attendanceRepository.findAttendanceByEmployeeAndDate(employeeId, now);

  return {
    hasCheckedIn: !!attendance?.checkInTime,
    hasCheckedOut: !!attendance?.checkOutTime,
    attendance: attendance ? normalizeAttendance(attendance) : null
  };
};
