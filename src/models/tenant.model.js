import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
    },
    companyEmail: {
      type: String,
      required: [true, "Company email is required"],
      trim: true,
      lowercase: true,
      maxlength: [200, "Company email cannot exceed 200 characters"],
    },
    companyPhone: {
      type: String,
      required: [true, "Company phone is required"],
      trim: true,
      maxlength: [20, "Company phone cannot exceed 20 characters"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

const Tenant = mongoose.model("Tenant", tenantSchema);

export default Tenant;
