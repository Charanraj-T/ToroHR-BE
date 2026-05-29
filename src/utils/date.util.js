/**
 * Unified Date Utility
 *
 * All date-only operations use UTC methods for consistency regardless of server location.
 * IST helpers are provided for "today" logic (Indian client's perspective) and
 * time-of-day display.
 *
 * Principle:
 * - Date strings (YYYY-MM-DD) from FE → parse as UTC midnight → UTC math
 * - "Now" for business logic → IST-aware (what day is it in India)
 * - All comparisons, iterations, weekend checks → UTC methods
 */

/**
 * Parse a date string (YYYY-MM-DD) as UTC midnight
 * @param {string} dateStr
 * @returns {Date}
 */
export const parseDateOnly = (dateStr) => {
  if (!dateStr) return new Date(NaN);
  return new Date(`${dateStr}T00:00:00.000Z`);
};

/**
 * Get start of day (UTC 00:00:00.000)
 * @param {Date|string} date
 * @returns {Date}
 */
export const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Get end of day (UTC 23:59:59.999)
 * @param {Date|string} date
 * @returns {Date}
 */
export const getEndOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

/**
 * Check if a date falls on a weekend (Sat/Sun) — UTC
 * @param {Date|string} date
 * @returns {boolean}
 */
export const isWeekend = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Get the year from a date (UTC)
 * @param {Date|string} [date]
 * @returns {number}
 */
export const getYear = (date = new Date()) => {
  return new Date(date).getUTCFullYear();
};

/**
 * Get today's date in IST as UTC midnight
 * (Correctly determines "today" for an Indian user regardless of server timezone)
 * @returns {Date}
 */
export const getTodayIST = () => {
  const now = new Date();
  return getStartOfDayIST(now);
};

/**
 * Convert a date to IST date then return UTC midnight of that date
 * @param {Date|string} date
 * @returns {Date}
 */
export const getStartOfDayIST = (date) => {
  const [y, m, d] = new Date(date)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

/**
 * Convert a date to IST date then return UTC end-of-day of that date
 * @param {Date|string} date
 * @returns {Date}
 */
export const getEndOfDayIST = (date) => {
  const [y, m, d] = new Date(date)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
};
