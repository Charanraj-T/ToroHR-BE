import mongoose from "mongoose";
import { normalizeClaim, normalizeClaimList, normalizeClaimSummary } from "../dtos/claim.dto.js";
import * as claimRepository from "../repositories/claim.repository.js";
import { getTenantEmployeeIds } from "../utils/tenant.util.js";
import { getEndOfDay, parseDateOnly } from "../utils/date.util.js";
import {
  CANCELLABLE_STATUSES,
  normalizeAttachments,
  parseExpenseDate,
  validateClaimAccess,
  validateTransition
} from "../utils/claim.util.js";

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateObjectId = (id, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throwError(`${label} is invalid`, 400);
  }
};

const parsePageLimit = (queryParams) => ({
  page: Math.max(parseInt(queryParams.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100)
});

const ensureEmployeeExists = async (employeeId, session = null) => {
  validateObjectId(employeeId, "Employee ID");

  const employee = await claimRepository.findEmployeeById(employeeId, session);

  if (!employee || employee.status !== "Active") {
    throwError("Employee not found or inactive", 404);
  }

  return employee;
};

const ensureClaimViewAccess = (requestingUser, claim) => {
  if (!validateClaimAccess(requestingUser, claim.employeeId)) {
    throwError("You do not have permission to access this claim", 403);
  }
};

const ensureOwnPendingEditAccess = (requestingUser, claim) => {
  if (claim.status !== "Pending") {
    throwError("Only pending claims can be edited", 400);
  }

  const employeeId = claim.employeeId._id?.toString() || claim.employeeId.toString();

  if (employeeId !== requestingUser.employeeId) {
    throwError("You can only edit your own pending claims", 403);
  }
};

const ensureApprovalAccess = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return;
  }

  if (requestingUser.role === "Manager") {
    const isOwnClaim = employee._id.toString() === requestingUser.employeeId;

    if (isOwnClaim) {
      throwError("Managers cannot approve or reject their own claims", 403);
    }

    const isTeamMember = employee.reportingManagerId?.toString() === requestingUser.employeeId;

    if (isTeamMember) {
      return;
    }
  }

  throwError("You do not have permission to approve or reject this claim", 403);
};

const ensureCancellationAccess = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return;
  }

  if (requestingUser.role === "Manager") {
    const isOwnClaim = employee._id.toString() === requestingUser.employeeId;
    const isTeamMember = employee.reportingManagerId?.toString() === requestingUser.employeeId;

    if (isOwnClaim || isTeamMember) {
      return;
    }
  }

  if (requestingUser.role === "Employee" && employee._id.toString() === requestingUser.employeeId) {
    return;
  }

  throwError("You do not have permission to cancel this claim", 403);
};

const ensureReimbursementAccess = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return;
  }

  if (requestingUser.role === "Manager") {
    const isOwnClaim = employee._id.toString() === requestingUser.employeeId;
    const isTeamMember = employee.reportingManagerId?.toString() === requestingUser.employeeId;

    if (isOwnClaim || isTeamMember) {
      return;
    }
  }

  throwError("You do not have permission to mark this claim as reimbursed", 403);
};

const buildVisibilityQuery = async (requestingUser) => {
  if (requestingUser.role === "Admin") {
    if (requestingUser.tenantId) {
      const employeeIds = await getTenantEmployeeIds(requestingUser.tenantId);
      return {
        employeeId: { $in: employeeIds.map(id => new mongoose.Types.ObjectId(id)) }
      };
    }
    return {};
  }

  if (requestingUser.role === "Manager") {
    const teamIds = await claimRepository.getTeamEmployeeIds(requestingUser.employeeId);
    return {
      employeeId: {
        $in: [new mongoose.Types.ObjectId(requestingUser.employeeId), ...teamIds]
      }
    };
  }

  return { employeeId: new mongoose.Types.ObjectId(requestingUser.employeeId) };
};

