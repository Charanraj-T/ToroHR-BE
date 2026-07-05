import Joi from "joi";
import { ALLOWED_MIME_TYPES } from "../utils/file.util.js";

const documentItemSchema = Joi.object({
  id: Joi.string().hex().length(24),
  fileName: Joi.string().trim().min(1).max(255),
  mimeType: Joi.string().valid(...ALLOWED_MIME_TYPES),
  data: Joi.string().base64({ paddingRequired: false })
});

const createEmployeeSchema = Joi.object({
  fullName: Joi.string().trim().max(60).required(),
  email: Joi.string().email().max(254).required(),
  phoneNumber: Joi.string().trim().length(10).pattern(/^[6-9]\d{9}$/).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("Manager", "Employee").required(),
  dateOfBirth: Joi.date().required(),
  joiningDate: Joi.date().required(),
  designation: Joi.string().trim().required(),
  department: Joi.string().trim().required(),
  reportingManagerId: Joi.string().hex().length(24).allow(null, ""),
  employmentType: Joi.string().valid("Full-time", "Contract").required(),
  status: Joi.string().valid("Active", "Inactive").default("Active"),
  accountNumber: Joi.string().trim().allow("", null),
  ifscCode: Joi.string().trim().allow("", null),
  branchName: Joi.string().trim().allow("", null),
  bankName: Joi.string().trim().allow("", null),
  panNumber: Joi.string().trim().allow("", null),
  aadhaarNumber: Joi.string().trim().allow("", null),
  nationality: Joi.string().trim().allow("", null),
  address: Joi.object({
    line1: Joi.string().trim().allow("", null),
    line2: Joi.string().trim().allow("", null),
    city: Joi.string().trim().allow("", null),
    state: Joi.string().trim().allow("", null),
    country: Joi.string().trim().allow("", null),
    postalCode: Joi.string().trim().allow("", null)
  }).allow(null),
  education: Joi.array().items(Joi.object({
    degree: Joi.string().trim().allow("", null),
    duration: Joi.string().trim().allow("", null),
    institute: Joi.string().trim().allow("", null),
    grade: Joi.string().trim().allow("", null)
  })),
  documents: Joi.array().items(documentItemSchema).default([])
});

const updateEmployeeSchema = Joi.object({
  fullName: Joi.string().trim().max(60),
  email: Joi.string().email().max(254),
  phoneNumber: Joi.string().trim().length(10).pattern(/^[6-9]\d{9}$/),
  password: Joi.string().min(6),
  role: Joi.string().valid("Manager", "Employee"),
  dateOfBirth: Joi.date(),
  joiningDate: Joi.date(),
  designation: Joi.string().trim(),
  department: Joi.string().trim(),
  reportingManagerId: Joi.string().hex().length(24).allow(null, ""),
  employmentType: Joi.string().valid("Full-time", "Contract"),
  status: Joi.string().valid("Active", "Inactive"),
  accountNumber: Joi.string().trim().allow("", null),
  ifscCode: Joi.string().trim().allow("", null),
  branchName: Joi.string().trim().allow("", null),
  bankName: Joi.string().trim().allow("", null),
  panNumber: Joi.string().trim().allow("", null),
  aadhaarNumber: Joi.string().trim().allow("", null),
  nationality: Joi.string().trim().allow("", null),
  address: Joi.object({
    line1: Joi.string().trim().allow("", null),
    line2: Joi.string().trim().allow("", null),
    city: Joi.string().trim().allow("", null),
    state: Joi.string().trim().allow("", null),
    country: Joi.string().trim().allow("", null),
    postalCode: Joi.string().trim().allow("", null)
  }).allow(null),
  education: Joi.array().items(Joi.object({
    degree: Joi.string().trim().allow("", null),
    duration: Joi.string().trim().allow("", null),
    institute: Joi.string().trim().allow("", null),
    grade: Joi.string().trim().allow("", null)
  })),
  documents: Joi.array().items(documentItemSchema)
}).min(1);

const validateDto = (schema, data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationError = new Error(error.details.map((detail) => detail.message).join(", "));
    validationError.statusCode = 400;
    throw validationError;
  }

  return value;
};

export const validateCreateEmployeeDto = (data) => validateDto(createEmployeeSchema, data);

export const validateUpdateEmployeeDto = (data) => validateDto(updateEmployeeSchema, data);
