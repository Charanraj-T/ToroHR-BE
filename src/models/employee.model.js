import mongoose from "mongoose";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "../utils/file.util.js";

const documentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true
    },
    mimeType: {
      type: String,
      enum: ALLOWED_MIME_TYPES,
      required: [true, "MIME type is required"]
    },
    size: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
      max: [MAX_FILE_SIZE, "File exceeds maximum allowed size"]
    },
    data: {
      type: Buffer,
      required: [true, "File data is required"]
    }
  },
  { _id: true }
);

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      index: true
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [60, "Full name cannot exceed 60 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters"]
    },
    countryCode: {
      type: String,
      trim: true,
      default: ""
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      maxlength: [15, "Invalid phone number"],
      match: [/^\d{5,15}$/, "Invalid phone number"]
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
    payrollAccess: {
      type: Boolean,
      default: false
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
    nationality: {
      type: String,
      trim: true,
      default: ""
    },
    address: {
      line1: { type: String, trim: true, default: "" },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
      postalCode: { type: String, trim: true, default: "" }
    },
    education: [
      {
        degree: { type: String, trim: true, default: "" },
        duration: { type: String, trim: true, default: "" },
        institute: { type: String, trim: true, default: "" },
        grade: { type: String, trim: true, default: "" }
      }
    ],
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
