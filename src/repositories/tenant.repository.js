import Tenant from "../models/tenant.model.js";

export const createTenant = async (data) => {
  const [tenant] = await Tenant.create([data]);
  return tenant;
};

export const findAllTenants = async ({ page, limit }) => {
  const query = {};

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Tenant.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Tenant.countDocuments(query),
  ]);

  return {
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
};

export const findTenantById = async (id) => {
  return Tenant.findById(id).lean();
};

export const updateTenantById = async (id, data) => {
  return Tenant.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean();
};

export const countTenantAdmins = async (tenantId) => {
  const User = (await import("../models/user.model.js")).default;
  return User.countDocuments({ tenantId, role: "Admin" });
};

export const countAdminsForTenants = async (tenantIds) => {
  const User = (await import("../models/user.model.js")).default;
  const results = await User.aggregate([
    { $match: { tenantId: { $in: tenantIds }, role: "Admin" } },
    { $group: { _id: "$tenantId", count: { $sum: 1 } } },
  ]);
  return results;
};
