import mongoose from "mongoose";
import * as holidayRepository from "../repositories/holiday.repository.js";
import {
  loadHolidaysCache,
  getHolidaysForYear,
  getUpcomingHolidays,
} from "../utils/recurring-holiday.util.js";
import { parseDateOnly, getYear } from "../utils/date.util.js";

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const validateObjectId = (id, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throwError(`${label} is invalid`, 400);
  }
};

/**
 * Create a new holiday
 * @param {Object} data - Holiday data (name, date, description, isRecurringYearly)
 * @param {Object} user - User object with userId and role
 * @returns {Promise<Object>} Created holiday
 */
export const createHoliday = async (data, user) => {
  // Validate user is admin
  if (user.role !== "Admin") {
    throwError("Only Admins can create holidays", 403);
  }

  // Parse and validate date
  const holidayDate = parseDateOnly(data.date);
  if (!holidayDate || isNaN(holidayDate)) {
    throwError("Invalid date provided", 400);
  }

  if (
    data.isRecurringYearly &&
    holidayDate.getUTCMonth() === 1 &&
    holidayDate.getUTCDate() === 29
  ) {
    throwError("February 29 cannot be set as a recurring yearly holiday", 400);
  }

  // Check for duplicate holidays
  const isDuplicate = await holidayRepository.checkDuplicateHoliday(
    data.name,
    holidayDate,
  );

  if (isDuplicate) {
    throwError(`Holiday '${data.name}' already exists on this date`, 409);
  }

  const hasCrossYearConflict =
    await holidayRepository.checkDuplicateHolidayCrossYear(
      data.name,
      holidayDate,
    );

  if (hasCrossYearConflict) {
    throwError(
      `Holiday '${data.name}' already exists for this month and day`,
      409,
    );
  }

  // Create holiday
  const holiday = await holidayRepository.createHoliday(
    {
      name: data.name,
      date: holidayDate,
      description: data.description || "",
      isRecurringYearly: data.isRecurringYearly || false,
    },
    user.userId,
  );

  // Reload cache to reflect changes
  await loadHolidaysCache();

  return holiday;
};

/**
 * Get all holidays with pagination and filters
 * @param {Object} filters - Filter criteria
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Paginated holidays
 */
export const getHolidaysWithFilters = async (
  filters = {},
  page = 1,
  limit = 20,
) => {
  const { search, year, upcoming } = filters;

  // Validate pagination
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  // If upcoming filter is requested
  if (upcoming === true || upcoming === "true") {
    const upcomingHolidays = await getUpcomingHolidays(365);

    // Apply search filter if provided
    let filtered = upcomingHolidays;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filtered = upcomingHolidays.filter(
        (h) =>
          searchRegex.test(h.name) || searchRegex.test(h.description || ""),
      );
    }

    // Paginate results
    const skip = (validPage - 1) * validLimit;
    const data = filtered.slice(skip, skip + validLimit);
    const total = filtered.length;
    const pages = Math.ceil(total / validLimit);

    return {
      data,
      total,
      page: validPage,
      limit: validLimit,
      pages,
      filters: { search, upcoming: true },
    };
  }

  // Regular filtering
  const filterCriteria = {};

  if (search && search.trim()) {
    filterCriteria.search = search;
  }

  if (year) {
    filterCriteria.year = year;
  }

  const result = await holidayRepository.findHolidaysWithPagination(
    filterCriteria,
    validPage,
    validLimit,
  );

  return {
    ...result,
    filters: { search, year },
  };
};

/**
 * Get a single holiday by ID
 * @param {string} id - Holiday ID
 * @returns {Promise<Object>} Holiday document
 */
export const getHolidayById = async (id) => {
  validateObjectId(id);

  const holiday = await holidayRepository.findHolidayById(id, true);

  if (!holiday) {
    throwError("Holiday not found", 404);
  }

  return holiday;
};

