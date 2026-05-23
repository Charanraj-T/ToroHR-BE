import mongoose from "mongoose";

const leaveBalanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"]
    },
    year: {
      type: Number,
      required: [true, "Leave balance year is required"]
    },
    CL: {
      type: Number,
      default: 12,
      min: 0
    },
    SL: {
      type: Number,
      default: 12,
      min: 0
    },
    PL: {
      type: Number,
      default: 12,
      min: 0
    },
    LOP: {
      type: Number,
      default: 0,
      min: 0
    },
    lastResetAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

leaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);

export default LeaveBalance;
