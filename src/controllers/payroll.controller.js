import * as payrollService from "../services/payroll.service.js";
import {
  generatePayrollSchema,
  listPayrollSchema,
  regeneratePayrollSchema
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

export const listPayrolls = async (req, res, next) => {
  try {
    const value = validate(listPayrollSchema, req.query, next);
    if (!value) return;

    const result = await payrollService.listPayrolls(value, req.user);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const getPayrollSummary = async (req, res, next) => {
  try {
    const summary = await payrollService.getPayrollSummary(req.user);

    res.status(200).json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPayslips = async (req, res, next) => {
  try {
    const value = validate(listPayrollSchema, req.query, next);
    if (!value) return;

    const result = await payrollService.getMyPayslips(value, req.user);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const generatePayroll = async (req, res, next) => {
  try {
    const value = validate(generatePayrollSchema, req.body, next);
    if (!value) return;

    const result = await payrollService.generatePayroll(value, req.user);

    res.status(201).json({
      success: true,
      message: "Payroll generated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const regeneratePayroll = async (req, res, next) => {
  try {
    const value = validate(regeneratePayrollSchema, req.body, next);
    if (!value) return;

    const payroll = await payrollService.regeneratePayroll(
      req.params.employeeId,
      value,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Payroll regenerated successfully",
      data: { payroll }
    });
  } catch (error) {
    next(error);
  }
};

export const processPayroll = async (req, res, next) => {
  try {
    const payroll = await payrollService.processPayroll(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Payroll processed successfully",
      data: { payroll }
    });
  } catch (error) {
    next(error);
  }
};

export const markPayrollPaid = async (req, res, next) => {
  try {
    const payroll = await payrollService.markPayrollPaid(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Payroll marked as paid successfully",
      data: { payroll }
    });
  } catch (error) {
    next(error);
  }
};

export const getPayrollPdf = async (req, res, next) => {
  try {
    const pdf = await payrollService.getPayrollPdf(req.params.id, req.user);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdf.payrollNumber}.pdf"`
    );
    res.status(200).send(pdf.pdfBuffer);
  } catch (error) {
    next(error);
  }
};
