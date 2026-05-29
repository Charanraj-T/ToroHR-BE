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

export const checkIfLate = (checkInTime, gracePeriodMinutes = 5) => {
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
