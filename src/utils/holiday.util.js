export const getStartOfDay = (date) => {
  const parsed = new Date(date);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
};

export const parseDateOnly = (dateString) => {
  const parsed = new Date(`${dateString}T00:00:00.000Z`);
  return getStartOfDay(parsed);
};

export const getYear = (date = new Date()) => {
  return new Date(date).getUTCFullYear();
};
