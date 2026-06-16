import * as ipWhitelistService from "../services/ipWhitelist.service.js";

export const getAllowedIps = async (req, res, next) => {
  try {
    const ranges = await ipWhitelistService.getAllowedIps(req.user.tenantId);
    res.status(200).json({ success: true, data: ranges });
  } catch (error) {
    next(error);
  }
};

export const addIpRange = async (req, res, next) => {
  try {
    const { ipRange, label } = req.body;

    if (!ipRange) {
      const error = new Error("IP range is required");
      error.statusCode = 400;
      return next(error);
    }

    const result = await ipWhitelistService.addIpRange(
      req.user.tenantId,
      ipRange,
      label || "",
      req.user.userId
    );

    res.status(201).json({
      success: true,
      message: "IP range added successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const removeIpRange = async (req, res, next) => {
  try {
    const result = await ipWhitelistService.removeIpRange(req.params.id, req.user.tenantId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
