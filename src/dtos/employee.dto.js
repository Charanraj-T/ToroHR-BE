import Joi from "joi";

const createEmployeeSchema = Joi.object({
  fullName: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().trim().required(),
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
  aadhaarNumber: Joi.string().trim().allow("", null)
});

const updateEmployeeSchema = Joi.object({
  fullName: Joi.string().trim(),
  email: Joi.string().email(),
  phoneNumber: Joi.string().trim(),
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
  aadhaarNumber: Joi.string().trim().allow("", null)
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
