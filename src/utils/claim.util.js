import { processFileBuffer } from "./file.util.js";
import { parseDateOnly } from "./date.util.js";

export const CLAIM_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled", "Reimbursed"];

export const CANCELLABLE_STATUSES = ["Pending", "Approved"];

export const MAX_ATTACHMENTS = 5;

const ALLOWED_TRANSITIONS = {
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: ["Cancelled", "Reimbursed"],
  Rejected: [],
  Cancelled: [],
  Reimbursed: []
};

export const validateTransition = (currentStatus, nextStatus) => {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      message: `Cannot transition claim from "${currentStatus}" to "${nextStatus}"`
    };
  }

  return { valid: true };
};

export const validateClaimAccess = (requestingUser, employee) => {
  if (requestingUser.role === "Admin") {
    return true;
  }

  const employeeId = employee._id?.toString() || employee.toString();

  if (employeeId === requestingUser.employeeId) {
    return true;
  }

  if (
    requestingUser.role === "Manager" &&
    employee.reportingManagerId?.toString() === requestingUser.employeeId
  ) {
    return true;
  }

  return false;
};

export const normalizeAttachments = (attachments = []) => {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  if (attachments.length > MAX_ATTACHMENTS) {
    const error = new Error(`A maximum of ${MAX_ATTACHMENTS} attachments is allowed`);
    error.statusCode = 400;
    throw error;
  }

  return attachments.map((attachment) => processFileBuffer(attachment));
};

export const parseExpenseDate = (expenseDate) => {
  return parseDateOnly(expenseDate);
};
