import mongoose from "mongoose";
import { normalizeLeave, normalizeLeaveBalance, normalizeLeaveList } from "../dtos/leave.dto.js";
import * as leaveRepository from "../repositories/leave.repository.js";
import { findHolidaysInDateRange } from "../repositories/holiday.repository.js";
import {
  calculateLeaveDays,
  getBalanceUpdateForReversal,
  getLeaveYear,
  getStartOfDay,
  getWorkingDatesBetween,
  parseDateOnly
} from "../utils/leave.util.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const validateDateRange = (fromDate, toDate, dayType = "Full-day") => {
  const from = parseDateOnly(fromDate);
  const to = parseDateOnly(toDate);

  if (from > to) {
    throwError("From date cannot be after to date", 400);
  }

  if (dayType === "Half-day" && from.getTime() !== to.getTime()) {
    throwError("Half-day leave must start and end on the same date", 400);
  }

  const leaveDays = calculateLeaveDays(from, to, dayType);

  if (leaveDays <= 0) {
    throwError("Leave request must include at least one working day", 400);
  }

  return { from, to, leaveDays };
};

const ensureEmployeeExists = async (employeeId, session = null) => {
  validateObjectId(employeeId, "Employee ID");

  const employee = await leaveRepository.findEmployeeById(employeeId, session);

  if (!employee || employee.status !== "Active") {
    throwError("Employee not found or inactive", 404);
  }

  return employee;
};

const canAccessEmployee = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return true;
  }

  if (employee._id.toString() === requestingUser.employeeId) {
    return true;
  }

  return (
    requestingUser.role === "Manager" &&
    employee.reportingManagerId?.toString() === requestingUser.employeeId
  );
};

const ensureLeaveAccess = (requestingUser, leave) => {
  const employee = leave.employeeId;

  if (!canAccessEmployee(requestingUser, employee)) {
    throwError("You do not have permission to access this leave request", 403);
  }
};

const ensureApprovalAccess = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return;
  }

  if (requestingUser.role === "Manager") {
    const isOwnLeave = employee._id.toString() === requestingUser.employeeId;
    if (isOwnLeave) {
      throwError("Managers cannot approve or reject their own leave", 403);
    }

    const isTeamMember = employee.reportingManagerId?.toString() === requestingUser.employeeId;
    if (isTeamMember) {
      return;
    }
  }

  throwError("You do not have permission to approve or reject this leave", 403);
};

const ensureCancellationAccess = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return;
  }

  if (requestingUser.role === "Manager") {
    const isOwnLeave = employee._id.toString() === requestingUser.employeeId;
    const isTeamMember = employee.reportingManagerId?.toString() === requestingUser.employeeId;

    if (isOwnLeave || isTeamMember) {
      return;
    }
  }

  if (requestingUser.role === "Employee" && employee._id.toString() === requestingUser.employeeId) {
    return;
  }

  throwError("You do not have permission to cancel this leave", 403);
};

const validateBalanceForApproval = async (leave, session = null) => {
  const year = getLeaveYear(leave.fromDate);
  const balance = await leaveRepository.getOrCreateLeaveBalance(leave.employeeId._id || leave.employeeId, year, session);

  if (leave.leaveType !== "LOP" && balance[leave.leaveType] < leave.leaveDays) {
    throwError(`Insufficient ${leave.leaveType} balance`, 400);
  }

  return { balance, year };
};

const buildVisibilityQuery = async (requestingUser) => {
  if (requestingUser.role === "Admin") {
    return {};
  }

  if (requestingUser.role === "Manager") {
    const teamIds = await leaveRepository.getTeamEmployeeIds(requestingUser.employeeId);
    return {
      employeeId: {
        $in: [new mongoose.Types.ObjectId(requestingUser.employeeId), ...teamIds]
      }
    };
  }

  return { employeeId: new mongoose.Types.ObjectId(requestingUser.employeeId) };
};

