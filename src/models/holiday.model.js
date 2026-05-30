import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
      maxlength: [100, "Holiday name cannot exceed 100 characters"],
    },
    date: {
      type: Date,
      required: [true, "Holiday date is required"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    isRecurringYearly: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

holidaySchema.index({ tenantId: 1, date: 1, name: 1 }, { unique: true });

holidaySchema.index({ tenantId: 1, date: 1, isRecurringYearly: 1 });

const Holiday = mongoose.model("Holiday", holidaySchema);
export default Holiday;
