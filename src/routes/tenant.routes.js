import express from "express";
import * as tenantController from "../controllers/tenant.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(authorizeRoles("SuperAdmin"));

router.get("/", tenantController.getTenants);
router.post("/", tenantController.createTenant);
router.get("/:id", tenantController.getTenantById);
router.put("/:id", tenantController.updateTenant);
router.get("/:id/admins", tenantController.getTenantAdmins);
router.post("/:id/admins", tenantController.createTenantAdmin);
router.put("/:id/admins/:adminId", tenantController.updateTenantAdmin);

export default router;