const applyFilters = async (query, filters) => {
  if (filters.employee) {
    query.employeeId = new mongoose.Types.ObjectId(filters.employee);
  }

  if (filters.leaveType) {
    query.leaveType = filters.leaveType;
  }

  if (filters.dayType) {
    query.dayType = filters.dayType;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    const startDate = filters.startDate ? getStartOfDay(parseDateOnly(filters.startDate)) : null;
    const endDate = filters.endDate ? getStartOfDay(parseDateOnly(filters.endDate)) : null;

    if (startDate && endDate && startDate > endDate) {
      throwError("Start date cannot be after end date", 400);
    }

    if (endDate) {
      query.fromDate = { $lte: endDate };
    }

    if (startDate) {
      query.toDate = { $gte: startDate };
    }
  }

  if (filters.search) {
    const escapedSearch = escapeRegex(filters.search);
    const employeeIds = await leaveRepository.findEmployeeIdsBySearch(escapedSearch);
    const searchRegex = new RegExp(escapedSearch, "i");

    query.$or = [
      { reason: searchRegex },
      { rejectionReason: searchRegex },
      { cancellationReason: searchRegex },
      { employeeId: { $in: employeeIds } }
    ];
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
    $and: [
      { employeeId: baseQuery.employeeId },
      { employeeId: filterQuery.employeeId }
    ]
  };
};

export const applyLeave = async (leaveData, requestingUser) => {
  if (!requestingUser.employeeId) {
    throwError("Only employees can apply leave", 403);
  }

  const dayType = leaveData.dayType || "Full-day";
  const { from, to, leaveDays } = validateDateRange(leaveData.fromDate, leaveData.toDate, dayType);
  let session;

  try {
    session = await mongoose.startSession();
    let createdLeave;

    await session.withTransaction(async () => {
      await ensureEmployeeExists(requestingUser.employeeId, session);

      const overlaps = await leaveRepository.hasOverlappingLeave({
        employeeId: requestingUser.employeeId,
        fromDate: from,
        toDate: to,
        session
      });

      if (overlaps) {
        throwError("Leave request overlaps with an existing pending or approved leave", 409);
      }

      const holidaysInRange = await findHolidaysInDateRange(from, to);
      if (holidaysInRange.length > 0) {
        const names = holidaysInRange.map(h => h.name).join(", ");
        throwError(`Selected date range includes a holiday: ${names}`, 400);
      }

      const attendanceConflict = await leaveRepository.hasAttendanceConflict({
        employeeId: requestingUser.employeeId,
        fromDate: from,
        toDate: to,
        dayType,
        session
      });

      if (attendanceConflict) {
        throwError(
          `Cannot apply leave: attendance already marked as "${attendanceConflict.status}" on ${attendanceConflict.date.toISOString().split('T')[0]}`,
          400
        );
      }

      createdLeave = await leaveRepository.createLeave(
        {
          employeeId: requestingUser.employeeId,
          leaveType: leaveData.leaveType,
          fromDate: from,
          toDate: to,
          leaveDays,
          dayType,
          reason: leaveData.reason || "",
          appliedBy: requestingUser.userId
        },
        session
      );
    });

    const leave = await leaveRepository.findLeaveById(createdLeave._id);
    return normalizeLeave(leave);
  } finally {
    if (session) session.endSession();
  }
};

export const getLeaves = async (filters, requestingUser) => {
  const { page, limit } = parsePageLimit(filters);
  const visibilityQuery = await buildVisibilityQuery(requestingUser);
  let filterQuery = await applyFilters({}, filters);

  if (filters.manager && requestingUser.role !== "Manager") {
    const teamIds = await leaveRepository.getTeamEmployeeIds(filters.manager);
    filterQuery.employeeId = { $in: teamIds };
  }

  const query = mergeEmployeeVisibility(visibilityQuery, filterQuery);
  const result = await leaveRepository.listLeaves({ query, page, limit });

  return {
    total: result.total,
    currentPage: result.currentPage,
    totalPages: result.totalPages,
    data: normalizeLeaveList(result.data)
  };
};

