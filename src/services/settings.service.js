import * as settingsRepository from "../repositories/settings.repository.js";
import { normalizeCompanySettings } from "../dtos/company-settings.dto.js";

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

export const getCompanySettings = async (requestingUser) => {
  if (requestingUser.role === "Employee") {
    throwError("You do not have permission to view company settings", 403);
  }

  const tenantId = requestingUser.tenantId;
  const settings = await settingsRepository.getCompanySettings(tenantId);
  return normalizeCompanySettings(settings);
};

export const updateCompanySettings = async (data, requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can update company settings", 403);
  }

  const settings = await settingsRepository.updateCompanySettings({
    ...data,
    tenantId: requestingUser.tenantId,
  });
  return normalizeCompanySettings(settings);
};
