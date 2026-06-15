import Joi from "joi";
import {
  ALLOWED_MIME_TYPES,
  CLAIM_STATUSES,
  MAX_ATTACHMENTS
} from "../utils/claim.util.js";

const objectId = Joi.string().hex().length(24);
const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

const attachmentSchema = Joi.object({
  fileName: Joi.string().trim().min(1).max(255).required(),
  mimeType: Joi.string()
    .valid(...ALLOWED_MIME_TYPES)
    .required()
    .messages({
      "any.only": `MIME type must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`
    }),
  data: Joi.string().base64({ paddingRequired: false }).required().messages({
    "string.base64": "Attachment data must be a valid base64 string"
  })
});

export const createClaimSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be greater than 0"
  }),
  expenseDate: Joi.string().pattern(dateStringRegex).required().messages({
    "string.pattern.base": "Expense date must be in YYYY-MM-DD format"
  }),
  description: Joi.string().trim().max(1000).allow("", null).default(""),
  attachments: Joi.array().items(attachmentSchema).max(MAX_ATTACHMENTS).default([])
});

export const updateClaimSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be greater than 0"
  }),
  expenseDate: Joi.string().pattern(dateStringRegex).required().messages({
    "string.pattern.base": "Expense date must be in YYYY-MM-DD format"
  }),
  description: Joi.string().trim().max(1000).allow("", null).default(""),
  attachments: Joi.array().items(attachmentSchema).max(MAX_ATTACHMENTS).default([])
});

export const listClaimSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string()
    .valid(...CLAIM_STATUSES)
    .allow("")
    .empty(""),
  dateFrom: Joi.string().pattern(dateStringRegex).allow("").empty("").messages({
    "string.pattern.base": "dateFrom must be in YYYY-MM-DD format"
  }),
  dateTo: Joi.string().pattern(dateStringRegex).allow("").empty("").messages({
    "string.pattern.base": "dateTo must be in YYYY-MM-DD format"
  }),
  search: Joi.string().trim().allow("")
});
