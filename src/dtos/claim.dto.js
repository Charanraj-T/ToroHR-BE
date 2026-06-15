const normalizeEmployeeForClaim = (employee) => {
  if (!employee) {
    return null;
  }

  return {
    id: employee._id,
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department,
    designation: employee.designation,
    reportingManagerId: employee.reportingManagerId
  };
};

const normalizeUserRef = (user) => {
  if (!user) {
    return null;
  }

  if (typeof user._id === 'undefined') {
    return null;
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };
};

const normalizeAttachmentMetadata = (attachment) => {
  if (!attachment) {
    return null;
  }

  return {
    id: attachment._id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size
  };
};

export const normalizeClaim = (claim, { includeAttachmentData = false } = {}) => {
  if (!claim) {
    return null;
  }

  const mod = normalizeUserRef(claim.modifiedBy);

  const normalized = {
    id: claim._id,
    employee: normalizeEmployeeForClaim(claim.employeeId),
    name: claim.name,
    amount: claim.amount,
    expenseDate: claim.expenseDate,
    description: claim.description,
    status: claim.status,
    attachments: (claim.attachments || []).map((attachment) =>
      includeAttachmentData
        ? {
            ...normalizeAttachmentMetadata(attachment),
            data: attachment.data?.toString("base64") || null
          }
        : normalizeAttachmentMetadata(attachment)
    ),
    modifiedBy: mod ? { id: mod.id, name: mod.name } : null,
    modifiedAt: claim.modifiedAt || null,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt
  };

  return normalized;
};

export const normalizeClaimList = (claims) => claims.map((claim) => normalizeClaim(claim));

export const normalizeClaimSummary = (summary) => ({
  Pending: summary.Pending || 0,
  Approved: summary.Approved || 0,
  Rejected: summary.Rejected || 0,
  Reimbursed: summary.Reimbursed || 0
});