const applyFilters = async (query, filters) => {
  if (filters.search) {
    const searchRegex = new RegExp(escapeRegex(filters.search), "i");
    const employees = await mongoose.model("Employee").find({
      $or: [
        { fullName: searchRegex },
        { employeeId: searchRegex }
      ]
    }).select("_id").lean();
    const ids = employees.map(e => e._id);
    if (ids.length > 0) {
      query.employeeId = query.employeeId
        ? { $in: [query.employeeId, ...ids] }
        : { $in: ids };
    } else {
      query._id = null;
    }
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.dateFrom || filters.dateTo) {
    const dateFrom = filters.dateFrom ? parseDateOnly(filters.dateFrom) : null;
    const dateTo = filters.dateTo ? getEndOfDay(parseDateOnly(filters.dateTo)) : null;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throwError("dateFrom cannot be after dateTo", 400);
    }

    if (dateFrom || dateTo) {
      query.expenseDate = {};

      if (dateFrom) {
        query.expenseDate.$gte = dateFrom;
      }

      if (dateTo) {
        query.expenseDate.$lte = dateTo;
      }
    }
  }

  return query;
};

const mergeEmployeeVisibility = (baseQuery, filterQuery) => {
  if (!baseQuery.employeeId || !filterQuery.employeeId) {
    return { ...baseQuery, ...filterQuery };
  }

  return {
    ...baseQuery,
    ...filterQuery,
    $and: [{ employeeId: baseQuery.employeeId }, { employeeId: filterQuery.employeeId }]
  };
};

export const createClaim = async (claimData, requestingUser) => {
  if (requestingUser.role === "Admin") {
    throwError("Admins cannot create claims", 403);
  }

  if (!requestingUser.employeeId) {
    throwError("Only employees can create claims", 403);
  }

  await ensureEmployeeExists(requestingUser.employeeId);

  const expenseDate = parseExpenseDate(claimData.expenseDate);
  const attachments = normalizeAttachments(claimData.attachments);

  const claim = await claimRepository.createClaim({
    employeeId: requestingUser.employeeId,
    name: claimData.name,
    amount: claimData.amount,
    expenseDate,
    description: claimData.description || "",
    attachments,
    modifiedBy: requestingUser.userId,
    modifiedAt: new Date()
  });

  return normalizeClaim(claim);
};

export const getClaims = async (filters, requestingUser) => {
  const { page, limit } = parsePageLimit(filters);
  const visibilityQuery = await buildVisibilityQuery(requestingUser);
  const filterQuery = await applyFilters({}, filters);
  const query = mergeEmployeeVisibility(visibilityQuery, filterQuery);

  const result = await claimRepository.listClaims({ query, page, limit });

  return {
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: normalizeClaimList(result.data)
  };
};

export const getClaimById = async (claimId, requestingUser) => {
  validateObjectId(claimId, "Claim ID");

  const claim = await claimRepository.findClaimById(claimId);

  if (!claim) {
    throwError("Claim not found", 404);
  }

  ensureClaimViewAccess(requestingUser, claim);

  return normalizeClaim(claim, { includeAttachmentData: true });
};

export const updateClaim = async (claimId, claimData, requestingUser) => {
  validateObjectId(claimId, "Claim ID");

  const existing = await claimRepository.findClaimById(claimId);

  if (!existing) {
    throwError("Claim not found", 404);
  }

  ensureOwnPendingEditAccess(requestingUser, existing);

  const expenseDate = parseExpenseDate(claimData.expenseDate);
  const attachments = normalizeAttachments(claimData.attachments);

  const updatedClaim = await claimRepository.updateClaimById(claimId, {
    name: claimData.name,
    amount: claimData.amount,
    expenseDate,
    description: claimData.description || "",
    attachments
  });

  return normalizeClaim(updatedClaim);
};

