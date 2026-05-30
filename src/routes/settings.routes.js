import express from "express";
import * as settingsController from "../controllers/settings.controller.js";
import { authorizeRoles, verifyToken, blockSuperAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(blockSuperAdmin);

router.get(
  "/company",
  authorizeRoles("Admin", "Manager"),
  settingsController.getCompanySettings
);

router.put(
  "/company",
  authorizeRoles("Admin"),
  settingsController.updateCompanySettings
);

export default router;
