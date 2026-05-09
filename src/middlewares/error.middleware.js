export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error";

  if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "field";
    message = `${field} already exists`;
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};