export const approveClaim = async (claimId, requestingUser) => {
  validateObjectId(claimId, "Claim ID");

  const claim = await claimRepository.findClaimById(claimId);

  if (!claim) {
    throwError("Claim not found", 404);
  }

  ensureApprovalAccess(requestingUser, claim.employeeId);

  const transition = validateTransition(claim.status, "Approved");

  if (!transition.valid) {
    throwError(transition.message, 400);
  }

  const updatedClaim = await claimRepository.updateClaimStatus(claimId, {
    status: "Approved",
    modifiedBy: requestingUser.userId,
    modifiedAt: new Date()
  });

  return normalizeClaim(updatedClaim);
};

export const rejectClaim = async (claimId, requestingUser) => {
  validateObjectId(claimId, "Claim ID");

  const claim = await claimRepository.findClaimById(claimId);

  if (!claim) {
    throwError("Claim not found", 404);
  }

  ensureApprovalAccess(requestingUser, claim.employeeId);

  const transition = validateTransition(claim.status, "Rejected");

  if (!transition.valid) {
    throwError(transition.message, 400);
  }

  const updatedClaim = await claimRepository.updateClaimStatus(claimId, {
    status: "Rejected",
    modifiedBy: requestingUser.userId,
    modifiedAt: new Date()
  });

  return normalizeClaim(updatedClaim);
};

export const cancelClaim = async (claimId, requestingUser) => {
  validateObjectId(claimId, "Claim ID");

  const claim = await claimRepository.findClaimById(claimId);

  if (!claim) {
    throwError("Claim not found", 404);
  }

  if (!CANCELLABLE_STATUSES.includes(claim.status)) {
    throwError(`Claims with status "${claim.status}" cannot be cancelled`, 400);
  }

  ensureCancellationAccess(requestingUser, claim.employeeId);

  const transition = validateTransition(claim.status, "Cancelled");

  if (!transition.valid) {
    throwError(transition.message, 400);
  }

  const updatedClaim = await claimRepository.updateClaimStatus(claimId, {
    status: "Cancelled",
    modifiedBy: requestingUser.userId,
    modifiedAt: new Date()
  });

  return normalizeClaim(updatedClaim);
};

export const reimburseClaim = async (claimId, requestingUser) => {
  validateObjectId(claimId, "Claim ID");

  const claim = await claimRepository.findClaimById(claimId);

  if (!claim) {
    throwError("Claim not found", 404);
  }

  ensureReimbursementAccess(requestingUser, claim.employeeId);

  const transition = validateTransition(claim.status, "Reimbursed");

  if (!transition.valid) {
    throwError(transition.message, 400);
  }

  const updatedClaim = await claimRepository.updateClaimStatus(claimId, {
    status: "Reimbursed",
    modifiedBy: requestingUser.userId,
    modifiedAt: new Date()
  });

  return normalizeClaim(updatedClaim);
};

const ensureDeleteAccess = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return;
  }

  if (requestingUser.role === "Manager") {
    const isOwnClaim = employee._id.toString() === requestingUser.employeeId;
    const isTeamMember = employee.reportingManagerId?.toString() === requestingUser.employeeId;

    if (isOwnClaim || isTeamMember) {
      return;
    }
  }

  if (requestingUser.role === "Employee" && employee._id.toString() === requestingUser.employeeId) {
    return;
  }

  throwError("You do not have permission to delete this claim", 403);
};

export const deleteClaim = async (claimId, requestingUser) => {
  validateObjectId(claimId, "Claim ID");

  const claim = await claimRepository.findClaimById(claimId);

  if (!claim) {
    throwError("Claim not found", 404);
  }

  if (claim.status !== "Cancelled" && claim.status !== "Rejected") {
    throwError(`Only cancelled or rejected claims can be deleted. Current status: "${claim.status}"`, 400);
  }

  ensureDeleteAccess(requestingUser, claim.employeeId);

  await claimRepository.deleteClaimById(claimId);

  return { id: claimId };
};

export const getClaimSummary = async (requestingUser) => {
  const visibilityQuery = await buildVisibilityQuery(requestingUser);
  const summary = await claimRepository.getClaimSummary(visibilityQuery);

  return normalizeClaimSummary(summary);
};
