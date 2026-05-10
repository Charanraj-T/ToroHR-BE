import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"]
    },
    date: {
      type: Date,
      required: [true, "Attendance date is required"]
    },
    checkInTime: {
      type: Date,
      default: null
    },
    checkOutTime: {
      type: Date,
      default: null
    },
    hoursWorked: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Leave", "Weekend", "Half-day"],
      default: "Absent"
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },
    markingMethod: {
      type: String,
      enum: ["Self", "Admin Override", "Manager Override"],
      default: "Self"
    },
    isLateCheckIn: {
      type: Boolean,
      default: false
    },
    lateCheckInMinutes: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });
attendanceSchema.index({ status: 1 });

attendanceSchema.virtual("formattedDate").get(function () {
  return this.date?.toISOString().split("T")[0];
});

attendanceSchema.set("toJSON", { virtuals: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
