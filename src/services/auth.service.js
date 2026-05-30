import { validateLoginDto } from "../dtos/login.dto.js";
import User from "../models/user.model.js";
import Tenant from "../models/tenant.model.js";
import * as employeeRepository from "../repositories/employee.repository.js";
import { generateToken } from "../utils/jwt.js";

const sanitizeUser = (user, employee = null, includeTenant = false) => {
  const data = {
    id: user._id,
    employeeId: employee ? employee._id.toString() : null,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };

  if (includeTenant) {
    data.tenantId = user.tenantId ? user.tenantId.toString() : null;
  }

  return data;
};

export const login = async (loginData) => {
  const { isValid, value, errors } = validateLoginDto(loginData);

  if (!isValid) {
    const error = new Error(errors.join(", "));
    error.statusCode = 400;
    throw error;
  }

  const { identifier, password } = value;
  const isEmail = identifier.includes("@");
  const query = isEmail ? { email: identifier.toLowerCase() } : { phoneNumber: identifier };
  const user = await User.findOne(query).select("+password");

  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error("User account is inactive");
    error.statusCode = 403;
    throw error;
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  if (user.role !== "SuperAdmin") {
    const tenant = await Tenant.findById(user.tenantId).select("status").lean();
    if (!tenant || tenant.status !== "Active") {
      const error = new Error("Your company account is inactive. Contact your administrator.");
      error.statusCode = 403;
      throw error;
    }
  }

  const employee = user.role !== "SuperAdmin" ? await employeeRepository.findEmployeeByUserId(user._id) : null;
  const token = generateToken(user, employee ? employee._id.toString() : null);

  return {
    token,
    user: sanitizeUser(user, employee, true)
  };
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).lean();

  if (!user || !user.isActive) {
    const error = new Error("User not found or inactive");
    error.statusCode = 404;
    throw error;
  }

  const employee = user.role !== "SuperAdmin" ? await employeeRepository.findEmployeeByUserId(user._id) : null;

  return sanitizeUser(user, employee, true);
};
