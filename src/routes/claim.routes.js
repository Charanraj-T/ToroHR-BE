import express from "express";
import * as claimController from "../controllers/claim.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/summary",
  authorizeRoles("Employee", "Manager", "Admin"),
  claimController.getClaimSummary
);

router.post("/", authorizeRoles("Employee", "Manager"), claimController.createClaim);

router.get("/", authorizeRoles("Employee", "Manager", "Admin"), claimController.getClaims);

router.get("/:id", authorizeRoles("Employee", "Manager", "Admin"), claimController.getClaimById);

router.put("/:id", authorizeRoles("Employee", "Manager"), claimController.updateClaim);

router.delete(
  "/:id",
  authorizeRoles("Employee", "Manager", "Admin"),
  claimController.deleteClaim
);

router.put("/:id/approve", authorizeRoles("Admin", "Manager"), claimController.approveClaim);

router.put("/:id/reject", authorizeRoles("Admin", "Manager"), claimController.rejectClaim);

router.put(
  "/:id/cancel",
  authorizeRoles("Employee", "Manager", "Admin"),
  claimController.cancelClaim
);

router.put(
  "/:id/reimburse",
  authorizeRoles("Admin", "Manager"),
  claimController.reimburseClaim
);

export default router;
