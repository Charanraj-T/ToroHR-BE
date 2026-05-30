import mongoose from "mongoose";
import * as attendanceService from "../services/attendance.service.js";
import {
  checkInSchema,
  checkOutSchema,
  markAttendanceSchema,
  updateAttendanceSchema,
  getAttendanceFiltersSchema,
  exportAttendanceSchema
} from "../dtos/attendance.dto.js";
import { generateCsvContent, generateCsvFilename, setCsvResponseHeaders } from "../utils/csv-export.util.js";
import { getTodayIST } from "../utils/date.util.js";

export const checkIn = async (req, res, next) => {
  try {
    const { error } = checkInSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      return next(err);
    }

    const result = await attendanceService.checkIn(req.user.employeeId);

    res.status(200).json({
      success: true,
      message: "Checked in successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const checkOut = async (req, res, next) => {
  try {
    const { error } = checkOutSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      return next(err);
    }

    const result = await attendanceService.checkOut(req.user.employeeId);

    res.status(200).json({
      success: true,
      message: "Checked out successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const markAttendanceManually = async (req, res, next) => {
  try {
    const { error, value } = markAttendanceSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      return next(err);
    }

    const { employeeId, date, status, checkInTime, checkOutTime } = value;

    if (req.user.role === "Manager") {
      if (employeeId !== req.user.employeeId) {
        const employee = await mongoose.model("Employee").findById(employeeId);
        if (!employee) {
          const err = new Error("Employee not found");
          err.statusCode = 404;
          return next(err);
        }
        if (!employee.reportingManagerId || employee.reportingManagerId.toString() !== req.user.employeeId) {
          const permError = new Error("You can only mark attendance for your team members");
          permError.statusCode = 403;
          return next(permError);
        }
      }
    }

    const result = await attendanceService.markAttendanceManual(
      employeeId,
      date,
      status,
      checkInTime,
      checkOutTime,
      req.user.employeeId,
      req.user.role === "Admin" ? "Admin Override" : "Manager Override"
    );

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Invalid attendance ID");
      error.statusCode = 400;
      return next(error);
    }

    const { error, value } = updateAttendanceSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      return next(err);
    }

    const result = await attendanceService.updateAttendanceRecord(id, value, req.user);

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendance = async (req, res, next) => {
  try {
    const { error, value } = getAttendanceFiltersSchema.validate(req.query);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      return next(err);
    }

    let result;

    if (req.user.role === "Admin") {
      result = await attendanceService.getAllAttendance({ ...value, tenantId: req.user.tenantId });
    } else if (req.user.role === "Manager") {
      result = await attendanceService.getTeamAttendance(req.user.employeeId, value);
    } else {
      value.employeeId = req.user.employeeId;
      result = await attendanceService.getMyAttendance(req.user.employeeId, value);
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Invalid attendance ID");
      error.statusCode = 400;
      return next(error);
    }

    const attendance = await attendanceService.getAttendanceById(id);


    const empId = attendance.employeeId?._id || attendance.employeeId;
    if (!empId) {
      const error = new Error("Attendance record has no associated employee");
      error.statusCode = 400;
      return next(error);
    }

    if (
      req.user.role === "Employee" &&
      empId.toString() !== req.user.employeeId
    ) {
      const error = new Error("You do not have permission to view this attendance record");
      error.statusCode = 403;
      return next(error);
    }

    if (req.user.role === "Manager" && empId.toString() !== req.user.employeeId) {
      const employee = await mongoose.model("Employee").findById(empId);

      if (!employee || !employee.reportingManagerId || employee.reportingManagerId.toString() !== req.user.employeeId) {
        const error = new Error("You do not have permission to view this attendance record");
        error.statusCode = 403;
        return next(error);
      }
    }

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

export const getMyAttendanceStatus = async (req, res, next) => {
  try {
    const result = await attendanceService.hasCheckedInToday(req.user.employeeId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getSummary = async (req, res, next) => {
  try {
    const filters = {};

    if (req.user.role === "Manager") {
      filters.managerId = req.user.employeeId;
    }

    const result = await attendanceService.getAttendanceSummary(filters);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const exportCsv = async (req, res, next) => {
  try {
    const { error, value } = exportAttendanceSchema.validate(req.query, { stripUnknown: true });
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      return next(err);
    }

    const { startDate, endDate, employeeId, department, managerId } = value;

    let filters = { department };

    if (employeeId) {
      filters.employeeId = employeeId;
    }

    if (managerId) {
      filters.managerId = managerId;
    }

    if (req.user.role === "Employee") {
      filters.employeeId = req.user.employeeId;
    }

    if (req.user.role === "Manager") {
      delete filters.employeeId;
      filters.managerId = req.user.employeeId;
    }

    if (req.user.role === "Admin") {
      filters.tenantId = req.user.tenantId;
    }

    const employees = await attendanceService.getAttendanceForExport(startDate, endDate, filters);

    if (!employees || employees.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No records found for export"
      });
    }

    const csvContent = generateCsvContent(employees);
    const [y, m] = startDate.split("-").map(Number);
    const filename = generateCsvFilename(m, y);

    setCsvResponseHeaders(res, filename);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};

export const getEmployeeStats = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    const todayIST = getTodayIST();
    const queryMonth = month || todayIST.getUTCMonth() + 1;
    const queryYear = year || todayIST.getUTCFullYear();

    const result = await attendanceService.getEmployeeStats(
      req.user.employeeId,
      parseInt(queryMonth),
      parseInt(queryYear)
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Invalid attendance ID");
      error.statusCode = 400;
      return next(error);
    }

    const result = await attendanceService.deleteAttendanceRecord(id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
