import AllowedIp from "../models/allowedIp.model.js";
import { isCidrValid } from "../utils/ip.util.js";

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

export const getAllowedIps = async (tenantId) => {
  if (!tenantId) return [];
  return await AllowedIp.find({ tenantId }).sort({ createdAt: -1 }).lean();
};

export const addIpRange = async (tenantId, ipRange, label, userId) => {
  if (!tenantId) throwError("Tenant ID is required", 400);

  const range = ipRange.trim();

  if (!isCidrValid(range)) {
    throwError("Invalid IP range. Use CIDR notation, e.g. 192.168.1.0/24", 400);
  }

  const existing = await AllowedIp.findOne({ tenantId, ipRange: range });

  if (existing) {
    throwError(`IP range "${range}" is already whitelisted`, 409);
  }

  const [record] = await AllowedIp.create([
    {
      tenantId,
      ipRange: range,
      label: label.trim() || "",
      createdBy: userId || null
    }
  ]);

  return record.toObject();
};

export const removeIpRange = async (id, tenantId) => {
  const record = await AllowedIp.findOneAndDelete({ _id: id, tenantId });

  if (!record) {
    throwError("IP range not found", 404);
  }

  return { message: "IP range removed successfully" };
};
