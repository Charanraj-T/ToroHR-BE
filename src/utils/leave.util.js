import Employee from "../models/employee.model.js";
import LeaveBalance from "../models/leave-balance.model.js";
import Tenant from "../models/tenant.model.js";
import { getStartOfDay, getEndOfDay, parseDateOnly, isWeekend, getYear } from "./date.util.js";

export { getStartOfDay, getEndOfDay, parseDateOnly, isWeekend, getYear };

export const LEAVE_TYPES = ["CL", "SL", "PL", "LOP"];
export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"];
export const ACTIVE_LEAVE_STATUSES = ["Pending", "Approved"];
export const LEAVE_DAY_TYPES = ["Full-day", "Half-day"];
const DEFAULT_LEAVE_BALANCE = {
  CL: 12,
  SL: 12,
  PL: 12,
  LOP: 0
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const calculateLeaveDays = (fromDate, toDate, dayType = "Full-day", weekendDays = [0, 6]) => {
  const start = getStartOfDay(fromDate);
  const end = getStartOfDay(toDate);

  if (start > end) {
    return 0;
  }

  if (dayType === "Half-day") {
    return start.getTime() === end.getTime() && !isWeekend(start, weekendDays) ? 0.5 : 0;
  }

  let total = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    if (!isWeekend(cursor, weekendDays)) {
      total += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return total;
};

export const getWorkingDatesBetween = (fromDate, toDate, excludeDates = [], weekendDays = [0, 6]) => {
  const excludeSet = new Set();
  for (const d of excludeDates) {
    const dt = new Date(d);
    excludeSet.add(dt.toISOString().split('T')[0]);
  }

  const dates = [];
  const cursor = getStartOfDay(fromDate);
  const end = getStartOfDay(toDate);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (!isWeekend(cursor, weekendDays) && !excludeSet.has(dateStr)) {
      dates.push(new Date(cursor));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

export const getLeaveYear = getYear;

const buildDefaultLeaveBalance = (employeeId, year, tenantId = null, lastResetAt = null) => ({
  employeeId,
  tenantId,
  year,
  ...DEFAULT_LEAVE_BALANCE,
  lastResetAt
});

export const getBalanceUpdateForReversal = (leaveType, leaveDays) => {
  if (leaveType === "LOP") {
    return { $inc: { LOP: -leaveDays } };
  }

  return { $inc: { [leaveType]: leaveDays } };
};

export const resetYearlyLeaveBalances = async (year = new Date().getUTCFullYear(), tenantId = null) => {
  const employeeFilter = { status: "Active" };
  if (tenantId) employeeFilter.tenantId = tenantId;

  const employees = await Employee.find(employeeFilter).select("_id").lean();
  const resetAt = new Date();

  const operations = employees.map((employee) => {
    const allFields = buildDefaultLeaveBalance(employee._id, year, tenantId, resetAt);
    const { LOP, ...resetData } = allFields;
    const filter = { employeeId: employee._id, year };
    if (tenantId) filter.tenantId = tenantId;
    return {
    updateOne: {
      filter,
      update: { $set: resetData },
      upsert: true
    }
    };
  });

  if (operations.length === 0) {
    return { matched: 0, modified: 0, upserted: 0 };
  }

  const result = await LeaveBalance.bulkWrite(operations);

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount
  };
};

const shouldRunLeaveResetToday = (now) => now.getUTCMonth() === 0 && now.getUTCDate() === 1;

let _resetInterval = null;

export const getLatestResetYear = async (tenantId = null) => {
  try {
    const filter = tenantId ? { tenantId } : {};
    const latest = await LeaveBalance.findOne(filter).sort({ year: -1 }).select("year").lean();
    return latest?.year || null;
  } catch {
    return null;
  }
};

const getActiveTenantIds = async () => {
  const tenants = await Tenant.find({ status: "Active" }).select("_id").lean();
  return tenants.map((tenant) => tenant._id);
};

export const startLeaveBalanceResetJob = () => {
  if (_resetInterval) {
    clearInterval(_resetInterval);
  }

  let lastRunYear = null;

  const runIfDue = async () => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();

    if (!shouldRunLeaveResetToday(now) || lastRunYear === currentYear) {
      return;
    }

    lastRunYear = currentYear;
    const tenantIds = await getActiveTenantIds();

    for (const tenantId of tenantIds) {
      const result = await resetYearlyLeaveBalances(lastRunYear, tenantId);
      console.log(`Leave balances reset for ${lastRunYear} (tenant: ${tenantId})`, result);
    }
  };

  const catchUpMissedReset = async () => {
    const currentYear = new Date().getUTCFullYear();
    const tenantIds = await getActiveTenantIds();

    for (const tenantId of tenantIds) {
      const latestYear = await getLatestResetYear(tenantId);

      if (latestYear !== null && latestYear < currentYear) {
        console.log(`Missed leave balance reset detected (tenant: ${tenantId}). Latest: ${latestYear}, Current: ${currentYear}. Running catch-up reset.`);
        const result = await resetYearlyLeaveBalances(currentYear, tenantId);
        console.log(`Catch-up leave balances reset for ${currentYear} (tenant: ${tenantId})`, result);
      }
    }
  };

  catchUpMissedReset().catch((error) => {
    console.error("Leave balance catch-up reset failed", error);
  });

  runIfDue().catch((error) => {
    console.error("Leave balance reset failed", error);
  });

  _resetInterval = setInterval(() => {
    runIfDue().catch((error) => {
      console.error("Leave balance reset failed", error);
    });
  }, ONE_DAY_MS);

  return _resetInterval;
};
