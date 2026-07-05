import Joi from "joi";
import { getTodayIST } from "../utils/date.util.js";

const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

const getTodayStr = () => {
  const d = getTodayIST();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

export const checkInSchema = Joi.object({});

export const checkOutSchema = Joi.object({});

export const markAttendanceSchema = Joi.object({
  employeeId: Joi.string().hex().length(24).required(),
  date: Joi.string()
    .pattern(dateStringRegex)
    .required()
    .custom((value, helpers) => {
      if (value > getTodayStr()) {
        return helpers.message("Cannot mark attendance for a future date");
      }
      return value;
    })
    .messages({
      "string.pattern.base": "Date must be in YYYY-MM-DD format"
    }),
  status: Joi.string().valid("Present", "Absent", "Leave", "Weekend", "Half-day", "Holiday").required(),
  checkInTime: Joi.string().allow(null, ""),
  checkOutTime: Joi.string().allow(null, ""),

  markingMethod: Joi.string()
    .valid("Admin Override", "Manager Override")
    .allow(null)
});

export const updateAttendanceSchema = Joi.object({
  status: Joi.string().valid("Present", "Absent", "Leave", "Weekend", "Half-day", "Holiday"),
  checkInTime: Joi.string().allow(null, ""),
  checkOutTime: Joi.string().allow(null, ""),

  hoursWorked: Joi.number().min(0).allow(null)
}).min(1);

export const getAttendanceFiltersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid("Present", "Absent", "Leave", "Weekend", "Half-day", "Holiday").allow(""),
  department: Joi.string().allow(""),
  managerId: Joi.string().hex().length(24).allow(""),
  startDate: Joi.string().pattern(dateStringRegex).allow(""),
  endDate: Joi.string().pattern(dateStringRegex).allow(""),
  search: Joi.string().trim().allow("")
});

export const exportAttendanceSchema = Joi.object({
  startDate: Joi.string().pattern(dateStringRegex).required(),
  endDate: Joi.string().pattern(dateStringRegex).required(),
  employeeId: Joi.string().hex().length(24),
  department: Joi.string(),
  managerId: Joi.string().hex().length(24),
  status: Joi.string().valid("Present", "Absent", "Leave", "Weekend", "Half-day", "Holiday")
});

// Normalize attendance response
export const normalizeAttendance = (attendance) => {
  if (!attendance) return null;

  return {
    id: attendance._id,
    employeeId: attendance.employee || attendance.employeeId,
    date: attendance.date,
    checkInTime: attendance.checkInTime,
    checkOutTime: attendance.checkOutTime,
    hoursWorked: attendance.hoursWorked,
    status: attendance.status,
    markedBy: attendance.markedBy,
    markingMethod: attendance.markingMethod,
    isLateCheckIn: attendance.isLateCheckIn,
    lateCheckInMinutes: attendance.lateCheckInMinutes,
    createdAt: attendance.createdAt,
    updatedAt: attendance.updatedAt
  };
};

export const normalizeAttendanceList = (attendances) => {
  return attendances.map(normalizeAttendance);
};
