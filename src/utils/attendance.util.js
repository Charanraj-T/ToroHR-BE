import { getStartOfDayIST } from "./date.util.js";

export const calculateHoursWorked = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) {
    return 0;
  }

  const diffMs = new Date(checkOutTime) - new Date(checkInTime);

  if (diffMs < 0) {
    return 0;
  }

  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.round(diffHours * 100) / 100;
};

export const findOpenPunch = (punches = []) => {
  return punches.find((p) => p && p.checkInTime && !p.checkOutTime) || null;
};

export const sumPunchHours = (punches = []) => {
  let total = 0;
  for (const punch of punches) {
    total += calculateHoursWorked(punch?.checkInTime, punch?.checkOutTime);
  }
  return Math.round(total * 100) / 100;
};

export const normalizePunches = (punches, dateStr) => {
  const parseTime = (t) => (t ? new Date(`${dateStr}T${t}+05:30`) : null);

  const normalized = (punches || [])
    .map((p) => ({
      checkInTime: parseTime(p.checkInTime),
      checkOutTime: parseTime(p.checkOutTime)
    }))
    .filter((p) => p.checkInTime || p.checkOutTime);

  let openCount = 0;
  for (const p of normalized) {
    if (p.checkOutTime && !p.checkInTime) {
      const error = new Error("Check-in time is required for each session");
      error.statusCode = 400;
      throw error;
    }
    if (p.checkInTime && p.checkOutTime && p.checkOutTime < p.checkInTime) {
      const error = new Error("Check-out time cannot be before check-in time");
      error.statusCode = 400;
      throw error;
    }
    if (p.checkInTime && !p.checkOutTime) openCount++;
    if (openCount > 1) {
      const error = new Error("Only one open session is allowed per day");
      error.statusCode = 400;
      throw error;
    }
  }

  return normalized;
};

export const checkIfLate = (punches, gracePeriodMinutes = 5) => {
  const firstPunch = Array.isArray(punches) ? punches[0] : punches;
  const checkInTime = firstPunch?.checkInTime || firstPunch;

  if (!checkInTime) {
    return { isLate: false, minutesLate: 0 };
  }

  const checkInDate = new Date(checkInTime);
  const istDateStr = checkInDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const officeStartIST = new Date(`${istDateStr}T09:00:00+05:30`);

  const diffMs = checkInDate - officeStartIST;
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes > gracePeriodMinutes) {
    return {
      isLate: true,
      minutesLate: diffMinutes - gracePeriodMinutes
    };
  }

  return { isLate: false, minutesLate: 0 };
};

export const isFutureDate = (date) => {
  const now = new Date();
  const todayIST = getStartOfDayIST(now);
  const checkDateIST = getStartOfDayIST(date);
  return checkDateIST > todayIST;
};
