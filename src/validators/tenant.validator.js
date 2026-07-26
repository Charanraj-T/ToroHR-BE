import Joi from "joi";

export const createTenantSchema = Joi.object({
  companyName: Joi.string().trim().max(200).required().messages({
    "string.empty": "Company name is required",
    "any.required": "Company name is required",
  }),
  companyEmail: Joi.string().trim().email().max(200).required().messages({
    "string.empty": "Company email is required",
    "string.email": "Company email must be a valid email",
    "any.required": "Company email is required",
  }),
  companyCountryCode: Joi.string().trim().max(6).allow("").default(""),
  companyPhone: Joi.string().trim().min(5).max(15).pattern(/^\d{5,15}$/).required().messages({
    "string.empty": "Company phone is required",
    "any.required": "Company phone is required",
  }),
  status: Joi.string()
    .valid("Active", "Inactive")
    .default("Active")
    .messages({
      "any.only": "Status must be Active or Inactive",
    }),
});

export const updateTenantSchema = Joi.object({
  companyName: Joi.string().trim().max(200).messages({
    "string.empty": "Company name cannot be empty",
  }),
  companyEmail: Joi.string().trim().email().max(200).messages({
    "string.email": "Company email must be a valid email",
  }),
  companyCountryCode: Joi.string().trim().max(6).allow(""),
  companyPhone: Joi.string().trim().min(5).max(15).pattern(/^\d{5,15}$/),
  status: Joi.string().valid("Active", "Inactive").messages({
    "any.only": "Status must be Active or Inactive",
  }),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

export const createTenantAdminSchema = Joi.object({
  name: Joi.string().trim().max(60).required().messages({
    "string.empty": "Name is required",
    "string.max": "Name cannot exceed 60 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().trim().email().max(254).required().messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email",
    "string.max": "Email cannot exceed 254 characters",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters",
    "any.required": "Password is required",
  }),
});

export const updateTenantAdminSchema = Joi.object({
  name: Joi.string().trim().max(60).messages({
    "string.empty": "Name cannot be empty",
    "string.max": "Name cannot exceed 60 characters",
  }),
  isActive: Joi.boolean(),
  password: Joi.string().min(6).max(128).messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must not exceed 128 characters",
  }),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});
