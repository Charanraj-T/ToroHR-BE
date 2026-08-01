import mongoose from "mongoose";
import User from "../models/user.model.js";
import Employee from "../models/employee.model.js";
import { validateCreateEmployeeDto, validateUpdateEmployeeDto } from "../dtos/employee.dto.js";
import * as employeeRepository from "../repositories/employee.repository.js";
import { getTenantUserIds } from "../utils/tenant.util.js";
import { processFileBuffer } from "../utils/file.util.js";
import { escapeRegex, throwError, validateObjectId } from "../utils/http.util.js";

const normalizeModifiedBy = (modifiedBy) => {
  if (!modifiedBy) return null;
  if (typeof modifiedBy === "object" && modifiedBy._id) {
    return { id: modifiedBy._id, name: modifiedBy.name };
  }
  return { id: modifiedBy.toString(), name: null };
};

const normalizeDocumentMetadata = (document) => {
  if (!document) {
    return null;
  }

  return {
    id: document._id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size
  };
};

const normalizeEmployee = (employee, { includeSensitive = true, includeDocuments = false } = {}) => {
  const data = {
    id: employee._id,
    user: employee.userId,
    fullName: employee.fullName,
    email: employee.email,
    countryCode: employee.countryCode,
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
    nationality: employee.nationality,
    address: employee.address,
    education: employee.education,
    modifiedBy: normalizeModifiedBy(employee.modifiedBy),
    modifiedAt: employee.modifiedAt,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
    documents: (employee.documents || []).map((doc) =>
      includeDocuments
        ? {
            ...normalizeDocumentMetadata(doc),
            data: doc.data?.toString("base64") || null
          }
        : normalizeDocumentMetadata(doc)
    )
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

const ensureSameTenant = (employee, requestingUser) => {
  if (requestingUser?.tenantId && employee?.tenantId?.toString() !== requestingUser.tenantId) {
    throwError("Employee not found", 404);
  }
};

const validateReportingManager = async (reportingManagerId, requestingUser = null) => {
  if (!reportingManagerId) {
    return null;
  }

  validateObjectId(reportingManagerId, "Reporting manager ID");

  const manager = await employeeRepository.findEmployeeById(reportingManagerId);

  if (!manager) {
    throwError("Reporting manager not found", 400);
  }

  if (requestingUser?.tenantId && manager.tenantId?.toString() !== requestingUser.tenantId) {
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
  await validateReportingManager(value.reportingManagerId, requestingUser);

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
            countryCode: value.countryCode,
            phoneNumber: value.phoneNumber,
            password: value.password,
            role: value.role,
            tenantId: requestingUser?.tenantId || null,
            isActive: value.status === "Active"
          }
        ],
        { session }
      );

      const documents = (value.documents || []).map(
        (doc) => processFileBuffer(doc)
      );

      const [employee] = await employeeRepository.createEmployee(
        {
          userId: user._id,
          tenantId: requestingUser?.tenantId || null,
          fullName: value.fullName,
          email: value.email,
          countryCode: value.countryCode,
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
          nationality: value.nationality,
          address: value.address,
          education: value.education,
          accountNumber: value.accountNumber,
          ifscCode: value.ifscCode,
          branchName: value.branchName,
          bankName: value.bankName,
          panNumber: value.panNumber,
          aadhaarNumber: value.aadhaarNumber,
          documents,
          modifiedBy: requestingUser?.userId || user._id,
          modifiedAt: new Date()
        },
        session
      );

      createdEmployee = employee;
    });

    const employee = await employeeRepository.findEmployeeById(createdEmployee._id);
    return normalizeEmployee(employee, { includeDocuments: true });
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

export const getEmployeeById = async (id, requestingUser = null) => {
  validateObjectId(id, "Employee ID");

  const employee = await employeeRepository.findEmployeeById(id);

  if (!employee) {
    throwError("Employee not found", 404);
  }

  ensureSameTenant(employee, requestingUser);

  return normalizeEmployee(employee, { includeDocuments: true });
};