export const getLeaveById = async (leaveId, requestingUser) => {
  validateObjectId(leaveId, "Leave ID");

  const leave = await leaveRepository.findLeaveById(leaveId);

  if (!leave) {
    throwError("Leave request not found", 404);
  }

  ensureLeaveAccess(requestingUser, leave);

  return normalizeLeave(leave);
};

export const approveLeave = async (leaveId, requestingUser) => {
  validateObjectId(leaveId, "Leave ID");

  let session;

  try {
    session = await mongoose.startSession();
    let updatedLeave;

    await session.withTransaction(async () => {
      const leave = await leaveRepository.findLeaveById(leaveId, session);

      if (!leave) {
        throwError("Leave request not found", 404);
      }

      ensureApprovalAccess(requestingUser, leave.employeeId);

      if (leave.status === "Approved") {
        throwError("Leave request is already approved", 400);
      }

      if (leave.status === "Cancelled") {
        throwError("Cancelled leave cannot be approved", 400);
      }

      const overlaps = await leaveRepository.hasOverlappingLeave({
        employeeId: leave.employeeId._id,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        ignoredLeaveId: leave._id,
        session
      });

      if (overlaps) {
        throwError("Leave request overlaps with another pending or approved leave", 409);
      }

      const { year } = await validateBalanceForApproval(leave, session);
      const updatedBalance = await leaveRepository.applyLeaveBalanceApproval(
        leave.employeeId._id,
        year,
        leave.leaveType,
        leave.leaveDays,
        session
      );

      if (!updatedBalance) {
        throwError(`Insufficient ${leave.leaveType} balance`, 400);
      }

      const holidaysInRange = await findHolidaysInDateRange(leave.fromDate, leave.toDate);
      const dates = getWorkingDatesBetween(leave.fromDate, leave.toDate, holidaysInRange.map(h => h.date));
      await leaveRepository.markAttendanceAsLeave({
        employeeId: leave.employeeId._id,
        dates,
        dayType: leave.dayType,
        markedBy: requestingUser.employeeId || null,
        markingMethod: requestingUser.role === "Admin" ? "Admin Override" : "Manager Override",
        session
      });

      updatedLeave = await leaveRepository.updateLeaveById(
        leaveId,
        {
          status: "Approved",
          approvedBy: requestingUser.userId,
          approvedAt: new Date(),
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: ""
        },
        session
      );
    });

    return normalizeLeave(updatedLeave);
  } finally {
    if (session) session.endSession();
  }
};

export const rejectLeave = async (leaveId, rejectData, requestingUser) => {
  validateObjectId(leaveId, "Leave ID");

  let session;

  try {
    session = await mongoose.startSession();
    let updatedLeave;

    await session.withTransaction(async () => {
      const leave = await leaveRepository.findLeaveById(leaveId, session);

      if (!leave) {
        throwError("Leave request not found", 404);
      }

      ensureApprovalAccess(requestingUser, leave.employeeId);

      if (leave.status === "Approved") {
        throwError("Approved leave must be cancelled instead of rejected", 400);
      }

      if (leave.status === "Cancelled") {
        throwError("Cancelled leave cannot be rejected", 400);
      }

      updatedLeave = await leaveRepository.updateLeaveById(
        leaveId,
        {
          status: "Rejected",
          rejectedBy: requestingUser.userId,
          rejectedAt: new Date(),
          rejectionReason: rejectData.rejectionReason || "",
          approvedBy: null,
          approvedAt: null
        },
        session
      );
    });

    return normalizeLeave(updatedLeave);
  } finally {
    if (session) session.endSession();
  }
};

