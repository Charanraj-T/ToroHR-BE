import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Employee from "../models/employee.model.js";
import { generateEmployeeId } from "../repositories/employee.repository.js";

dotenv.config();

const getEnvOrExit = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required in environment variables`);
  }
  return value;
};

const createAdmin = async () => {
  try {
    const name = getEnvOrExit("ADMIN_NAME");
    const email = getEnvOrExit("ADMIN_EMAIL");
    const password = getEnvOrExit("ADMIN_PASSWORD");
    const phone = getEnvOrExit("ADMIN_PHONE");
    const dob = getEnvOrExit("ADMIN_DOB");
    const joiningDate = getEnvOrExit("ADMIN_JOINING_DATE");
    const designation = getEnvOrExit("ADMIN_DESIGNATION");
    const department = getEnvOrExit("ADMIN_DEPARTMENT");
    const employmentType = getEnvOrExit("ADMIN_EMPLOYMENT_TYPE");

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      const existingEmployee = await Employee.findOne({ userId: existingUser._id });

      if (existingEmployee) {
        console.log(`Admin already exists: ${existingUser.email} (Employee: ${existingEmployee.employeeId})`);
        return;
      }

      console.log(`User exists: ${existingUser.email}. Creating Employee record...`);

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const employeeId = await generateEmployeeId(session);

          await Employee.create([{
            userId: existingUser._id,
            fullName: name,
            email: email.toLowerCase(),
            phoneNumber: existingUser.phoneNumber || phone,
            dateOfBirth: new Date(dob),
            employeeId,
            role: "Manager",
            joiningDate: new Date(joiningDate),
            designation,
            department,
            employmentType,
            status: "Active"
          }], { session });
        });

        console.log(`Employee record created for admin: ${email}`);
      } finally {
        await session.endSession();
      }

      return;
    }

    const session = await mongoose.startSession();
    try {
      let createdEmployeeId;

      await session.withTransaction(async () => {
        const employeeId = await generateEmployeeId(session);

        const [user] = await User.create([{
          name,
          email,
          phoneNumber: phone,
          password,
          role: "Admin",
          isActive: true
        }], { session });

        await Employee.create([{
          userId: user._id,
          fullName: name,
          email: email.toLowerCase(),
          phoneNumber: phone,
          dateOfBirth: new Date(dob),
          employeeId,
          role: "Manager",
          joiningDate: new Date(joiningDate),
          designation,
          department,
          employmentType,
          status: "Active"
        }], { session });

        createdEmployeeId = employeeId;
      });

      console.log(`Admin created: ${email} (Employee: ${createdEmployeeId})`);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error(`Admin creation failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

connectDB().then(createAdmin);
