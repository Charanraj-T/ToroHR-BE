import * as settingsRepository from "../repositories/settings.repository.js";

export const buildWeekendDays = async (tenantId) => {
  const settings = await settingsRepository.getCompanySettings(tenantId);
  return buildWeekendDaysFromSettings(settings);
};

export const buildWeekendDaysFromSettings = (settings) => {
  const weekendDays = [];
  if (settings?.saturdayIsHoliday !== false) weekendDays.push(6);
  if (settings?.sundayIsHoliday !== false) weekendDays.push(0);
  return weekendDays;
};
