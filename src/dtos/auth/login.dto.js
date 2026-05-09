import Joi from "joi";

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be valid",
    "string.empty": "Email is required",
    "any.required": "Email is required"
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
