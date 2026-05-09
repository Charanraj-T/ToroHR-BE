import mongoose from "mongoose";
import Employee from "../models/employee.model.js";

const employeePopulateOptions = [
  {
    path: "userId",
    select: "name email phoneNumber role isActive"
  },
  {
    path: "reportingManagerId",
    select: "fullName employeeId designation department",
    populate: {
      path: "userId",
      select: "role isActive"
    }
  }
];

export const generateEmployeeId = async (session) => {
  const counter = await mongoose.connection.collection("counters").findOneAndUpdate(
    { _id: "employeeId" },
    { $inc: { sequence: 1 } },
    {
      upsert: true,
      returnDocument: "after",
      session
    }
  );

  const sequence = counter.value?.sequence || counter.sequence;

  return `EMP${String(sequence).padStart(3, "0")}`;
};

export const createEmployee = (employeeData, session) => {
  return Employee.create([employeeData], { session });
};

export const findEmployeeById = (id) => {
  return Employee.findById(id).populate(employeePopulateOptions);
};

export const findEmployeeByUserId = (userId) => {
  return Employee.findOne({ userId }).populate(employeePopulateOptions);
};

export const findEmployeeByEmail = (email) => {
  return Employee.findOne({ email: email.toLowerCase() });
};

export const findEmployeeByPhone = (phoneNumber) => {
  return Employee.findOne({ phoneNumber });
};

export const countActiveEmployeesByManager = (managerId) => {
  return Employee.countDocuments({
    reportingManagerId: managerId,
    status: "Active"
  });
};

export const updateEmployeeById = (id, updateData, session) => {
  return Employee.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    session
  }).populate(employeePopulateOptions);
};

export const listEmployees = async ({ query, page, limit }) => {
  const skip = (page - 1) * limit;
  const sort = query.$text ? { score: { $meta: "textScore" }, createdAt: -1 } : { createdAt: -1 };

  const [total, data] = await Promise.all([
    Employee.countDocuments(query),
    Employee.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(employeePopulateOptions)
  ]);

  return {
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit) || 1,
    data
  };
};
