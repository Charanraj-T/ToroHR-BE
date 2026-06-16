import mongoose from "mongoose";
import fileAttachmentSchema from "./schemas/fileAttachment.schema.js";

const documentSchema = fileAttachmentSchema;

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"]
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true
    },
    role: {
      type: String,
      enum: ["Manager", "Employee"],
      required: true
    },
    joiningDate: {
      type: Date,
      required: [true, "Joining date is required"]
    },
    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true
    },
    reportingManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },
    employmentType: {
      type: String,
      enum: ["Full-time", "Contract"],
      required: [true, "Employment type is required"]
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active"
    },
    accountNumber: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      uppercase: true,
      trim: true
    },
    branchName: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    panNumber: {
      type: String,
      uppercase: true,
      trim: true
    },
    aadhaarNumber: {
      type: String,
      trim: true
    },
    documents: {
      type: [documentSchema],
      default: []
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    modifiedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

employeeSchema.index({ fullName: "text", employeeId: "text" });

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
