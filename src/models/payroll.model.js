import mongoose from "mongoose";
import { PAYROLL_STATUSES } from "../utils/payroll.util.js";

const attendanceSnapshotSchema = new mongoose.Schema(
  {
    workingDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 }
  },
  { _id: false }
);

const fullTimeSalarySnapshotSchema = new mongoose.Schema(
  {
    basic: { type: Number, default: 0 },
    houseRentAllowance: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    gross: { type: Number, default: 0 },
    pf: { type: Number, default: 0 },
    lopDeduction: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 }
  },
  { _id: false }
);

const contractSalarySnapshotSchema = new mongoose.Schema(
  {
    dailyAmount: { type: Number, default: 0 },
    payableDays: { type: Number, default: 0 },
    totalPay: { type: Number, default: 0 }
  },
  { _id: false }
);

const companySnapshotSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: "" },
    logo: { type: String, default: "" },
    address: { type: String, default: "" }
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    payrollNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true
    },
    employeeName: {
      type: String,
      required: true,
      trim: true
    },
    employeeCode: {
      type: String,
      required: true,
      trim: true
    },
    designation: {
      type: String,
      default: ""
    },
    employmentType: {
      type: String,
      enum: ["Full-time", "Contract"],
      required: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true,
      min: 2000
    },
    companySnapshot: {
      type: companySnapshotSchema,
      default: () => ({})
    },
    attendanceSnapshot: {
      type: attendanceSnapshotSchema,
      default: () => ({})
    },
    salarySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    status: {
      type: String,
      enum: PAYROLL_STATUSES,
      default: "Draft"
    },
    processedAt: {
      type: Date,
      default: null
    },
    paidAt: {
      type: Date,
      default: null
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ status: 1, month: 1, year: 1 });
payrollSchema.index({ year: -1, month: -1, createdAt: -1 });

const Payroll = mongoose.model("Payroll", payrollSchema);

export default Payroll;
