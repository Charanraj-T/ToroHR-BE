import express from "express";
import * as employeeController from "../controllers/employee.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(authorizeRoles("Admin", "Manager"));

router.post("/", employeeController.createEmployee);
router.get("/", employeeController.getEmployees);
router.get("/:id", employeeController.getEmployeeById);
router.put("/:id", employeeController.updateEmployee);
router.delete("/:id", employeeController.deleteEmployee);

export default router;
