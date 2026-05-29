import { parseDateOnly } from "./date.util.js";

export const CLAIM_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled", "Reimbursed"];

export const CANCELLABLE_STATUSES = ["Pending", "Approved"];

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

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

  return attachments.map((attachment, index) => {
    const { fileName, mimeType, data } = attachment;

    if (!fileName || !mimeType || !data) {
      const error = new Error(`Attachment at index ${index} must include fileName, mimeType, and data`);
      error.statusCode = 400;
      throw error;
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      const error = new Error(
        `Attachment "${fileName}" has unsupported mime type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
      );
      error.statusCode = 400;
      throw error;
    }

    let buffer;

    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else if (typeof data === "string") {
      buffer = Buffer.from(data, "base64");

      if (buffer.length === 0 && data.length > 0) {
        const error = new Error(`Attachment "${fileName}" contains invalid base64 data`);
        error.statusCode = 400;
        throw error;
      }
    } else {
      const error = new Error(`Attachment "${fileName}" data must be a base64 string or Buffer`);
      error.statusCode = 400;
      throw error;
    }

    if (buffer.length === 0) {
      const error = new Error(`Attachment "${fileName}" cannot be empty`);
      error.statusCode = 400;
      throw error;
    }

    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      const error = new Error(
        `Attachment "${fileName}" exceeds maximum size of ${MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB`
      );
      error.statusCode = 400;
      throw error;
    }

    return {
      fileName: fileName.trim(),
      mimeType,
      size: buffer.length,
      data: buffer
    };
  });
};

export const parseExpenseDate = (expenseDate) => {
  return parseDateOnly(expenseDate);
};
