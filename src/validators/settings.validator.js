import Joi from "joi";

export const updateCompanySettingsSchema = Joi.object({
  companyName: Joi.string().trim().max(200).required(),
  companyEmail: Joi.string().trim().email().max(200).required(),
  companyPhone: Joi.string().trim().max(20).allow("", null).default(""),
  companyLogo: Joi.string().trim().allow("", null).default(""),
  addressLine1: Joi.string().trim().max(200).allow("", null).default(""),
  addressLine2: Joi.string().trim().max(200).allow("", null).default(""),
  city: Joi.string().trim().max(100).allow("", null).default(""),
  state: Joi.string().trim().max(100).allow("", null).default(""),
  country: Joi.string().trim().max(100).allow("", null).default(""),
  postalCode: Joi.string().trim().max(20).allow("", null).default(""),
});
