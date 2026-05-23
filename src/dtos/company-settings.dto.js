export const normalizeCompanySettings = (settings) => {
  if (!settings) {
    return null;
  }

  return {
    id: settings._id,
    companyName: settings.companyName,
    companyEmail: settings.companyEmail,
    companyPhone: settings.companyPhone || "",
    companyLogo: settings.companyLogo || "",
    addressLine1: settings.addressLine1 || "",
    addressLine2: settings.addressLine2 || "",
    city: settings.city || "",
    state: settings.state || "",
    country: settings.country || "",
    postalCode: settings.postalCode || "",
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
};
