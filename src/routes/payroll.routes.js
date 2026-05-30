import express from "express";
import * as payrollController from "../controllers/payroll.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/summary",
  authorizeRoles("Admin", "Manager", "Employee"),
  payrollController.getPayrollSummary
);

router.get(
  "/me",
  authorizeRoles("Admin", "Manager", "Employee"),
  payrollController.getMyPayslips
);

router.post(
  "/generate",
  authorizeRoles("Admin"),
  payrollController.generatePayroll
);

router.post(
  "/:employeeId/regenerate",
  authorizeRoles("Admin"),
  payrollController.regeneratePayroll
);

router.put(
  "/:id/process",
  authorizeRoles("Admin"),
  payrollController.processPayroll
);

router.put(
  "/:id/paid",
  authorizeRoles("Admin"),
  payrollController.markPayrollPaid
);

router.get(
  "/:id/pdf",
  authorizeRoles("Admin", "Manager", "Employee"),
  payrollController.getPayrollPdf
);

router.get(
  "/",
  authorizeRoles("Admin", "Manager", "Employee"),
  payrollController.listPayrolls
);

export default router;
