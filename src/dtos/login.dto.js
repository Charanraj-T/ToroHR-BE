import Joi from "joi";

const loginSchema = Joi.object({
  identifier: Joi.string().trim().required().messages({
    "string.empty": "Email or phone number is required",
    "any.required": "Email or phone number is required"
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required"
  })
});

export const validateLoginDto = (loginData) => {
  const { error, value } = loginSchema.validate(loginData, {
    abortEarly: false,
    stripUnknown: true
  });

  if (!error) {
    return {
      isValid: true,
      value,
      errors: []
    };
  }

  return {
    isValid: false,
    value,
    errors: error.details.map((detail) => detail.message)
  };
};
