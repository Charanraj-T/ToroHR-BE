import mongoose from "mongoose";
import { ALLOWED_MIME_TYPES, CLAIM_STATUSES, MAX_ATTACHMENT_SIZE } from "../utils/claim.util.js";

const attachmentSchema = new mongoose.Schema(
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
      max: [MAX_ATTACHMENT_SIZE, "File exceeds maximum allowed size"]
    },
    data: {
      type: Buffer,
      required: [true, "File data is required"]
    }
  },
  { _id: true }
);

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
