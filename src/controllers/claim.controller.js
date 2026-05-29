import * as claimService from "../services/claim.service.js";
import {
  createClaimSchema,
  listClaimSchema,
  updateClaimSchema
} from "../validators/claim.validator.js";

const validate = (schema, payload, next) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const err = new Error(error.details.map((detail) => detail.message).join(", "));
    err.statusCode = 400;
    next(err);
    return null;
  }

  return value;
};

export const createClaim = async (req, res, next) => {
  try {
    const value = validate(createClaimSchema, req.body, next);
    if (!value) return;

    const claim = await claimService.createClaim(value, req.user);

    res.status(201).json({
      success: true,
      message: "Claim submitted successfully",
      data: { claim }
    });
  } catch (error) {
    next(error);
  }
};

export const getClaims = async (req, res, next) => {
  try {
    const value = validate(listClaimSchema, req.query, next);
    if (!value) return;

    const result = await claimService.getClaims(value, req.user);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const getClaimSummary = async (req, res, next) => {
  try {
    const summary = await claimService.getClaimSummary(req.user);

    res.status(200).json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    next(error);
  }
};

export const getClaimById = async (req, res, next) => {
  try {
    const claim = await claimService.getClaimById(req.params.id, req.user);

    res.status(200).json({
      success: true,
      data: { claim }
    });
  } catch (error) {
    next(error);
  }
};

export const updateClaim = async (req, res, next) => {
  try {
    const value = validate(updateClaimSchema, req.body, next);
    if (!value) return;

    const claim = await claimService.updateClaim(req.params.id, value, req.user);

    res.status(200).json({
      success: true,
      message: "Claim updated successfully",
      data: { claim }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteClaim = async (req, res, next) => {
  try {
    const result = await claimService.deleteClaim(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Claim deleted successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const approveClaim = async (req, res, next) => {
  try {
    const claim = await claimService.approveClaim(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Claim approved successfully",
      data: { claim }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectClaim = async (req, res, next) => {
  try {
    const claim = await claimService.rejectClaim(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Claim rejected successfully",
      data: { claim }
    });
  } catch (error) {
    next(error);
  }
};

export const cancelClaim = async (req, res, next) => {
  try {
    const claim = await claimService.cancelClaim(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Claim cancelled successfully",
      data: { claim }
    });
  } catch (error) {
    next(error);
  }
};

export const reimburseClaim = async (req, res, next) => {
  try {
    const claim = await claimService.reimburseClaim(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Claim marked as reimbursed successfully",
      data: { claim }
    });
  } catch (error) {
    next(error);
  }
};
