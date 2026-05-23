import CompanySettings from "../models/company-settings.model.js";

export const getCompanySettings = async () => {
  const settings = await CompanySettings.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return settings;
};

export const updateCompanySettings = async (data) => {
  const updated = await CompanySettings.findOneAndUpdate(
    {},
    { $set: data },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return updated;
};
