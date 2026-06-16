import mongoose from "mongoose";
import { CLAIM_STATUSES } from "../utils/claim.util.js";
import fileAttachmentSchema from "./schemas/fileAttachment.schema.js";

const attachmentSchema = fileAttachmentSchema;

const claimSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"]
    },
    name: {
      type: String,
      required: [true, "Claim name is required"],
      trim: true,
      maxlength: [200, "Claim name cannot exceed 200 characters"]
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"]
    },
    expenseDate: {
      type: Date,
      required: [true, "Expense date is required"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: ""
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: "Pending"
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

claimSchema.index({ employeeId: 1, status: 1 });
claimSchema.index({ expenseDate: 1 });
claimSchema.index({ createdAt: -1 });
claimSchema.index({ status: 1, createdAt: -1 });

const Claim = mongoose.model("Claim", claimSchema);

export default Claim;
