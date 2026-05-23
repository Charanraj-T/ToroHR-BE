import Joi from "joi";
import { HALF_DAY_PERIODS, LEAVE_DAY_TYPES, LEAVE_STATUSES, LEAVE_TYPES } from "../utils/leave.util.js";

const objectId = Joi.string().hex().length(24);
const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createLeaveSchema = Joi.object({
  leaveType: Joi.string().valid(...LEAVE_TYPES).required(),
  fromDate: Joi.string().pattern(dateStringRegex).required().messages({
    "string.pattern.base": "From date must be in YYYY-MM-DD format"
  }),
  toDate: Joi.string().pattern(dateStringRegex).required().messages({
    "string.pattern.base": "To date must be in YYYY-MM-DD format"
  }),
  dayType: Joi.string().valid(...LEAVE_DAY_TYPES).default("Full-day"),
  halfDayPeriod: Joi.when("dayType", {
    is: "Half-day",
    then: Joi.string().valid(...HALF_DAY_PERIODS).required(),
    otherwise: Joi.string().valid(...HALF_DAY_PERIODS).allow(null, "").optional()
  }),
  reason: Joi.string().trim().max(500).allow("", null)
});

export const listLeaveSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  employee: objectId.allow("").empty(""),
  leaveType: Joi.string().valid(...LEAVE_TYPES).allow("").empty(""),
  dayType: Joi.string().valid(...LEAVE_DAY_TYPES).allow("").empty(""),
  status: Joi.string().valid(...LEAVE_STATUSES).allow("").empty(""),
  manager: objectId.allow("").empty(""),
  startDate: Joi.string().pattern(dateStringRegex).allow("").empty(""),
  endDate: Joi.string().pattern(dateStringRegex).allow("").empty(""),
  search: Joi.string().trim().allow("").empty("")
});

export const rejectLeaveSchema = Joi.object({
  rejectionReason: Joi.string().trim().max(500).allow("", null)
});

export const cancelLeaveSchema = Joi.object({
  cancellationReason: Joi.string().trim().max(500).allow("", null)
});
