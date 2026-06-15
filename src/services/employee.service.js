import mongoose from "mongoose";
import User from "../models/user.model.js";
import { validateCreateEmployeeDto, validateUpdateEmployeeDto } from "../dtos/employee.dto.js";
import * as employeeRepository from "../repositories/employee.repository.js";
import { getTenantUserIds } from "../utils/tenant.util.js";

const normalizeModifiedBy = (modifiedBy) => {
  if (!modifiedBy) return null;
  if (typeof modifiedBy === "object" && modifiedBy._id) {
    return { id: modifiedBy._id, name: modifiedBy.name };
  }
  return { id: modifiedBy.toString(), name: null };
};

const normalizeEmployee = (employee, { includeSensitive = true } = {}) => {
  const data = {
    id: employee._id,
    user: employee.userId,
    fullName: employee.fullName,
    email: employee.email,
    phoneNumber: employee.phoneNumber,
    dateOfBirth: employee.dateOfBirth,
    employeeId: employee.employeeId,
    role: employee.role,
    joiningDate: employee.joiningDate,
    designation: employee.designation,
    department: employee.department,
    reportingManager: employee.reportingManagerId,
    employmentType: employee.employmentType,
    status: employee.status,
    modifiedBy: normalizeModifiedBy(employee.modifiedBy),
    modifiedAt: employee.modifiedAt,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt
  };

  if (includeSensitive) {
    data.accountNumber = employee.accountNumber;
    data.ifscCode = employee.ifscCode;
    data.branchName = employee.branchName;
    data.bankName = employee.bankName;
    data.panNumber = employee.panNumber;
    data.aadhaarNumber = employee.aadhaarNumber;
  }

  return data;
};

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validateObjectId = (id, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throwError(`${label} is invalid`, 400);
  }
};

const validateReportingManager = async (reportingManagerId) => {
  if (!reportingManagerId) {
    return null;
  }

  validateObjectId(reportingManagerId, "Reporting manager ID");

  const manager = await employeeRepository.findEmployeeById(reportingManagerId);

  if (!manager) {
    throwError("Reporting manager not found", 400);
  }

  if (!manager.userId || manager.userId.role !== "Manager") {
    throwError("Reporting manager must have Manager role", 400);
  }

  if (manager.status !== "Active" || manager.userId.isActive !== true) {
    throwError("Reporting manager must be active", 400);
  }

  return reportingManagerId;
};

const ensureManagerHasNoActiveReports = async (employeeId) => {
  const activeReports = await employeeRepository.countActiveEmployeesByManager(employeeId);

  if (activeReports > 0) {
    throwError("Employee has active reporting employees. Reassign them before changing role or deactivating", 400);
  }
};

const ensureUniqueEmployeeFields = async ({ email, phoneNumber }, ignoredIds = {}) => {
  const [userByEmail, userByPhone, employeeByEmail, employeeByPhone] = await Promise.all([
    email ? User.findOne({ email: email.toLowerCase() }) : null,
    phoneNumber ? User.findOne({ phoneNumber }) : null,
    email ? employeeRepository.findEmployeeByEmail(email) : null,
    phoneNumber ? employeeRepository.findEmployeeByPhone(phoneNumber) : null
  ]);

  const isDifferentUser = (user) => user && user._id.toString() !== ignoredIds.userId;
  const isDifferentEmployee = (employee) => employee && employee._id.toString() !== ignoredIds.employeeId;

  if (isDifferentUser(userByEmail)) {
    throwError("Email already exists", 409);
  }

  if (isDifferentUser(userByPhone)) {
    throwError("Phone number already exists", 409);
  }

  if (isDifferentEmployee(employeeByEmail)) {
    throwError("Employee email already exists", 409);
  }

  if (isDifferentEmployee(employeeByPhone)) {
    throwError("Employee phone number already exists", 409);
  }
};

export const createEmployee = async (employeeData, requestingUser = null) => {
  const value = validateCreateEmployeeDto(employeeData);

  await ensureUniqueEmployeeFields(value);
  await validateReportingManager(value.reportingManagerId);

  const session = await mongoose.startSession();

  try {
    let createdEmployee;

    await session.withTransaction(async () => {
      const employeeId = await employeeRepository.generateEmployeeId(session);

      const [user] = await User.create(
        [
          {
            name: value.fullName,
            email: value.email,
            phoneNumber: value.phoneNumber,
            password: value.password,
            role: value.role,
            tenantId: requestingUser?.tenantId || null,
            isActive: value.status === "Active"
          }
        ],
        { session }
      );

      const [employee] = await employeeRepository.createEmployee(
        {
          userId: user._id,
          fullName: value.fullName,
          email: value.email,
          phoneNumber: value.phoneNumber,
          dateOfBirth: value.dateOfBirth,
          employeeId,
          role: value.role,
          joiningDate: value.joiningDate,
          designation: value.designation,
          department: value.department,
          reportingManagerId: value.reportingManagerId || null,
          employmentType: value.employmentType,
          status: value.status,
          accountNumber: value.accountNumber,
          ifscCode: value.ifscCode,
          branchName: value.branchName,
          bankName: value.bankName,
          panNumber: value.panNumber,
          aadhaarNumber: value.aadhaarNumber,
          modifiedBy: requestingUser?.userId || user._id,
          modifiedAt: new Date()
        },
        session
      );

      createdEmployee = employee;
    });

    const employee = await employeeRepository.findEmployeeById(createdEmployee._id);
    return normalizeEmployee(employee);
  } finally {
    session.endSession();
  }
};

