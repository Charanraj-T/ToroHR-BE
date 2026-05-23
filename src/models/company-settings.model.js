import mongoose from "mongoose";

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
      default: "",
    },
    companyEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [200, "Company email cannot exceed 200 characters"],
      default: "",
    },
    companyPhone: {
      type: String,
      trim: true,
      maxlength: [20, "Company phone cannot exceed 20 characters"],
      default: "",
    },
    companyLogo: {
      type: String,
      trim: true,
      default: "",
    },
    addressLine1: {
      type: String,
      trim: true,
      maxlength: [200, "Address line 1 cannot exceed 200 characters"],
      default: "",
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, "Address line 2 cannot exceed 200 characters"],
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, "City cannot exceed 100 characters"],
      default: "",
    },
    state: {
      type: String,
      trim: true,
      maxlength: [100, "State cannot exceed 100 characters"],
      default: "",
    },
    country: {
      type: String,
      trim: true,
      maxlength: [100, "Country cannot exceed 100 characters"],
      default: "",
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: [20, "Postal code cannot exceed 20 characters"],
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const CompanySettings = mongoose.model("CompanySettings", companySettingsSchema);

export default CompanySettings;
