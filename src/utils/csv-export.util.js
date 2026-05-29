const HEADERS = ["Employee", "Worked", "Leave", "Holiday", "Absent", "Working Days"];

const escapeCsvField = (field) => {
  if (field === null || field === undefined) {
    return "";
  }

  const stringField = String(field);

  if (stringField.includes(",") || stringField.includes('"') || stringField.includes("\n")) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return stringField;
};

const generateCsvRow = (employee) => {
  const row = [
    employee.employeeName,
    employee.worked,
    employee.leave,
    employee.holiday,
    employee.absent,
    employee.workingDays
  ];

  return row.map((field) => escapeCsvField(field)).join(",");
};

export const generateCsvContent = (employees) => {
  if (!Array.isArray(employees) || employees.length === 0) {
    return HEADERS.map((h) => escapeCsvField(h)).join(",");
  }

  const lines = [HEADERS.map((h) => escapeCsvField(h)).join(",")];

  for (const emp of employees) {
    lines.push(generateCsvRow(emp));
  }

  return lines.join("\n");
};

export const generateCsvFilename = (month, year) => {
  return `attendance-summary-${year}-${String(month).padStart(2, "0")}.csv`;
};

export const setCsvResponseHeaders = (res, filename) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
};
