import mongoose from "mongoose";
import {
  normalizeSalaryStructure,
  normalizeSalaryStructureList
} from "../dtos/salary-structure.dto.js";
import * as salaryStructureRepository from "../repositories/salary-structure.repository.js";

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

const parsePageLimit = (queryParams) => ({
  page: Math.max(parseInt(queryParams.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100)
});

const ensureSalaryViewAccess = (requestingUser) => {
  if (requestingUser.role === "Employee") {
    throwError("You do not have permission to view salary structures", 403);
  }
};

const ensureSalaryManageAccess = (requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can manage salary structures", 403);
  }
};

const buildListQuery = async (filters, requestingUser) => {
  const query = {};

  if (filters.employee) {
    query.employeeId = new mongoose.Types.ObjectId(filters.employee);
  }

  if (filters.month) {
    query.effectiveMonth = parseInt(filters.month, 10);
  }

  if (filters.year) {
    query.effectiveYear = parseInt(filters.year, 10);
  }

  if (requestingUser.role === "Manager") {
    const teamIds = await salaryStructureRepository.getTeamEmployeeIds(requestingUser.employeeId);
    query.employeeId = {
      $in: [new mongoose.Types.ObjectId(requestingUser.employeeId), ...teamIds]
    };

    if (filters.employee) {
      const filterId = filters.employee.toString();
      const allowedIds = [requestingUser.employeeId, ...teamIds.map((id) => id.toString())];
      if (!allowedIds.includes(filterId)) {
        throwError("You do not have permission to view this employee salary structure", 403);
      }
      query.employeeId = new mongoose.Types.ObjectId(filterId);
    }
  }

  return query;
};

const validateSalaryPayload = (data, employmentType) => {
  if (employmentType === "Full-time") {
    if (!data.basic || data.basic <= 0) {
      throwError("Basic salary must be greater than 0 for full-time employees", 400);
    }
  }

  if (employmentType === "Contract") {
    if (!data.dailyAmount || data.dailyAmount <= 0) {
      throwError("Daily amount must be greater than 0 for contract employees", 400);
    }
  }
};

export const listSalaryStructures = async (filters, requestingUser) => {
  ensureSalaryViewAccess(requestingUser);

  const { page, limit } = parsePageLimit(filters);
  const query = await buildListQuery(filters, requestingUser);
  const result = await salaryStructureRepository.listSalaryStructures({ query, page, limit });

  return {
    totalCount: result.totalCount,
    currentPage: result.currentPage,
    totalPages: result.totalPages,
    data: normalizeSalaryStructureList(result.data)
  };
};

export const getSalaryStructuresByEmployee = async (employeeId, requestingUser) => {
  ensureSalaryViewAccess(requestingUser);
  validateObjectId(employeeId, "Employee ID");

  const employee = await salaryStructureRepository.findEmployeeById(employeeId);
  if (!employee) {
    throwError("Employee not found", 404);
  }

  if (requestingUser.role === "Manager") {
    const isOwn = employee._id.toString() === requestingUser.employeeId;
    const isTeam = employee.reportingManagerId?.toString() === requestingUser.employeeId;
    if (!isOwn && !isTeam) {
      throwError("You do not have permission to view this employee salary structure", 403);
    }
  }

  const structures = await salaryStructureRepository.findSalaryStructuresByEmployee(employeeId);
  return normalizeSalaryStructureList(structures);
};

export const createSalaryStructure = async (data, requestingUser) => {
  ensureSalaryManageAccess(requestingUser);
  validateObjectId(data.employeeId, "Employee ID");

  const employee = await salaryStructureRepository.findEmployeeById(data.employeeId);
  if (!employee || employee.status !== "Active") {
    throwError("Employee not found or inactive", 404);
  }

  if (employee.employmentType !== data.employmentType) {
    throwError("Employment type must match employee record", 400);
  }

  validateSalaryPayload(data, data.employmentType);

  try {
    const structure = await salaryStructureRepository.createSalaryStructure({
      employeeId: data.employeeId,
      employmentType: data.employmentType,
      effectiveMonth: data.effectiveMonth,
      effectiveYear: data.effectiveYear,
      basic: data.employmentType === "Full-time" ? data.basic : 0,
      houseRentAllowance: data.employmentType === "Full-time" ? data.houseRentAllowance || 0 : 0,
      specialAllowance: data.employmentType === "Full-time" ? data.specialAllowance || 0 : 0,
      pf: data.employmentType === "Full-time" ? data.pf ?? null : null,
      dailyAmount: data.employmentType === "Contract" ? data.dailyAmount : 0,
      createdBy: requestingUser.userId,
      updatedBy: requestingUser.userId
    });

    return normalizeSalaryStructure(structure);
  } catch (error) {
    if (error.code === 11000) {
      throwError("Salary structure already exists for this employee and effective month", 409);
    }
    throw error;
  }
};

export const updateSalaryStructure = async (id, data, requestingUser) => {
  ensureSalaryManageAccess(requestingUser);
  validateObjectId(id, "Salary structure ID");

  const existing = await salaryStructureRepository.findSalaryStructureById(id);
  if (!existing) {
    throwError("Salary structure not found", 404);
  }

  const employmentType = data.employmentType || existing.employmentType;
  validateSalaryPayload({ ...existing.toObject(), ...data }, employmentType);

  const updateData = {
    updatedBy: requestingUser.userId
  };

  if (data.basic !== undefined) updateData.basic = data.basic;
  if (data.houseRentAllowance !== undefined) updateData.houseRentAllowance = data.houseRentAllowance;
  if (data.specialAllowance !== undefined) updateData.specialAllowance = data.specialAllowance;
  if (data.pf !== undefined) updateData.pf = data.pf;
  if (data.dailyAmount !== undefined) updateData.dailyAmount = data.dailyAmount;

  const updated = await salaryStructureRepository.updateSalaryStructureById(id, updateData);
  return normalizeSalaryStructure(updated);
};
