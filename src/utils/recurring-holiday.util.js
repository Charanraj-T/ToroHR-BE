import Holiday from "../models/holiday.model.js";
import { getStartOfDay } from "./date.util.js";

export const getHolidaysForYear = async (year, tenantId = null) => {
  const query = {};
  if (tenantId) query.tenantId = tenantId;

  const holidays = await Holiday.find(query).lean();
  const filtered = [];

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date);

    if (!holiday.isRecurringYearly) {
      if (holidayDate.getUTCFullYear() === year) {
        filtered.push(holiday);
      }
    } else {
      filtered.push({
        ...holiday,
        date: new Date(
          Date.UTC(year, holidayDate.getUTCMonth(), holidayDate.getUTCDate()),
        ),
      });
    }
  }

  return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
};

export const getUpcomingHolidays = async (days = 365, tenantId = null) => {
  const today = getStartOfDay(new Date());
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + days);

  const query = {};
  if (tenantId) query.tenantId = tenantId;

  const holidays = await Holiday.find(query).lean();
  const upcoming = [];

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date);

    if (!holiday.isRecurringYearly) {
      if (holidayDate >= today && holidayDate <= endDate) {
        upcoming.push(holiday);
      }
    } else {
      const targetDate = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          holidayDate.getUTCMonth(),
          holidayDate.getUTCDate(),
        ),
      );

      if (targetDate >= today && targetDate <= endDate) {
        upcoming.push({
          ...holiday,
          date: targetDate,
        });
      } else if (targetDate < today) {
        const nextYearDate = new Date(
          Date.UTC(
            today.getUTCFullYear() + 1,
            holidayDate.getUTCMonth(),
            holidayDate.getUTCDate(),
          ),
        );
        if (nextYearDate >= today && nextYearDate <= endDate) {
          upcoming.push({
            ...holiday,
            date: nextYearDate,
          });
        }
      }
    }
  }

  return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
};
