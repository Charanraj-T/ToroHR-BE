import mongoose from "mongoose";

const payrollSettingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true,
    },
    payrollGenerationDay: {
      type: Number,
      required: true,
      min: [1, "Payroll generation day must be between 1 and 28"],
      max: [28, "Payroll generation day must be between 1 and 28"],
      default: 1
    },
    defaultPF: {
      type: Number,
      required: true,
      min: [0, "Default PF must be 0 or greater"],
      default: 1800
    }
  },
  {
    timestamps: true
  }
);

const PayrollSettings = mongoose.model("PayrollSettings", payrollSettingsSchema);

export default PayrollSettings;
