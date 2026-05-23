/**
 * Recurring Holiday Utility Functions
 * Handles caching and querying of holidays.
 */

import Holiday from "../models/holiday.model.js";
import { getStartOfDay } from "./holiday.util.js";

let holidayCache = null;
let holidayCacheExpiry = 0;

const CACHE_DURATION = 1 * 60 * 60 * 1000;

const getHolidaysCache = async () => {
  if (holidayCache && Date.now() < holidayCacheExpiry) {
    return holidayCache;
  }
  return loadHolidaysCache();
};

export const loadHolidaysCache = async () => {
  try {
    const holidays = await Holiday.find().lean();
    holidayCache = holidays;
    holidayCacheExpiry = Date.now() + CACHE_DURATION;
    return holidays;
  } catch (error) {
    console.error("Error loading holidays cache:", error);
    return [];
  }
};

/**
 * Get holidays for a specific year
 * @param {number} year - The calendar year
 * @returns {Promise<Array>} Array of holidays in that year
 */
export const getHolidaysForYear = async (year) => {
  const holidays = await getHolidaysCache();
  const filtered = [];

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date);

    if (!holiday.isRecurringYearly) {
      // Non-recurring: check exact year match
      if (holidayDate.getUTCFullYear() === year) {
        filtered.push(holiday);
      }
    } else {
      // Recurring yearly: include for the target year
      filtered.push({
        ...holiday,
        // Adjust date to show the year requested
        date: new Date(
          Date.UTC(year, holidayDate.getUTCMonth(), holidayDate.getUTCDate()),
        ),
      });
    }
  }

  // Sort by date
  return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
};

/**
 * Get upcoming holidays from today
 * @param {number} days - Number of days to look ahead (default: 365)
 * @returns {Promise<Array>} Array of upcoming holidays
 */
export const getUpcomingHolidays = async (days = 365) => {
  const today = getStartOfDay(new Date());
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + days);

  const holidays = await getHolidaysCache();
  const upcoming = [];

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date);

    if (!holiday.isRecurringYearly) {
      // Non-recurring: must be in the future
      if (holidayDate >= today && holidayDate <= endDate) {
        upcoming.push(holiday);
      }
    } else {
      // Recurring yearly: check for upcoming dates in the range
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
        // Check next year for recurring holidays
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

  // Sort by date
  return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
};
