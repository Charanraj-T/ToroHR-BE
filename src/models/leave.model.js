import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"]
    },
    leaveType: {
      type: String,
      enum: ["CL", "SL", "PL", "LOP"],
      required: [true, "Leave type is required"]
    },
    fromDate: {
      type: Date,
      required: [true, "From date is required"]
    },
    toDate: {
      type: Date,
      required: [true, "To date is required"]
    },
    leaveDays: {
      type: Number,
      required: true,
      min: 0.5
    },
    dayType: {
      type: String,
      enum: ["Full-day", "Half-day"],
      default: "Full-day",
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
      default: ""
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending"
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
      default: ""
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
      default: ""
    }
  },
  {
    timestamps: true
  }
);

leaveSchema.index({ employeeId: 1, status: 1, fromDate: 1 });
leaveSchema.index({ employeeId: 1, status: 1, createdAt: -1 });
leaveSchema.index({ leaveType: 1, status: 1 });
leaveSchema.index({ status: 1, createdAt: -1 });

const Leave = mongoose.model("Leave", leaveSchema);

export default Leave;
