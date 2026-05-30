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
  companyPhone: Joi.string().trim().max(20).required().messages({
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
  companyPhone: Joi.string().trim().max(20).messages({
    "string.empty": "Company phone cannot be empty",
  }),
  status: Joi.string().valid("Active", "Inactive").messages({
    "any.only": "Status must be Active or Inactive",
  }),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

export const createTenantAdminSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
  email: Joi.string().trim().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters",
    "any.required": "Password is required",
  }),
});

export const updateTenantAdminSchema = Joi.object({
  name: Joi.string().trim().messages({
    "string.empty": "Name cannot be empty",
  }),
  isActive: Joi.boolean(),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});
