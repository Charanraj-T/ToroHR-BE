import * as payrollSettingsService from "../services/payroll-settings.service.js";
import { updatePayrollSettingsSchema } from "../validators/payroll.validator.js";

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

export const getPayrollSettings = async (req, res, next) => {
  try {
    const settings = await payrollSettingsService.getPayrollSettings(req.user);

    res.status(200).json({
      success: true,
      data: { settings }
    });
  } catch (error) {
    next(error);
  }
};

export const updatePayrollSettings = async (req, res, next) => {
  try {
    const value = validate(updatePayrollSettingsSchema, req.body, next);
    if (!value) return;

    const settings = await payrollSettingsService.updatePayrollSettings(value, req.user);

    res.status(200).json({
      success: true,
      message: "Payroll settings updated successfully",
      data: { settings }
    });
  } catch (error) {
    next(error);
  }
};
