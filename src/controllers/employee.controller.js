import * as employeeService from "../services/employee.service.js";

export const createEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.createEmployee(req.body);

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: {
        employee
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployees = async (req, res, next) => {
  try {
    const result = await employeeService.getEmployees(req.query);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (req, res, next) => {
  try {
    const employee = await employeeService.getEmployeeById(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        employee
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.updateEmployee(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: {
        employee
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.deleteEmployee(req.params.id);

    res.status(200).json({
      success: true,
      message: "Employee deactivated successfully",
      data: {
        employee
      }
    });
  } catch (error) {
    next(error);
  }
};
