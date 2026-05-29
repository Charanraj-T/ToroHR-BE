import * as holidayService from "../services/holiday.service.js";
import {
  createHolidaySchema,
  updateHolidaySchema,
  listHolidaysSchema,
  getHolidayByIdSchema,
  deleteHolidaySchema,
} from "../validators/holiday.validator.js";
import { normalizeHolidayList, normalizeHoliday } from "../dtos/holiday.dto.js";

/**
 * Validate input against Joi schema
 * @param {Object} schema - Joi schema
 * @param {Object} payload - Data to validate
 * @param {Function} next - Express next middleware
 * @returns {Object|null} Validated data or null if error
 */
const validate = (schema, payload, next) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const err = new Error(
      error.details.map((detail) => detail.message).join(", "),
    );
    err.statusCode = 400;
    next(err);
    return null;
  }

  return value;
};

/**
 * CREATE: POST /api/holidays
 * Create a new holiday
 * Authorization: Admin only
 */
export const createHoliday = async (req, res, next) => {
  try {
    const value = validate(createHolidaySchema, req.body, next);
    if (!value) return;

    const holiday = await holidayService.createHoliday(value, req.user);

    res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      data: {
        holiday: normalizeHoliday(holiday),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * READ: GET /api/holidays
 * Get all holidays with pagination, search, and filters
 * Authorization: All authenticated users (Admin, Manager, Employee)
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - search: string (search by name or description)
 * - year: number (filter by year)
 * - upcoming: boolean (get upcoming holidays instead)
 */
export const getHolidays = async (req, res, next) => {
  try {
    const value = validate(listHolidaysSchema, req.query, next);
    if (!value) return;

    const result = await holidayService.getHolidaysWithFilters(
      {
        search: value.search,
        year: value.year,
        upcoming: value.upcoming,
      },
      value.page,
      value.limit,
    );

    res.status(200).json({
      success: true,
      message: "Holidays retrieved successfully",
      data: {
        holidays: normalizeHolidayList(result.data),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: result.pages,
        },
        filters: result.filters,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * READ: GET /api/holidays/current-year
 * Get all holidays for the current calendar year
 * Authorization: All authenticated users
 */
export const getCurrentYearHolidays = async (req, res, next) => {
  try {
    const holidays = await holidayService.getCurrentYearHolidays();

    res.status(200).json({
      success: true,
      message: "Current year holidays retrieved successfully",
      data: {
        holidays: normalizeHolidayList(holidays),
        year: new Date().getUTCFullYear(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * READ: GET /api/holidays/upcoming
 * Get upcoming holidays for the next 365 days
 * Authorization: All authenticated users
 *
 * Query parameters:
 * - days: number (how many days ahead to look, default: 365)
 */
export const getUpcomingHolidays = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 365;
    const holidays = await holidayService.getUpcomingHolidaysList(days);

    res.status(200).json({
      success: true,
      message: "Upcoming holidays retrieved successfully",
      data: {
        holidays: normalizeHolidayList(holidays),
        days,
        total: holidays.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * READ: GET /api/holidays/:id
 * Get a single holiday by ID
 * Authorization: All authenticated users
 */
export const getHolidayById = async (req, res, next) => {
  try {
    const value = validate(getHolidayByIdSchema, { id: req.params.id }, next);
    if (!value) return;

    const holiday = await holidayService.getHolidayById(value.id);

    res.status(200).json({
      success: true,
      message: "Holiday retrieved successfully",
      data: {
        holiday: normalizeHoliday(holiday),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * UPDATE: PUT /api/holidays/:id
 * Update a holiday
 * Authorization: Admin only
 */
export const updateHoliday = async (req, res, next) => {
  try {
    const value = validate(updateHolidaySchema, req.body, next);
    if (!value) return;

    const holiday = await holidayService.updateHoliday(
      req.params.id,
      value,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: "Holiday updated successfully",
      data: {
        holiday: normalizeHoliday(holiday),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE: DELETE /api/holidays/:id
 * Delete a holiday
 * Authorization: Admin only
 */
export const deleteHoliday = async (req, res, next) => {
  try {
    const value = validate(deleteHolidaySchema, { id: req.params.id }, next);
    if (!value) return;

    const holiday = await holidayService.deleteHoliday(value.id, req.user);

    res.status(200).json({
      success: true,
      message: "Holiday deleted successfully",
      data: {
        holiday: normalizeHoliday(holiday),
      },
    });
  } catch (error) {
    next(error);
  }
};
