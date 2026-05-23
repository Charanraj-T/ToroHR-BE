import express from "express";
import * as leaveController from "../controllers/leave.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.post(
  "/",
  authorizeRoles("Employee", "Manager", "Admin"),
  leaveController.createLeave
);

router.get("/me", authorizeRoles("Employee", "Manager", "Admin"), leaveController.getMyLeaves);
router.get("/balance/me", authorizeRoles("Employee", "Manager", "Admin"), leaveController.getMyLeaveBalance);

router.get("/", authorizeRoles("Admin", "Manager"), leaveController.getLeaves);
router.get("/:id", authorizeRoles("Employee", "Manager", "Admin"), leaveController.getLeaveById);

router.put(
  "/:id/approve",
  authorizeRoles("Admin", "Manager"),
  leaveController.approveLeave
);

router.put(
  "/:id/reject",
  authorizeRoles("Admin", "Manager"),
  leaveController.rejectLeave
);

router.put(
  "/:id/cancel",
  authorizeRoles("Employee", "Manager", "Admin"),
  leaveController.cancelLeave
);

export default router;
