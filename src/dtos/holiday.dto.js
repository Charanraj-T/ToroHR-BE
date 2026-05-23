const normalizeUser = (user) => {
  if (!user) return null;
  if (typeof user === "object" && user._id) {
    return { id: user._id, name: user.name, email: user.email };
  }
  return { id: user.toString(), name: undefined, email: undefined };
};

export const normalizeHoliday = (holiday) => {
  if (!holiday) {
    return null;
  }

  return {
    id: holiday._id,
    name: holiday.name,
    date: holiday.date,
    description: holiday.description,
    isRecurringYearly: holiday.isRecurringYearly,
    createdBy: normalizeUser(holiday.createdBy),
    updatedBy: normalizeUser(holiday.updatedBy),
    createdAt: holiday.createdAt,
    updatedAt: holiday.updatedAt,
  };
};

export const normalizeHolidayList = (holidays) => {
  if (!Array.isArray(holidays)) {
    return [];
  }

  return holidays.map(normalizeHoliday);
};
