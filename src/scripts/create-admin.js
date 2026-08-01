import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";

dotenv.config();

const VALID_ROLES = ["SuperAdmin", "Admin", "Manager", "Employee"];

const createAdmin = async () => {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error("Missing required environment variables:");
    console.error("  ADMIN_NAME=Admin User");
    console.error("  ADMIN_EMAIL=admin@example.com");
    console.error("  ADMIN_PASSWORD=change_this_password");
    process.exit(1);
  }

  const role = process.env.ADMIN_ROLE || "SuperAdmin";
  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid ADMIN_ROLE "${role}". Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  try {
    await connectDB();

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log(`User with email "${email}" already exists. Skipping creation.`);
      return;
    }

    const admin = await User.create({
      name,
      email,
      password,
      role,
      isActive: true
    });

    console.log("Admin user created successfully:");
    console.log(`  Name:  ${admin.name}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
  } catch (error) {
    console.error("Failed to create admin:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
