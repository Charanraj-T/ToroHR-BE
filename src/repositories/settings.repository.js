import CompanySettings from "../models/company-settings.model.js";

export const getCompanySettings = async (tenantId) => {
  const settings = await CompanySettings.findOne({ tenantId }).lean();
  return settings;
};

export const createCompanySettings = async (data) => {
  const [settings] = await CompanySettings.create([data]);
  return settings.toObject();
};

export const updateCompanySettings = async (data) => {
  const { tenantId, ...rest } = data;
  const updated = await CompanySettings.findOneAndUpdate(
    { tenantId },
    { $set: rest },
    { new: true, runValidators: true }
  ).lean();
  return updated;
};
