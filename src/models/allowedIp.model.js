import mongoose from "mongoose";

const allowedIpSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is required"]
    },
    ipRange: {
      type: String,
      required: [true, "IP range is required"],
      trim: true
    },
    label: {
      type: String,
      trim: true,
      default: ""
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

allowedIpSchema.index({ tenantId: 1 });

const AllowedIp = mongoose.model("AllowedIp", allowedIpSchema);

export default AllowedIp;