export const updateEmployee = async (id, employeeData, requestingUser = null) => {
  validateObjectId(id, "Employee ID");

  const value = validateUpdateEmployeeDto(employeeData);
  const employee = await employeeRepository.findEmployeeById(id);

  if (!employee) {
    throwError("Employee not found", 404);
  }

  ensureSameTenant(employee, requestingUser);

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
  await validateReportingManager(value.reportingManagerId, requestingUser);

  const session = await mongoose.startSession();

  try {
    let updatedEmployee;

    await session.withTransaction(async () => {
      const employeeUpdates = { ...value };
      delete employeeUpdates.password;

      if (value.documents) {
        const currentDocs = employee.documents || [];
        const processed = [];

        for (const doc of value.documents) {
          if (doc.id) {
            const existing = currentDocs.find(
              (d) => d._id.toString() === doc.id
            );

            if (existing) {
              processed.push(existing);
            }
          } else {
            processed.push(processFileBuffer(doc));
          }
        }

        employeeUpdates.documents = processed;
      }

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

      const user = await User.findById(employee.userId._id).select("+password role").session(session);

      const userUpdates = {};

      if (value.fullName) userUpdates.name = value.fullName;
      if (value.email) userUpdates.email = value.email.toLowerCase();
      if (value.countryCode !== undefined) userUpdates.countryCode = value.countryCode;
      if (value.phoneNumber) userUpdates.phoneNumber = value.phoneNumber;
      if (value.password) userUpdates.password = value.password;
      if (value.role && user.role !== "Admin") userUpdates.role = value.role;
      if (value.status) userUpdates.isActive = value.status === "Active";

      if (Object.keys(userUpdates).length > 0) {
        Object.assign(user, userUpdates);
        await user.save({ session });
      }
    });

    return normalizeEmployee(updatedEmployee, { includeDocuments: true });
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

  ensureSameTenant(employee, requestingUser);

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

export const getManagersPayrollAccess = async (queryParams, tenantId = null) => {
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const matchStage = { status: "Active" };

  if (tenantId) {
    matchStage.tenantId = new mongoose.Types.ObjectId(tenantId);
  }

  if (queryParams.search?.trim()) {
    const search = escapeRegex(queryParams.search.trim());
    matchStage.$or = [
      { employeeId: { $regex: search, $options: "i" } },
      { fullName: { $regex: search, $options: "i" } }
    ];
  }

  const pipeline = [
    { $match: matchStage },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.role": "Manager" } },
    { $sort: { fullName: 1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 1, employeeId: 1, fullName: 1, payrollAccess: 1, "user.name": 1, "user.email": 1 } }
        ],
        totalCount: [{ $count: "count" }]
      }
    }
  ];

  const [result] = await Employee.aggregate(pipeline);
  const totalCount = result.totalCount[0]?.count || 0;

  return {
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit) || 1,
    data: result.data.map((emp) => ({
      id: emp._id,
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      name: emp.user?.name || "",
      email: emp.user?.email || "",
      payrollAccess: emp.payrollAccess
    }))
  };
};

export const toggleManagerPayrollAccess = async (employeeId, requestingUser = null) => {
  validateObjectId(employeeId, "Employee ID");

  const employee = await employeeRepository.findEmployeeById(employeeId);

  if (!employee) {
    throwError("Employee not found", 404);
  }

  ensureSameTenant(employee, requestingUser);

  if (!employee.userId || employee.userId.role !== "Manager") {
    throwError("Payroll access can only be toggled for managers", 400);
  }

  const updated = await employeeRepository.togglePayrollAccess(employeeId);

  return {
    id: updated._id,
    employeeId: updated.employeeId,
    fullName: updated.fullName,
    payrollAccess: updated.payrollAccess
  };
};
