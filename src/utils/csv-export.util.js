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

const formatTime = (dateTime) => {
  if (!dateTime) return "";
  return new Date(dateTime).toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IN");
};

const generateCsvHeaders = () => {
  const headers = [
    "Employee ID",
    "Employee Name",
    "Date",
    "Check-In Time",
    "Check-Out Time",
    "Hours Worked",
    "Status",
    "Department",
    "Marking Method",
    "Notes"
  ];

  return headers.map((header) => escapeCsvField(header)).join(",");
};

const generateCsvRow = (attendance) => {
  const employee = attendance.employeeId;

  const row = [
    employee.employeeId || "",
    employee.fullName || "",
    formatDate(attendance.date),
    formatTime(attendance.checkInTime),
    formatTime(attendance.checkOutTime),
    attendance.hoursWorked || 0,
    attendance.status || "",
    employee.department || "",
    attendance.markingMethod || "",
    attendance.notes || ""
  ];

  return row.map((field) => escapeCsvField(field)).join(",");
};

export const generateCsvContent = (attendanceRecords) => {
  if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
    return generateCsvHeaders();
  }

  const lines = [generateCsvHeaders()];

  for (const record of attendanceRecords) {
    lines.push(generateCsvRow(record));
  }

  return lines.join("\n");
};

export const generateCsvFilename = () => {
  const now = new Date();
  const timestamp = now.toISOString().split("T")[0];
  return `attendance_export_${timestamp}.csv`;
};

export const setCsvResponseHeaders = (res, filename) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
};
