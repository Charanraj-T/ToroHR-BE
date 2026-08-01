import mongoose from "mongoose";

export const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

export const validateObjectId = (id, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throwError(`${label} is invalid`, 400);
  }
};

export const parsePageLimit = (queryParams) => ({
  page: Math.max(parseInt(queryParams.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100)
});

export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
