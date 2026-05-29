import express from "express";
import * as employeeController from "../controllers/employee.controller.js";
import { authorizeRoles, verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

const canViewProfile = (req, res, next) => {
  const { role, employeeId } = req.user;
  const targetId = req.params.id;

  if (role === "Admin" || role === "Manager" || (employeeId && employeeId === targetId)) {
    return next();
  }

  const error = new Error("You do not have permission to access this resource");
  error.statusCode = 403;
  next(error);
};

const isAdminOrManager = authorizeRoles("Admin", "Manager");

router.post("/", isAdminOrManager, employeeController.createEmployee);
router.get("/stats", isAdminOrManager, employeeController.getEmployeeStats);
router.get("/", isAdminOrManager, employeeController.getEmployees);
router.get("/:id", canViewProfile, employeeController.getEmployeeById);
router.put("/:id", isAdminOrManager, employeeController.updateEmployee);
router.delete("/:id", isAdminOrManager, employeeController.deleteEmployee);

export default router;
