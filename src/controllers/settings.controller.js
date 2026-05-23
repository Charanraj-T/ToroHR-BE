import * as settingsService from "../services/settings.service.js";
import { updateCompanySettingsSchema } from "../validators/settings.validator.js";

const validate = (schema, payload, next) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const err = new Error(
      error.details.map((detail) => detail.message).join(", ")
    );
    err.statusCode = 400;
    next(err);
    return null;
  }

  return value;
};

export const getCompanySettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getCompanySettings(req.user);

    res.status(200).json({
      success: true,
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCompanySettings = async (req, res, next) => {
  try {
    const value = validate(updateCompanySettingsSchema, req.body, next);
    if (!value) return;

    const settings = await settingsService.updateCompanySettings(value, req.user);

    res.status(200).json({
      success: true,
      message: "Company settings updated successfully",
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};