/**
 * Update a holiday
 * @param {string} id - Holiday ID
 * @param {Object} data - Update data
 * @param {Object} user - User object with userId and role
 * @returns {Promise<Object>} Updated holiday
 */
export const updateHoliday = async (id, data, user) => {
  // Validate user is admin
  if (user.role !== "Admin") {
    throwError("Only Admins can update holidays", 403);
  }

  validateObjectId(id);

  // Get existing holiday
  const existing = await holidayRepository.findHolidayById(id);
  if (!existing) {
    throwError("Holiday not found", 404);
  }

  // Prepare update data
  const updateData = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.date !== undefined) {
    const parsedDate = parseDateOnly(data.date);
    if (!parsedDate || isNaN(parsedDate)) {
      throwError("Invalid date provided", 400);
    }
    updateData.date = parsedDate;
  }

  const effectiveRecurring =
    data.isRecurringYearly !== undefined
      ? data.isRecurringYearly
      : existing.isRecurringYearly;
  const effectiveDate = data.date ? parseDateOnly(data.date) : existing.date;

  if (
    effectiveRecurring &&
    effectiveDate.getUTCMonth() === 1 &&
    effectiveDate.getUTCDate() === 29
  ) {
    throwError("February 29 cannot be set as a recurring yearly holiday", 400);
  }

  if (data.description !== undefined) {
    updateData.description = data.description || "";
  }

  if (data.isRecurringYearly !== undefined) {
    updateData.isRecurringYearly = data.isRecurringYearly;
  }

  // Check for duplicate (if name or date changed)
  if (data.name || data.date) {
    const checkDate = data.date ? parseDateOnly(data.date) : existing.date;
    const checkName = data.name || existing.name;

    const isDuplicate = await holidayRepository.checkDuplicateHoliday(
      checkName,
      checkDate,
      id,
    );

    if (isDuplicate) {
      throwError(`Holiday '${checkName}' already exists on this date`, 409);
    }

    const hasCrossYearConflict =
      await holidayRepository.checkDuplicateHolidayCrossYear(
        checkName,
        checkDate,
        id,
      );

    if (hasCrossYearConflict) {
      throwError(
        `Holiday '${checkName}' already exists for this month and day`,
        409,
      );
    }
  }

  // Update holiday
  const updated = await holidayRepository.updateHoliday(
    id,
    updateData,
    user.userId,
  );

  // Reload cache to reflect changes
  await loadHolidaysCache();

  return updated;
};

/**
 * Delete a holiday
 * @param {string} id - Holiday ID
 * @param {Object} user - User object with userId and role
 * @returns {Promise<Object>} Deleted holiday
 */
export const deleteHoliday = async (id, user) => {
  // Validate user is admin
  if (user.role !== "Admin") {
    throwError("Only Admins can delete holidays", 403);
  }

  validateObjectId(id);

  const holiday = await holidayRepository.findHolidayById(id);
  if (!holiday) {
    throwError("Holiday not found", 404);
  }

  const deleted = await holidayRepository.deleteHoliday(id);

  // Reload cache to reflect changes
  await loadHolidaysCache();

  return deleted;
};

/**
 * Get holidays for current year
 * @returns {Promise<Array>} Holidays in current year
 */
export const getCurrentYearHolidays = async () => {
  const currentYear = getYear();
  return getHolidaysForYear(currentYear);
};

/**
 * Get upcoming holidays
 * @param {number} days - Number of days to look ahead
 * @returns {Promise<Array>} Upcoming holidays
 */
export const getUpcomingHolidaysList = async (days = 365) => {
  const validDays = Math.min(Math.max(parseInt(days, 10) || 365, 1), 3650);
  return getUpcomingHolidays(validDays);
};

/**
 * Initialize holidays cache (call on app startup)
 * @returns {Promise<void>}
 */
export const initializeHolidaysCache = async () => {
  try {
    await loadHolidaysCache();
    console.log("Holidays cache initialized successfully");
  } catch (error) {
    console.error("Error initializing holidays cache:", error);
  }
};
