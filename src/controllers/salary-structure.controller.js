import * as salaryStructureService from "../services/salary-structure.service.js";
import {
  createSalaryStructureSchema,
  listSalaryStructureSchema,
  updateSalaryStructureSchema
} from "../validators/payroll.validator.js";

const validate = (schema, payload, next) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const err = new Error(error.details.map((detail) => detail.message).join(", "));
    err.statusCode = 400;
    next(err);
    return null;
  }

  return value;
};

export const listSalaryStructures = async (req, res, next) => {
  try {
    const value = validate(listSalaryStructureSchema, req.query, next);
    if (!value) return;

    const result = await salaryStructureService.listSalaryStructures(value, req.user);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const getSalaryStructuresByEmployee = async (req, res, next) => {
  try {
    const structures = await salaryStructureService.getSalaryStructuresByEmployee(
      req.params.employeeId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: { structures }
    });
  } catch (error) {
    next(error);
  }
};

export const createSalaryStructure = async (req, res, next) => {
  try {
    const value = validate(createSalaryStructureSchema, req.body, next);
    if (!value) return;

    const structure = await salaryStructureService.createSalaryStructure(value, req.user);

    res.status(201).json({
      success: true,
      message: "Salary structure created successfully",
      data: { structure }
    });
  } catch (error) {
    next(error);
  }
};

export const updateSalaryStructure = async (req, res, next) => {
  try {
    const value = validate(updateSalaryStructureSchema, req.body, next);
    if (!value) return;

    const structure = await salaryStructureService.updateSalaryStructure(
      req.params.id,
      value,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Salary structure updated successfully",
      data: { structure }
    });
  } catch (error) {
    next(error);
  }
};
