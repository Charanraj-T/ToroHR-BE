import jwt from "jsonwebtoken";

export const generateToken = (user, employeeId = null) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }

  return jwt.sign(
    {
      userId: user._id,
      employeeId,
      role: user.role,
      email: user.email,
      tenantId: user.tenantId ? user.tenantId.toString() : null
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    }
  );
};

export const verifyJwtToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};
