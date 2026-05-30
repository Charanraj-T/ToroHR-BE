import express from "express";
import * as attendanceController from "../controllers/attendance.controller.js";
import { authorizeRoles, verifyToken, blockSuperAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(blockSuperAdmin);

router.post(
  "/check-in",
  authorizeRoles("Employee", "Manager"),
  attendanceController.checkIn,
);

router.post(
  "/check-out",
  authorizeRoles("Employee", "Manager"),
  attendanceController.checkOut,
);

// Get current attendance status
router.get(
  "/me/current",
  authorizeRoles("Employee", "Manager"),
  attendanceController.getMyAttendanceStatus,
);

// Get my attendance history
router.get(
  "/me",
  authorizeRoles("Employee", "Manager"),
  attendanceController.getAttendance,
);

router.post(
  "/manual",
  authorizeRoles("Admin", "Manager"),
  attendanceController.markAttendanceManually,
);

router.put(
  "/:id",
  authorizeRoles("Admin", "Manager"),
  attendanceController.updateAttendance,
);

router.get("/summary", authorizeRoles("Admin", "Manager"), attendanceController.getSummary);
router.get(
  "/stats/employee",
  authorizeRoles("Employee", "Manager"),
  attendanceController.getEmployeeStats,
);
router.get("/export/csv", authorizeRoles("Admin", "Manager", "Employee"), attendanceController.exportCsv);
router.get("/", authorizeRoles("Admin", "Manager", "Employee"), attendanceController.getAttendance);
router.get("/:id", authorizeRoles("Admin", "Manager", "Employee"), attendanceController.getAttendanceById);
router.delete(
  "/:id",
  authorizeRoles("Admin"),
  attendanceController.deleteAttendance,
);

export default router;
