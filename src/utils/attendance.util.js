export const getStartOfDayIST = (date) => {
  const [y, m, d] = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

export const getEndOfDayIST = (date) => {
  const [y, m, d] = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
};

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
  const istDateStr = checkInDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
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
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  const todayIST = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));

  const [cy, cm, cd] = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  const checkDateIST = new Date(Date.UTC(cy, cm - 1, cd, 0, 0, 0, 0));

  return checkDateIST > todayIST;
};
