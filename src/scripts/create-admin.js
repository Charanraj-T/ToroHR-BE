import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";

dotenv.config();

const createAdmin = async () => {
  try {
    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      console.log(`Admin already exists: ${existingUser.email}`);
      return;
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: "Admin",
      isActive: true
    });

    console.log(`Admin created: ${admin.email}`);
  } catch (error) {
    console.error(`Admin creation failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

connectDB().then(createAdmin);
