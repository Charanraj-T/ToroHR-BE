import mongoose from "mongoose";

const salaryStructureSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"]
    },
    employmentType: {
      type: String,
      enum: ["Full-time", "Contract"],
      required: [true, "Employment type is required"]
    },
    effectiveMonth: {
      type: Number,
      required: [true, "Effective month is required"],
      min: 1,
      max: 12
    },
    effectiveYear: {
      type: Number,
      required: [true, "Effective year is required"],
      min: 2000
    },
    basic: {
      type: Number,
      min: [0, "Basic must be 0 or greater"],
      default: 0
    },
    houseRentAllowance: {
      type: Number,
      min: [0, "HRA must be 0 or greater"],
      default: 0
    },
    specialAllowance: {
      type: Number,
      min: [0, "Special allowance must be 0 or greater"],
      default: 0
    },
    pf: {
      type: Number,
      min: [0, "PF must be 0 or greater"],
      default: null
    },
    dailyAmount: {
      type: Number,
      min: [0, "Daily amount must be 0 or greater"],
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

salaryStructureSchema.index({ employeeId: 1, effectiveYear: -1, effectiveMonth: -1 });
salaryStructureSchema.index({ employeeId: 1, effectiveMonth: 1, effectiveYear: 1 }, { unique: true });

const SalaryStructure = mongoose.model("SalaryStructure", salaryStructureSchema);

export default SalaryStructure;
