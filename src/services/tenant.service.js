import mongoose from "mongoose";
import User from "../models/user.model.js";
import * as tenantRepository from "../repositories/tenant.repository.js";
import * as settingsRepository from "../repositories/settings.repository.js";
import * as payrollSettingsRepository from "../repositories/payroll-settings.repository.js";
import { normalizeTenant, normalizeTenantList } from "../dtos/tenant.dto.js";

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

export const createTenant = async (data) => {
  const tenant = await tenantRepository.createTenant({
    companyName: data.companyName,
    companyEmail: data.companyEmail,
    companyPhone: data.companyPhone,
    status: data.status || "Active",
  });

  await settingsRepository.createCompanySettings({
    tenantId: tenant._id,
    companyName: data.companyName,
    companyEmail: data.companyEmail,
    companyPhone: data.companyPhone,
  });

  await payrollSettingsRepository.createPayrollSettings(tenant._id);

  return normalizeTenant(tenant);
};

export const listTenants = async ({ page = 1, limit = 20, search } = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const result = await tenantRepository.findAllTenants({
    page: validPage,
    limit: validLimit,
    search,
  });

  const data = await Promise.all(
    result.data.map(async (tenant) => {
      const adminCount = await tenantRepository.countTenantAdmins(tenant._id);
      return { ...normalizeTenant(tenant), adminCount };
    })
  );

  return {
    data,
    total: result.total,
    page: result.page,
    limit: result.limit,
    pages: result.pages,
  };
};

export const getTenantById = async (id) => {
  validateObjectId(id, "Tenant ID");

  const tenant = await tenantRepository.findTenantById(id);
  if (!tenant) {
    throwError("Tenant not found", 404);
  }

  const adminCount = await tenantRepository.countTenantAdmins(tenant._id);

  return { ...normalizeTenant(tenant), adminCount };
};

export const updateTenant = async (id, data) => {
  validateObjectId(id, "Tenant ID");

  const tenant = await tenantRepository.findTenantById(id);
  if (!tenant) {
    throwError("Tenant not found", 404);
  }

  const updated = await tenantRepository.updateTenantById(id, data);

  if (data.companyName || data.companyEmail || data.companyPhone) {
    const updateData = {};
    if (data.companyName) updateData.companyName = data.companyName;
    if (data.companyEmail) updateData.companyEmail = data.companyEmail;
    if (data.companyPhone) updateData.companyPhone = data.companyPhone;
    await settingsRepository.updateCompanySettings({ tenantId: id, ...updateData });
  }

  return normalizeTenant(updated);
};

export const getTenantAdmins = async (tenantId) => {
  validateObjectId(tenantId, "Tenant ID");

  const admins = await User.find({ tenantId, role: "Admin" })
    .select("name email isActive createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return admins.map((admin) => ({
    id: admin._id,
    name: admin.name,
    email: admin.email,
    isActive: admin.isActive,
    createdAt: admin.createdAt,
  }));
};

export const createTenantAdmin = async (tenantId, data) => {
  validateObjectId(tenantId, "Tenant ID");

  const tenant = await tenantRepository.findTenantById(tenantId);
  if (!tenant) {
    throwError("Tenant not found", 404);
  }

  const existingUser = await User.findOne({ email: data.email.toLowerCase() });
  if (existingUser) {
    throwError("A user with this email already exists", 409);
  }

  const admin = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    role: "Admin",
    tenantId,
    isActive: true,
  });

  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    isActive: admin.isActive,
    createdAt: admin.createdAt,
  };
};

export const updateTenantAdmin = async (tenantId, adminId, data) => {
  validateObjectId(tenantId, "Tenant ID");
  validateObjectId(adminId, "Admin ID");

  const admin = await User.findOne({ _id: adminId, tenantId, role: "Admin" });
  if (!admin) {
    throwError("Admin not found", 404);
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await User.findByIdAndUpdate(adminId, { $set: updateData }, { new: true })
    .select("name email isActive createdAt")
    .lean();

  return {
    id: updated._id,
    name: updated.name,
    email: updated.email,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
  };
};

export const getTenantsForSuperAdmin = async (user) => {
  if (user.role !== "SuperAdmin") {
    throwError("Only SuperAdmin can access tenants", 403);
  }
  return listTenants();
};
