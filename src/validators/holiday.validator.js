import Joi from "joi";

const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createHolidaySchema = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    "string.empty": "Holiday name is required",
    "string.max": "Holiday name cannot exceed 100 characters",
  }),
  date: Joi.string().pattern(dateStringRegex).required().messages({
    "string.pattern.base": "Date must be in YYYY-MM-DD format",
  }),
  description: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  isRecurringYearly: Joi.boolean().default(false).messages({
    "boolean.base": "isRecurringYearly must be a boolean",
  }),
});

export const updateHolidaySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).messages({
    "string.min": "Holiday name cannot be empty",
    "string.max": "Holiday name cannot exceed 100 characters",
  }),
  date: Joi.string().pattern(dateStringRegex).messages({
    "string.pattern.base": "Date must be in YYYY-MM-DD format",
  }),
  description: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
  isRecurringYearly: Joi.boolean().messages({
    "boolean.base": "isRecurringYearly must be a boolean",
  }),
}).min(1);

export const listHolidaysSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  year: Joi.number().integer().min(1900).max(2100).allow("").empty(""),
  search: Joi.string().trim().allow("").empty(""),
  upcoming: Joi.boolean().default(false),
});

export const getHolidayByIdSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export const deleteHolidaySchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});
