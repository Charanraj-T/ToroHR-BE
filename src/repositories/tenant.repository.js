import Tenant from "../models/tenant.model.js";

export const createTenant = async (data) => {
  const [tenant] = await Tenant.create([data]);
  return tenant;
};

export const findAllTenants = async ({ page, limit, search }) => {
  const query = {};

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { companyName: searchRegex },
      { companyEmail: searchRegex },
      { companyPhone: searchRegex },
    ];
  }

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
