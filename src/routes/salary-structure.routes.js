import express from "express";
import * as salaryStructureController from "../controllers/salary-structure.controller.js";
import { authorizeRoles, verifyToken, blockSuperAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(blockSuperAdmin);

router.get(
  "/salary-structure",
  authorizeRoles("Admin", "Manager"),
  salaryStructureController.listSalaryStructures
);

router.get(
  "/salary-structure/:employeeId",
  authorizeRoles("Admin", "Manager"),
  salaryStructureController.getSalaryStructuresByEmployee
);

router.post(
  "/salary-structure",
  authorizeRoles("Admin"),
  salaryStructureController.createSalaryStructure
);

router.put(
  "/salary-structure/:id",
  authorizeRoles("Admin"),
  salaryStructureController.updateSalaryStructure
);

export default router;
