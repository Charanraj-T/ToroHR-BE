import { normalizePayrollSettings } from "../dtos/payroll.dto.js";
import * as payrollSettingsRepository from "../repositories/payroll-settings.repository.js";

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

export const getPayrollSettings = async (requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can view payroll settings", 403);
  }

  const settings = await payrollSettingsRepository.getPayrollSettings();
  return normalizePayrollSettings(settings);
};

export const updatePayrollSettings = async (data, requestingUser) => {
  if (requestingUser.role !== "Admin") {
    throwError("Only admins can update payroll settings", 403);
  }

  const settings = await payrollSettingsRepository.updatePayrollSettings(data);
  return normalizePayrollSettings(settings);
};

export const getPayrollSettingsInternal = async () => {
  return payrollSettingsRepository.getPayrollSettings();
};
