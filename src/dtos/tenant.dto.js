export const normalizeTenant = (tenant) => {
  if (!tenant) return null;

  return {
    id: tenant._id,
    companyName: tenant.companyName,
    companyEmail: tenant.companyEmail,
    companyPhone: tenant.companyPhone,
    status: tenant.status,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
};

export const normalizeTenantList = (tenants) => {
  if (!tenants || !Array.isArray(tenants)) return [];
  return tenants.map(normalizeTenant);
};
