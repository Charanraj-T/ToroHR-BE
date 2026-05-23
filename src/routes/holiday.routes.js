import express from "express";
import * as holidayController from "../controllers/holiday.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All holiday routes require authentication
router.use(verifyToken);

/**
 * ADMIN ROUTES - Holiday Management
 * Only Admins can create, update, delete holidays
 */

// POST /api/holidays
// Create a new holiday
router.post("/", authorizeRoles("Admin"), holidayController.createHoliday);

// PUT /api/holidays/:id
// Update a holiday
router.put("/:id", authorizeRoles("Admin"), holidayController.updateHoliday);

// DELETE /api/holidays/:id
// Delete a holiday
router.delete("/:id", authorizeRoles("Admin"), holidayController.deleteHoliday);

/**
 * COMMON ROUTES - View Holidays
 * All authenticated users (Admin, Manager, Employee) can view holidays
 */

// GET /api/holidays
// Get all holidays with pagination and filters
// Query params: page, limit, search, year, upcoming
router.get(
  "/",
  authorizeRoles("Admin", "Manager", "Employee"),
  holidayController.getHolidays,
);

// GET /api/holidays/current-year
// Get holidays for current calendar year
// Note: This route must come BEFORE /:id route to prevent conflict
router.get(
  "/current-year",
  authorizeRoles("Admin", "Manager", "Employee"),
  holidayController.getCurrentYearHolidays,
);

// GET /api/holidays/upcoming
// Get upcoming holidays for next 365 days
// Note: This route must come BEFORE /:id route to prevent conflict
router.get(
  "/upcoming",
  authorizeRoles("Admin", "Manager", "Employee"),
  holidayController.getUpcomingHolidays,
);

// GET /api/holidays/:id
// Get a specific holiday by ID
router.get(
  "/:id",
  authorizeRoles("Admin", "Manager", "Employee"),
  holidayController.getHolidayById,
);

export default router;
