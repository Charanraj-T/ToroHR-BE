import { verifyJwtToken } from "../utils/jwt.js";

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const error = new Error("Authorization token is required");
      error.statusCode = 401;
      throw error;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJwtToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    error.statusCode = error.statusCode || 401;
    error.message = error.message === "jwt expired" ? "Token has expired" : error.message;
    next(error);
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const error = new Error("You do not have permission to access this resource");
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};
