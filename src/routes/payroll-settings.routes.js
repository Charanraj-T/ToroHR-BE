import express from "express";
import * as payrollSettingsController from "../controllers/payroll-settings.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/settings",
  authorizeRoles("Admin"),
  payrollSettingsController.getPayrollSettings
);

router.put(
  "/settings",
  authorizeRoles("Admin"),
  payrollSettingsController.updatePayrollSettings
);

export default router;
