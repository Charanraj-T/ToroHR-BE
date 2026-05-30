import User from "../models/user.model.js";
import Employee from "../models/employee.model.js";

export const getTenantEmployeeIds = async (tenantId) => {
  const users = await User.find({ tenantId }).select("_id").lean();
  const userIds = users.map((u) => u._id);
  const employees = await Employee.find({ userId: { $in: userIds } })
    .select("_id")
    .lean();
  return employees.map((e) => e._id);
};

export const getTenantUserIds = async (tenantId) => {
  const users = await User.find({ tenantId }).select("_id").lean();
  return users.map((u) => u._id);
};
