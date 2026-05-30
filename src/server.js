import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import connectDB from "./config/db.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import holidayRoutes from "./routes/holiday.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import claimRoutes from "./routes/claim.routes.js";
import payrollSettingsRoutes from "./routes/payroll-settings.routes.js";
import salaryStructureRoutes from "./routes/salary-structure.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import { startLeaveBalanceResetJob } from "./utils/leave.util.js";
import { startPayrollGenerationJob } from "./utils/payroll.util.js";
import { initializeHolidaysCache } from "./services/holiday.service.js";
import { getPayrollSettingsInternal } from "./services/payroll-settings.service.js";
import { runAutoPayrollGeneration } from "./services/payroll.service.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ToroHR API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/payroll", payrollSettingsRoutes);
app.use("/api/payroll", salaryStructureRoutes);
app.use("/api/payroll", payrollRoutes);

app.use(notFound);
app.use(errorHandler);

connectDB().then(() => {
  startLeaveBalanceResetJob();
  initializeHolidaysCache();
  startPayrollGenerationJob({
    getSettings: getPayrollSettingsInternal,
    runAutoGeneration: runAutoPayrollGeneration
  });

  app.listen(PORT, () => {
    console.log(`ToroHR server running on port ${PORT}`);
  });
});