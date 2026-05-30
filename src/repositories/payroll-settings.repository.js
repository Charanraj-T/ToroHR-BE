import PayrollSettings from "../models/payroll-settings.model.js";

export const getPayrollSettings = async () => {
  return PayrollSettings.findOneAndUpdate(
    {},
    { $setOnInsert: { payrollGenerationDay: 1, defaultPF: 1800 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

export const updatePayrollSettings = async (data) => {
  return PayrollSettings.findOneAndUpdate(
    {},
    { $set: data },
    { new: true, upsert: true, runValidators: true }
  ).lean();
};
