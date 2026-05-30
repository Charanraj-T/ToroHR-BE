import * as tenantService from "../services/tenant.service.js";
import {
  createTenantSchema,
  updateTenantSchema,
  createTenantAdminSchema,
  updateTenantAdminSchema,
} from "../validators/tenant.validator.js";

const validate = (schema, payload, next) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const err = new Error(
      error.details.map((detail) => detail.message).join(", ")
    );
    err.statusCode = 400;
    next(err);
    return null;
  }

  return value;
};

export const createTenant = async (req, res, next) => {
  try {
    const value = validate(createTenantSchema, req.body, next);
    if (!value) return;

    const tenant = await tenantService.createTenant(value);

    res.status(201).json({
      success: true,
      message: "Tenant created successfully",
      data: { tenant },
    });
  } catch (error) {
    next(error);
  }
};

export const getTenants = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await tenantService.listTenants({ page, limit });

    res.status(200).json({
      success: true,
      data: {
        tenants: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: result.pages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTenantById = async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);

    res.status(200).json({
      success: true,
      data: { tenant },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTenant = async (req, res, next) => {
  try {
    const value = validate(updateTenantSchema, req.body, next);
    if (!value) return;

    const tenant = await tenantService.updateTenant(req.params.id, value);

    res.status(200).json({
      success: true,
      message: "Tenant updated successfully",
      data: { tenant },
    });
  } catch (error) {
    next(error);
  }
};

export const getTenantAdmins = async (req, res, next) => {
  try {
    const admins = await tenantService.getTenantAdmins(req.params.id);

    res.status(200).json({
      success: true,
      data: { admins },
    });
  } catch (error) {
    next(error);
  }
};

export const createTenantAdmin = async (req, res, next) => {
  try {
    const value = validate(createTenantAdminSchema, req.body, next);
    if (!value) return;

    const admin = await tenantService.createTenantAdmin(req.params.id, value);

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: { admin },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTenantAdmin = async (req, res, next) => {
  try {
    const value = validate(updateTenantAdminSchema, req.body, next);
    if (!value) return;

    const admin = await tenantService.updateTenantAdmin(
      req.params.id,
      req.params.adminId,
      value
    );

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: { admin },
    });
  } catch (error) {
    next(error);
  }
};