export const getEmployees = async (queryParams) => {
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 10, 1), 100);
  const query = {};

  if (queryParams.tenantId) {
    const userIds = await getTenantUserIds(queryParams.tenantId);
    query.userId = { $in: userIds };
  }

  if (queryParams.status && !["Active", "Inactive"].includes(queryParams.status)) {
    throwError("Status must be Active or Inactive", 400);
  }

  if (queryParams.role && !["Manager", "Employee"].includes(queryParams.role)) {
    throwError("Role must be Manager or Employee", 400);
  }

  if (queryParams.manager) {
    validateObjectId(queryParams.manager, "Manager ID");
  }

  if (queryParams.search?.trim()) {
    query.$text = { $search: queryParams.search.trim() };
  }

  if (queryParams.department) {
    query.department = queryParams.department;
  }

  if (queryParams.manager) {
    query.reportingManagerId = queryParams.manager;
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  if (queryParams.role) {
    query.role = queryParams.role;
  }

  const result = await employeeRepository.listEmployees({ query, page, limit });

  return {
    ...result,
    data: result.data.map((employee) => normalizeEmployee(employee, { includeSensitive: false }))
  };
};

export const getEmployeeById = async (id) => {
  validateObjectId(id, "Employee ID");

  const employee = await employeeRepository.findEmployeeById(id);

  if (!employee) {
    throwError("Employee not found", 404);
  }

  return normalizeEmployee(employee);
};

export const updateEmployee = async (id, employeeData, requestingUser = null) => {
  validateObjectId(id, "Employee ID");

  const value = validateUpdateEmployeeDto(employeeData);
  const employee = await employeeRepository.findEmployeeById(id);

  if (!employee) {
    throwError("Employee not found", 404);
  }

  if (value.reportingManagerId && value.reportingManagerId === id) {
    throwError("Employee cannot be their own reporting manager", 400);
  }

  if (value.role === "Employee" || value.status === "Inactive") {
    await ensureManagerHasNoActiveReports(id);
  }

  await ensureUniqueEmployeeFields(value, {
    employeeId: employee._id.toString(),
    userId: employee.userId._id.toString()
  });
  await validateReportingManager(value.reportingManagerId);

  const session = await mongoose.startSession();

  try {
    let updatedEmployee;

    await session.withTransaction(async () => {
      const employeeUpdates = { ...value };
      delete employeeUpdates.password;

      if (value.email) {
        employeeUpdates.email = value.email.toLowerCase();
      }

      if (value.reportingManagerId === "") {
        employeeUpdates.reportingManagerId = null;
      }

      updatedEmployee = await employeeRepository.updateEmployeeById(id, {
        ...employeeUpdates,
        modifiedBy: requestingUser?.userId,
        modifiedAt: new Date()
      }, session);

      const userUpdates = {};

      if (value.fullName) userUpdates.name = value.fullName;
      if (value.email) userUpdates.email = value.email.toLowerCase();
      if (value.phoneNumber) userUpdates.phoneNumber = value.phoneNumber;
      if (value.password) userUpdates.password = value.password;
      if (value.role) userUpdates.role = value.role;
      if (value.status) userUpdates.isActive = value.status === "Active";

      if (Object.keys(userUpdates).length > 0) {
        const user = await User.findById(employee.userId._id).select("+password").session(session);
        Object.assign(user, userUpdates);
        await user.save({ session });
      }
    });

    return normalizeEmployee(updatedEmployee);
  } finally {
    session.endSession();
  }
};

export const deleteEmployee = async (id, requestingUser = null) => {
  validateObjectId(id, "Employee ID");

  const employee = await employeeRepository.findEmployeeById(id);

  if (!employee) {
    throwError("Employee not found", 404);
  }

  await ensureManagerHasNoActiveReports(id);

  const session = await mongoose.startSession();

  try {
    let updatedEmployee;

    await session.withTransaction(async () => {
      updatedEmployee = await employeeRepository.updateEmployeeById(id, {
        status: "Inactive",
        modifiedBy: requestingUser?.userId,
        modifiedAt: new Date()
      }, session);
      await User.findByIdAndUpdate(employee.userId._id, { isActive: false }, { session });
    });

    return normalizeEmployee(updatedEmployee);
  } finally {
    session.endSession();
  }
};

export const getEmployeeStats = async (managerId = null, tenantId = null) => {
  return await employeeRepository.getStats(managerId, tenantId);
};
