import PayrollSettings from "../models/payroll-settings.model.js";

export const createPayrollSettings = async (tenantId) => {
  const [settings] = await PayrollSettings.create([
    { tenantId, payrollGenerationDay: 1, defaultPF: 1800 },
  ]);
  return settings.toObject();
};

export const getPayrollSettings = async (tenantId) => {
  return PayrollSettings.findOne({ tenantId }).lean();
};

export const updatePayrollSettings = async (data) => {
  const { tenantId, ...rest } = data;
  return PayrollSettings.findOneAndUpdate(
    { tenantId },
    { $set: rest },
    { new: true, runValidators: true }
  ).lean();
};