export const cancelLeave = async (leaveId, cancelData, requestingUser) => {
  validateObjectId(leaveId, "Leave ID");

  let session;

  try {
    session = await mongoose.startSession();
    let updatedLeave;

    await session.withTransaction(async () => {
      const leave = await leaveRepository.findLeaveById(leaveId, session);

      if (!leave) {
        throwError("Leave request not found", 404);
      }

      ensureCancellationAccess(requestingUser, leave.employeeId);

      if (leave.status === "Cancelled") {
        throwError("Leave request is already cancelled", 400);
      }

      if (leave.status === "Rejected") {
        throwError("Rejected leave cannot be cancelled", 400);
      }

      if (leave.status === "Approved") {
        const year = getLeaveYear(leave.fromDate);
        await leaveRepository.updateLeaveBalance(
          leave.employeeId._id,
          year,
          getBalanceUpdateForReversal(leave.leaveType, leave.leaveDays),
          session
        );

        const holidaysInRange = await findHolidaysInDateRange(leave.fromDate, leave.toDate);
        const dates = getWorkingDatesBetween(leave.fromDate, leave.toDate, holidaysInRange.map(h => h.date));
        await leaveRepository.clearLeaveAttendance({
          employeeId: leave.employeeId._id,
          dates,
          session
        });
      }

      updatedLeave = await leaveRepository.updateLeaveById(
        leaveId,
        {
          status: "Cancelled",
          cancelledBy: requestingUser.userId,
          cancelledAt: new Date(),
          cancellationReason: cancelData.cancellationReason || ""
        },
        session
      );
    });

    return normalizeLeave(updatedLeave);
  } finally {
    if (session) session.endSession();
  }
};

export const getMyLeaves = async (filters, requestingUser) => {
  if (!requestingUser.employeeId) {
    return { total: 0, currentPage: 1, totalPages: 1, data: [] };
  }

  return getLeaves({ ...filters, employee: requestingUser.employeeId }, requestingUser);
};

export const updateLeave = async (leaveId, leaveData, requestingUser) => {
  validateObjectId(leaveId, "Leave ID");

  const dayType = leaveData.dayType || "Full-day";
  const { from, to, leaveDays } = validateDateRange(leaveData.fromDate, leaveData.toDate, dayType);
  let session;

  try {
    session = await mongoose.startSession();
    let updatedLeave;

    await session.withTransaction(async () => {
      const existing = await leaveRepository.findLeaveById(leaveId, session);

      if (!existing) {
        throwError("Leave request not found", 404);
      }

      if (existing.status !== "Pending") {
        throwError("Only pending leave requests can be edited", 400);
      }

      const canEdit =
        requestingUser.role === "Admin" ||
        existing.employeeId?._id?.toString() === requestingUser.employeeId ||
        existing.appliedBy?.toString() === requestingUser.userId;

      if (!canEdit) {
        throwError("You do not have permission to edit this leave request", 403);
      }

      const overlaps = await leaveRepository.hasOverlappingLeave({
        employeeId: existing.employeeId._id || existing.employeeId,
        fromDate: from,
        toDate: to,
        ignoredLeaveId: existing._id,
        session
      });

      if (overlaps) {
        throwError("Updated leave request overlaps with an existing pending or approved leave", 409);
      }

      const holidaysInRange = await findHolidaysInDateRange(from, to);
      if (holidaysInRange.length > 0) {
        const names = holidaysInRange.map(h => h.name).join(", ");
        throwError(`Selected date range includes a holiday: ${names}`, 400);
      }

      const attendanceConflict = await leaveRepository.hasAttendanceConflict({
        employeeId: existing.employeeId._id || existing.employeeId,
        fromDate: from,
        toDate: to,
        dayType,
        session
      });

      if (attendanceConflict) {
        throwError(
          `Cannot update leave: attendance already marked as "${attendanceConflict.status}" on ${attendanceConflict.date.toISOString().split('T')[0]}`,
          400
        );
      }

      const updateData = {
        leaveType: leaveData.leaveType,
        fromDate: from,
        toDate: to,
        leaveDays,
        dayType,
        reason: leaveData.reason || ""
      };

      updatedLeave = await leaveRepository.updateLeaveById(leaveId, updateData, session);
    });

    return normalizeLeave(updatedLeave);
  } finally {
    if (session) session.endSession();
  }
};

export const getMyLeaveBalance = async (requestingUser) => {
  if (!requestingUser.employeeId) {
    return null;
  }

  const balance = await leaveRepository.getOrCreateLeaveBalance(
    requestingUser.employeeId,
    new Date().getUTCFullYear()
  );

  return normalizeLeaveBalance(balance);
};


