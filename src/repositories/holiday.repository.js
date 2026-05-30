import Holiday from "../models/holiday.model.js";
import { getHolidaysForYear } from "../utils/recurring-holiday.util.js";

export const findHolidayById = async (id, withUsers = false) => {
  const query = Holiday.findById(id);

  if (withUsers) {
    query.populate([
      {
        path: "createdBy",
        select: "name email role",
      },
      {
        path: "updatedBy",
        select: "name email role",
      },
    ]);
  }

  return query.exec();
};

export const findHolidaysWithPagination = async (
  filters = {},
  page = 1,
  limit = 20,
  withUsers = false,
) => {
  const query = {};

  if (filters.tenantId) {
    query.tenantId = filters.tenantId;
  }

  if (filters.search && filters.search.trim()) {
    const searchRegex = new RegExp(filters.search.trim(), "i");
    query.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  if (filters.year) {
    const year = parseInt(filters.year, 10);
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    query.date = {
      $gte: startOfYear,
      $lte: endOfYear,
    };
  }

  if (filters.recurring !== undefined && filters.recurring !== null) {
    query.isRecurringYearly = filters.recurring;
  }

  const skip = (page - 1) * limit;

  let findQuery = Holiday.find(query).sort({ date: 1 }).skip(skip).limit(limit);

  if (withUsers) {
    findQuery = findQuery.populate([
      { path: "createdBy", select: "name email role" },
      { path: "updatedBy", select: "name email role" },
    ]);
  } else {
    findQuery = findQuery.lean();
  }

  const [data, total] = await Promise.all([
    findQuery,
    Holiday.countDocuments(query),
  ]);

  const pages = Math.ceil(total / limit);

  return { data, total, page, limit, pages };
};

export const createHoliday = async (data, userId) => {
  const holiday = new Holiday({
    ...data,
    createdBy: userId,
  });

  return holiday.save();
};

export const updateHoliday = async (id, data, userId) => {
  return Holiday.findByIdAndUpdate(
    id,
    {
      ...data,
      updatedBy: userId,
    },
    { new: true, runValidators: true },
  );
};

export const deleteHoliday = async (id) => {
  return Holiday.findByIdAndDelete(id);
};

export const findHolidaysInDateRange = async (fromDate, toDate, tenantId) => {
  const fromYear = new Date(fromDate).getUTCFullYear();
  const toYear = new Date(toDate).getUTCFullYear();
  const start = new Date(fromDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setUTCHours(23, 59, 59, 999);

  const holidays = [];

  for (let year = fromYear; year <= toYear; year++) {
    const yearHolidays = await getHolidaysForYear(year, tenantId);
    for (const h of yearHolidays) {
      const d = new Date(h.date);
      if (d >= start && d <= end) {
        holidays.push(h);
      }
    }
  }

  return holidays;
};

export const checkDuplicateHolidayCrossYear = async (
  name,
  date,
  tenantId,
  excludeId = null,
) => {
  const d = new Date(date);
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  const match = {
    $expr: {
      $and: [
        { $eq: [{ $month: "$date" }, month + 1] },
        { $eq: [{ $dayOfMonth: "$date" }, day] },
      ],
    },
  };

  const query = {
    tenantId,
    name: name.trim(),
    ...match,
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const count = await Holiday.countDocuments(query);
  return count > 0;
};

export const checkDuplicateHoliday = async (name, date, tenantId, excludeId = null) => {
  const d = new Date(date);
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 24, 0, 0, 0),
  );

  const query = {
    tenantId,
    name: name.trim(),
    date: { $gte: start, $lt: end },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const count = await Holiday.countDocuments(query);
  return count > 0;
};
