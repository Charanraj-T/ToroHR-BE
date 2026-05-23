export const normalizeEmployeeForLeave = (employee) => {
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

export const normalizeLeave = (leave) => {
  if (!leave) {
    return null;
  }

  return {
    id: leave._id,
    employee: normalizeEmployeeForLeave(leave.employeeId),
    leaveType: leave.leaveType,
    fromDate: leave.fromDate,
    toDate: leave.toDate,
    leaveDays: leave.leaveDays,
    dayType: leave.dayType,
    reason: leave.reason,
    status: leave.status,
    appliedBy: leave.appliedBy,
    approvedBy: leave.approvedBy,
    approvedAt: leave.approvedAt,
    rejectedBy: leave.rejectedBy,
    rejectedAt: leave.rejectedAt,
    rejectionReason: leave.rejectionReason,
    cancelledBy: leave.cancelledBy,
    cancelledAt: leave.cancelledAt,
    cancellationReason: leave.cancellationReason,
    createdAt: leave.createdAt,
    updatedAt: leave.updatedAt
  };
};

export const normalizeLeaveList = (leaves) => leaves.map(normalizeLeave);

export const normalizeLeaveBalance = (balance) => ({
  id: balance._id,
  employeeId: balance.employeeId,
  year: balance.year,
  CL: balance.CL,
  SL: balance.SL,
  PL: balance.PL,
  LOP: balance.LOP,
  lastResetAt: balance.lastResetAt,
  createdAt: balance.createdAt,
  updatedAt: balance.updatedAt
});
