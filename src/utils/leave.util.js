import Employee from "../models/employee.model.js";
import LeaveBalance from "../models/leave-balance.model.js";

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

export const getStartOfDay = (date) => {
  const parsed = new Date(date);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
};

export const getEndOfDay = (date) => {
  const parsed = new Date(date);
  parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
};

export const parseDateOnly = (date) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return getStartOfDay(parsed);
};

export const isWeekend = (date) => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

export const calculateLeaveDays = (fromDate, toDate, dayType = "Full-day") => {
  const start = getStartOfDay(fromDate);
  const end = getStartOfDay(toDate);

  if (start > end) {
    return 0;
  }

  if (dayType === "Half-day") {
    return start.getTime() === end.getTime() && !isWeekend(start) ? 0.5 : 0;
  }

  let total = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    if (!isWeekend(cursor)) {
      total += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return total;
};

export const getWorkingDatesBetween = (fromDate, toDate) => {
  const dates = [];
  const cursor = getStartOfDay(fromDate);
  const end = getStartOfDay(toDate);

  while (cursor <= end) {
    if (!isWeekend(cursor)) {
      dates.push(new Date(cursor));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

export const getLeaveYear = (date = new Date()) => {
  return new Date(date).getUTCFullYear();
};

const buildDefaultLeaveBalance = (employeeId, year, lastResetAt = null) => ({
  employeeId,
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

export const resetYearlyLeaveBalances = async (year = new Date().getUTCFullYear()) => {
  const employees = await Employee.find({ status: "Active" }).select("_id").lean();
  const resetAt = new Date();

  const operations = employees.map((employee) => {
    const { LOP, ...resetData } = buildDefaultLeaveBalance(employee._id, year, resetAt);
    return {
    updateOne: {
      filter: { employeeId: employee._id, year },
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

const getLatestResetYear = async () => {
  try {
    const latest = await LeaveBalance.findOne().sort({ year: -1 }).select("year").lean();
    return latest?.year || null;
  } catch {
    return null;
  }
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
    const result = await resetYearlyLeaveBalances(lastRunYear);
    console.log(`Leave balances reset for ${lastRunYear}`, result);
  };

  const catchUpMissedReset = async () => {
    const currentYear = new Date().getUTCFullYear();
    const latestYear = await getLatestResetYear();

    if (latestYear !== null && latestYear < currentYear) {
      console.log(`Missed leave balance reset detected. Latest: ${latestYear}, Current: ${currentYear}. Running catch-up reset.`);
      const result = await resetYearlyLeaveBalances(currentYear);
      console.log(`Catch-up leave balances reset for ${currentYear}`, result);
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
