import Joi from "joi";
import { PAYROLL_STATUSES } from "../utils/payroll.util.js";

const objectId = Joi.string().hex().length(24);

export const updatePayrollSettingsSchema = Joi.object({
  payrollGenerationDay: Joi.number().integer().min(1).max(28),
  defaultPF: Joi.number().min(0)
}).min(1);

export const createSalaryStructureSchema = Joi.object({
  employeeId: objectId.required(),
  employmentType: Joi.string().valid("Full-time", "Contract").required(),
  effectiveMonth: Joi.number().integer().min(1).max(12).required(),
  effectiveYear: Joi.number().integer().min(2000).max(2100).required(),
  basic: Joi.when("employmentType", {
    is: "Full-time",
    then: Joi.number().positive().required(),
    otherwise: Joi.number().min(0).optional()
  }),
  houseRentAllowance: Joi.when("employmentType", {
    is: "Full-time",
    then: Joi.number().min(0).default(0),
    otherwise: Joi.forbidden()
  }),
  specialAllowance: Joi.when("employmentType", {
    is: "Full-time",
    then: Joi.number().min(0).default(0),
    otherwise: Joi.forbidden()
  }),
  pf: Joi.when("employmentType", {
    is: "Full-time",
    then: Joi.number().min(0).allow(null),
    otherwise: Joi.forbidden()
  }),
  dailyAmount: Joi.when("employmentType", {
    is: "Contract",
    then: Joi.number().positive().required(),
    otherwise: Joi.forbidden()
  })
});

export const updateSalaryStructureSchema = createSalaryStructureSchema.fork(
  ["employeeId", "employmentType", "effectiveMonth", "effectiveYear"],
  (schema) => schema.optional()
);

export const generatePayrollSchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required()
});

export const regeneratePayrollSchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required()
});

export const listPayrollSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  month: Joi.number().integer().min(1).max(12).allow("").empty(""),
  year: Joi.number().integer().min(2000).max(2100).allow("").empty(""),
  employee: objectId.allow("").empty(""),
  status: Joi.string()
    .valid(...PAYROLL_STATUSES)
    .allow("")
    .empty("")
});

export const listSalaryStructureSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  employee: objectId.allow("").empty(""),
  month: Joi.number().integer().min(1).max(12).allow("").empty(""),
  year: Joi.number().integer().min(2000).max(2100).allow("").empty("")
});
