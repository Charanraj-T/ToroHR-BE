import * as leaveService from "../services/leave.service.js";
import {
  cancelLeaveSchema,
  createLeaveSchema,
  listLeaveSchema,
  rejectLeaveSchema
} from "../validators/leave.validator.js";

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

export const createLeave = async (req, res, next) => {
  try {
    const value = validate(createLeaveSchema, req.body, next);
    if (!value) return;

    const leave = await leaveService.applyLeave(value, req.user);

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: {
        leave
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaves = async (req, res, next) => {
  try {
    const value = validate(listLeaveSchema, req.query, next);
    if (!value) return;

    const result = await leaveService.getLeaves(value, req.user);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaveById = async (req, res, next) => {
  try {
    const leave = await leaveService.getLeaveById(req.params.id, req.user);

    res.status(200).json({
      success: true,
      data: {
        leave
      }
    });
  } catch (error) {
    next(error);
  }
};

export const approveLeave = async (req, res, next) => {
  try {
    const leave = await leaveService.approveLeave(req.params.id, req.user);

    res.status(200).json({
      success: true,
      message: "Leave request approved successfully",
      data: {
        leave
      }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectLeave = async (req, res, next) => {
  try {
    const value = validate(rejectLeaveSchema, req.body, next);
    if (!value) return;

    const leave = await leaveService.rejectLeave(req.params.id, value, req.user);

    res.status(200).json({
      success: true,
      message: "Leave request rejected successfully",
      data: {
        leave
      }
    });
  } catch (error) {
    next(error);
  }
};

export const cancelLeave = async (req, res, next) => {
  try {
    const value = validate(cancelLeaveSchema, req.body, next);
    if (!value) return;

    const leave = await leaveService.cancelLeave(req.params.id, value, req.user);

    res.status(200).json({
      success: true,
      message: "Leave request cancelled successfully",
      data: {
        leave
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLeaves = async (req, res, next) => {
  try {
    const value = validate(listLeaveSchema, req.query, next);
    if (!value) return;

    const result = await leaveService.getMyLeaves(value, req.user);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLeaveBalance = async (req, res, next) => {
  try {
    const balance = await leaveService.getMyLeaveBalance(req.user);

    res.status(200).json({
      success: true,
      data: {
        balance
      }
    });
  } catch (error) {
    next(error);
  }
};


