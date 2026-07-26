import Joi from "joi";

export const updateCompanySettingsSchema = Joi.object({
  companyName: Joi.string().trim().max(200).allow(""),
  companyEmail: Joi.string().trim().email().max(200).allow(""),
  companyCountryCode: Joi.string().trim().max(6).allow("", null).default(""),
  companyPhone: Joi.string().trim().min(5).max(15).pattern(/^\d{5,15}$/).allow("", null).default(""),
  companyLogo: Joi.string().trim().allow("", null).default(""),
  addressLine1: Joi.string().trim().max(200).allow("", null).default(""),
  addressLine2: Joi.string().trim().max(200).allow("", null).default(""),
  city: Joi.string().trim().max(100).allow("", null).default(""),
  state: Joi.string().trim().max(100).allow("", null).default(""),
  country: Joi.string().trim().max(100).allow("", null).default(""),
  postalCode: Joi.string().trim().max(20).allow("", null).default(""),
});
