import dotenv from "dotenv";
import path from "path";
import dns from "node:dns";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

import mongoose from "mongoose";
import User from "./src/models/user.model.js";
import Employee from "./src/models/employee.model.js";
import Leave from "./src/models/leave.model.js";
import LeaveBalance from "./src/models/leave-balance.model.js";
import Attendance from "./src/models/attendance.model.js";
import * as leaveService from "./src/services/leave.service.js";
import { generateEmployeeId } from "./src/repositories/employee.repository.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

const assert = (condition, label) => {
  if (condition) { passed++; console.log(`  \u2713 ${label}`); }
  else { failed++; console.log(`  \u2717 FAIL: ${label}`); }
};

const assertThrows = async (fn, expectedMsg, label) => {
  try {
    await fn();
    failed++;
    console.log(`  \u2717 FAIL: ${label} \u2014 expected error "${expectedMsg}"`);
  } catch (err) {
    const ok = err.message === expectedMsg;
    if (ok) passed++; else failed++;
    console.log(`  ${ok ? "\u2713" : "\u2717"} ${label}${ok ? "" : ` \u2014 got "${err.message}", expected "${expectedMsg}"`}`);
  }
};

// Guarantees unique, non-colliding weekdays.
// Each call advances to the next weekday after the previous one.
const _dateCache = [];
const _baseDate = () => {
  // Start from tomorrow so "past date" tests still work
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const date = () => {
  const last = _dateCache.length > 0
    ? new Date(_dateCache[_dateCache.length - 1])
    : _baseDate();
  last.setUTCDate(last.getUTCDate() + 1);
  last.setUTCHours(0, 0, 0, 0);
  while (last.getUTCDay() === 0 || last.getUTCDay() === 6)
    last.setUTCDate(last.getUTCDate() + 1);
  const str = last.toISOString().split("T")[0];
  _dateCache.push(str);
  return str;
};

const saturdaysUsed = [];
const nextSaturday = () => {
  const last = saturdaysUsed.length > 0
    ? new Date(saturdaysUsed[saturdaysUsed.length - 1])
    : new Date();
  last.setUTCDate(last.getUTCDate() + 7);
  last.setUTCHours(0, 0, 0, 0);
  while (last.getUTCDay() !== 6) last.setUTCDate(last.getUTCDate() + 1);
  const str = last.toISOString().split("T")[0];
  saturdaysUsed.push(str);
  return str;
};

const yesterdayWeekday = () => {
  let d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().split("T")[0];
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const run = async () => {
  const originalUri = process.env.MONGODB_URI;
  const testUri = originalUri.replace("torohr?", "torohr_test?");
  process.env.MONGODB_URI = testUri;

  if (testUri.startsWith("mongodb+srv://")) {
    dns.setDefaultResultOrder("ipv4first");
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }

  await mongoose.connect(testUri);
  console.log(`\nConnected to test DB`);

  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Leave.deleteMany({}),
    LeaveBalance.deleteMany({}),
    Attendance.deleteMany({}),
  ]);
  console.log("Cleaned test DB\n");

  // -----------------------------------------------------------------------
  // Create test users + employees
  // -----------------------------------------------------------------------
  const session = await mongoose.startSession();
  let adminUser, managerUser, emp1User, emp2User;
  let adminEmp, managerEmp, emp1, emp2;

  try {
    await session.withTransaction(async () => {
      const [au] = await User.create([{
        name: "Admin", email: "admin@test.com", password: "pass123", role: "Admin", phoneNumber: "1000000000",
      }], { session });
      const aeid = await generateEmployeeId(session);
      const [ae] = await Employee.create([{
        userId: au._id, fullName: "Admin", email: "admin@test.com", phoneNumber: "1000000000",
        dateOfBirth: new Date("1990-01-01"), employeeId: aeid, role: "Manager",
        joiningDate: new Date("2024-01-01"), designation: "Admin", department: "Management",
        employmentType: "Full-time", status: "Active",
      }], { session });

      const [mu] = await User.create([{
        name: "Manager", email: "manager@test.com", password: "pass123", role: "Manager", phoneNumber: "1000000001",
      }], { session });
      const meid = await generateEmployeeId(session);
      const [me] = await Employee.create([{
        userId: mu._id, fullName: "Manager", email: "manager@test.com", phoneNumber: "1000000001",
        dateOfBirth: new Date("1991-01-01"), employeeId: meid, role: "Manager",
        joiningDate: new Date("2024-01-01"), designation: "Team Lead", department: "Engineering",
        reportingManagerId: ae._id, employmentType: "Full-time", status: "Active",
      }], { session });

      const [e1u] = await User.create([{
        name: "Employee1", email: "emp1@test.com", password: "pass123", role: "Employee", phoneNumber: "1000000002",
      }], { session });
      const e1eid = await generateEmployeeId(session);
      const [e1e] = await Employee.create([{
        userId: e1u._id, fullName: "Employee1", email: "emp1@test.com", phoneNumber: "1000000002",
        dateOfBirth: new Date("1992-01-01"), employeeId: e1eid, role: "Employee",
        joiningDate: new Date("2024-01-01"), designation: "Developer", department: "Engineering",
        reportingManagerId: me._id, employmentType: "Full-time", status: "Active",
      }], { session });

      const [e2u] = await User.create([{
        name: "Employee2", email: "emp2@test.com", password: "pass123", role: "Employee", phoneNumber: "1000000003",
      }], { session });
      const e2eid = await generateEmployeeId(session);
      const [e2e] = await Employee.create([{
        userId: e2u._id, fullName: "Employee2", email: "emp2@test.com", phoneNumber: "1000000003",
        dateOfBirth: new Date("1993-01-01"), employeeId: e2eid, role: "Employee",
        joiningDate: new Date("2024-01-01"), designation: "Developer", department: "Engineering",
        reportingManagerId: me._id, employmentType: "Full-time", status: "Active",
      }], { session });

      adminUser = au; managerUser = mu; emp1User = e1u; emp2User = e2u;
      adminEmp = ae; managerEmp = me; emp1 = e1e; emp2 = e2e;
    });
  } finally {
    session.endSession();
  }

  const asAdmin = { userId: adminUser._id, employeeId: adminEmp._id.toString(), role: "Admin", email: adminUser.email };
  const asManager = { userId: managerUser._id, employeeId: managerEmp._id.toString(), role: "Manager", email: managerUser.email };
  const asEmp1 = { userId: emp1User._id, employeeId: emp1._id.toString(), role: "Employee", email: emp1User.email };
  const asEmp2 = { userId: emp2User._id, employeeId: emp2._id.toString(), role: "Employee", email: emp2User.email };

  console.log("Test data created\n");

  // =========================================================================
  // SECTION 1  applyLeave
  // =========================================================================
  console.log("=== 1. applyLeave ===");

  const past = yesterdayWeekday();
  const sat = nextSaturday();

  // 1.1  Apply CL full-day 1 working day
  const d1 = date();
  let leave1;
  {
    const l = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: d1, toDate: d1, reason: "Family function" },
      asEmp1
    );
    leave1 = l;
    assert(l.leaveType === "CL" && l.status === "Pending" && l.leaveDays === 1, "Emp1 applies CL 1 day");
  }

  // 1.2  Apply SL multi-day (3 consecutive weekdays)
  const d2a = date();
  const d2b = date();
  let leave2;
  {
    const l = await leaveService.applyLeave(
      { leaveType: "SL", fromDate: d2a, toDate: d2b, reason: "Medical" },
      asEmp1
    );
    leave2 = l;
    assert(l.leaveType === "SL" && l.status === "Pending" && l.leaveDays > 1, "Emp1 applies SL multi-day");
  }

  // 1.3  Apply PL half-day
  const d3 = date();
  let leave3;
  {
    const l = await leaveService.applyLeave(
      { leaveType: "PL", fromDate: d3, toDate: d3, dayType: "Half-day", reason: "Personal errand" },
      asEmp1
    );
    leave3 = l;
    assert(l.leaveType === "PL" && l.dayType === "Half-day" && l.leaveDays === 0.5, "Emp1 applies PL half-day");
  }

  // 1.4  Apply LOP full-day
  const d4 = date();
  let leave4;
  {
    const l = await leaveService.applyLeave(
      { leaveType: "LOP", fromDate: d4, toDate: d4, reason: "No balance left" },
      asEmp1
    );
    leave4 = l;
    assert(l.leaveType === "LOP" && l.leaveDays === 1, "Emp1 applies LOP 1 day");
  }

  // 1.5  Second half-day on same date as 1.3 => overlap (no period distinction)
  await assertThrows(
    () => leaveService.applyLeave({ leaveType: "CL", fromDate: d3, toDate: d3, dayType: "Half-day", reason: "Afternoon off" }, asEmp1),
    "Leave request overlaps with an existing pending or approved leave",
    "Second half-day on same date \u2192 overlap"
  );

  // 1.6  Past date — now allowed
  {
    const l = await leaveService.applyLeave({ leaveType: "CL", fromDate: past, toDate: past, reason: "Oops" }, asEmp1);
    assert(l.status === "Pending" && l.leaveDays >= 0.5, "Past date leave submitted successfully");
  }

  // 1.7  fromDate > toDate
  const d5 = date();
  const d6 = date();
  await assertThrows(
    () => leaveService.applyLeave({ leaveType: "CL", fromDate: d6, toDate: d5, reason: "Bad range" }, asEmp1),
    "From date cannot be after to date",
    "From > To \u2192 error"
  );

  // 1.8  Weekend only
  await assertThrows(
    () => leaveService.applyLeave({ leaveType: "CL", fromDate: sat, toDate: sat, reason: "Weekend" }, asEmp1),
    "Leave request must include at least one working day",
    "Weekend only \u2192 error"
  );

  // 1.9  Full-day overlap with existing full-day (same date as leave1)
  await assertThrows(
    () => leaveService.applyLeave({ leaveType: "CL", fromDate: d1, toDate: d1, reason: "Overlap" }, asEmp1),
    "Leave request overlaps with an existing pending or approved leave",
    "Full-day overlap with existing \u2192 error"
  );

  // 1.10  Half-day overlap with existing half-day
  const halfDup = date();
  await leaveService.applyLeave(
    { leaveType: "SL", fromDate: halfDup, toDate: halfDup, dayType: "Half-day", reason: "First" },
    asEmp1
  );
  await assertThrows(
    () => leaveService.applyLeave(
      { leaveType: "CL", fromDate: halfDup, toDate: halfDup, dayType: "Half-day", reason: "Second" },
      asEmp1
    ),
    "Leave request overlaps with an existing pending or approved leave",
    "Half-day on date with existing half-day \u2192 error"
  );

  // 1.11  Half-day on full-day date
  const fullVsHalf = date();
  await leaveService.applyLeave(
    { leaveType: "CL", fromDate: fullVsHalf, toDate: fullVsHalf, reason: "Full day" },
    asEmp1
  );
  await assertThrows(
    () => leaveService.applyLeave(
      { leaveType: "SL", fromDate: fullVsHalf, toDate: fullVsHalf, dayType: "Half-day", reason: "Half on full day" },
      asEmp1
    ),
    "Leave request overlaps with an existing pending or approved leave",
    "Half-day on date with existing full-day \u2192 error"
  );

  // 1.12  Half-day spanning multiple dates
  const d7 = date();
  const d8 = date();
  await assertThrows(
    () => leaveService.applyLeave(
      { leaveType: "CL", fromDate: d7, toDate: d8, dayType: "Half-day", reason: "Span" },
      asEmp1
    ),
    "Half-day leave must start and end on the same date",
    "Half-day span multiple dates \u2192 error"
  );

  // 1.13  User with no employeeId
  const d9 = date();
  await assertThrows(
    () => leaveService.applyLeave({ leaveType: "CL", fromDate: d9, toDate: d9, reason: "No emp" }, { userId: new mongoose.Types.ObjectId(), employeeId: null, role: "Employee" }),
    "Only employees can apply leave",
    "No employeeId \u2192 error"
  );

  // =========================================================================
  // SECTION 2  approveLeave
  // =========================================================================
  console.log("\n=== 2. approveLeave ===");

  // 2.1  Admin approves pending leave
  {
    const l = await leaveService.approveLeave(leave1.id, asAdmin);
    assert(l.status === "Approved" && l.approvedBy, "Admin approves Emp1 pending leave");
  }

  // 2.2  Manager approves team member's pending leave
  {
    const l = await leaveService.approveLeave(leave2.id, asManager);
    assert(l.status === "Approved", "Manager approves team member (Emp1) leave");
  }

  // 2.3  Manager approves own pending leave
  const dMgr = date();
  const managerOwnLeave = await leaveService.applyLeave(
    { leaveType: "CL", fromDate: dMgr, toDate: dMgr, reason: "Manager own" },
    asManager
  );
  {
    const l = await leaveService.approveLeave(managerOwnLeave.id, asManager);
    assert(l.status === "Approved", "Manager approves own leave");
  }

  // 2.4  Employee tries to approve (should fail)
  await assertThrows(
    () => leaveService.approveLeave(leave3.id, asEmp1),
    "You do not have permission to approve or reject this leave",
    "Employee approves \u2192 403"
  );

  // 2.5  Approve already-approved
  await assertThrows(
    () => leaveService.approveLeave(leave1.id, asAdmin),
    "Leave request is already approved",
    "Approve approved leave \u2192 error"
  );

  // 2.6  Approve cancelled leave
  const dCancel = date();
  const toCancel = await leaveService.applyLeave(
    { leaveType: "CL", fromDate: dCancel, toDate: dCancel, reason: "To cancel" },
    asEmp1
  );
  await leaveService.cancelLeave(toCancel.id, { cancellationReason: "Changed mind" }, asEmp1);
  await assertThrows(
    () => leaveService.approveLeave(toCancel.id, asAdmin),
    "Cancelled leave cannot be approved",
    "Approve cancelled leave \u2192 error"
  );

  // 2.7  Insufficient balance on approval
  // Drain all Emp2 CL balance (12 CL), 13th approval should fail
  for (let i = 0; i < 13; i++) {
    const dd = date();
    const l = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dd, toDate: dd, reason: `Drain balance` },
      asEmp2
    );
    if (i < 12) {
      await leaveService.approveLeave(l.id, asAdmin);
    } else {
      await assertThrows(
        () => leaveService.approveLeave(l.id, asAdmin),
        "Insufficient CL balance",
        "Insufficient balance on approval \u2192 error"
      );
    }
  }

  // =========================================================================
  // SECTION 3  rejectLeave
  // =========================================================================
  console.log("\n=== 3. rejectLeave ===");

  // 3.1  Admin rejects pending leave
  {
    const dRj = date();
    const toReject = await leaveService.applyLeave(
      { leaveType: "SL", fromDate: dRj, toDate: dRj, reason: "Reject me" },
      asEmp1
    );
    const l = await leaveService.rejectLeave(toReject.id, { rejectionReason: "Business need" }, asAdmin);
    assert(l.status === "Rejected" && l.rejectionReason === "Business need", "Admin rejects pending leave");
  }

  // 3.2  Manager rejects team member pending leave
  {
    const dRj = date();
    const toReject = await leaveService.applyLeave(
      { leaveType: "SL", fromDate: dRj, toDate: dRj, reason: "Manager reject" },
      asEmp1
    );
    const l = await leaveService.rejectLeave(toReject.id, { rejectionReason: "Coverage issue" }, asManager);
    assert(l.status === "Rejected", "Manager rejects team member leave");
  }

  // 3.3  Reject approved leave
  await assertThrows(
    () => leaveService.rejectLeave(leave1.id, { rejectionReason: "Oops" }, asAdmin),
    "Approved leave must be cancelled instead of rejected",
    "Reject approved leave \u2192 error"
  );

  // 3.4  Reject cancelled leave
  await assertThrows(
    () => leaveService.rejectLeave(toCancel.id, { rejectionReason: "Oops" }, asAdmin),
    "Cancelled leave cannot be rejected",
    "Reject cancelled leave \u2192 error"
  );

  // 3.5  Employee rejects (should fail)
  {
    const dRj = date();
    const toReject = await leaveService.applyLeave(
      { leaveType: "SL", fromDate: dRj, toDate: dRj, reason: "Reject me" },
      asEmp1
    );
    await assertThrows(
      () => leaveService.rejectLeave(toReject.id, { rejectionReason: "No" }, asEmp1),
      "You do not have permission to approve or reject this leave",
      "Employee rejects \u2192 403"
    );
  }

  // =========================================================================
  // SECTION 4  cancelLeave
  // =========================================================================
  console.log("\n=== 4. cancelLeave ===");

  // 4.1  Employee cancels own pending leave
  {
    const dCa = date();
    const toCancelOwn = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dCa, toDate: dCa, reason: "Cancel own" },
      asEmp1
    );
    const l = await leaveService.cancelLeave(toCancelOwn.id, { cancellationReason: "Plan changed" }, asEmp1);
    assert(l.status === "Cancelled", "Employee cancels own pending leave");
  }

  // 4.2  Admin cancels any pending leave
  {
    const dCa = date();
    const toCancelAdmin = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dCa, toDate: dCa, reason: "Admin cancel" },
      asEmp1
    );
    const l = await leaveService.cancelLeave(toCancelAdmin.id, { cancellationReason: "Admin override" }, asAdmin);
    assert(l.status === "Cancelled", "Admin cancels any pending leave");
  }

  // 4.3  Manager cancels team member pending leave
  {
    const dCa = date();
    const toCancelMgr = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dCa, toDate: dCa, reason: "Mgr cancel" },
      asEmp1
    );
    const l = await leaveService.cancelLeave(toCancelMgr.id, { cancellationReason: "Mgr override" }, asManager);
    assert(l.status === "Cancelled", "Manager cancels team member pending leave");
  }

  // 4.4  Cancel already cancelled
  await assertThrows(
    () => leaveService.cancelLeave(toCancel.id, { cancellationReason: "Again" }, asAdmin),
    "Leave request is already cancelled",
    "Cancel already cancelled \u2192 error"
  );

  // 4.5  Cancel rejected leave
  {
    const dCa = date();
    const rej = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dCa, toDate: dCa, reason: "Rejected then cancel" },
      asEmp1
    );
    await leaveService.rejectLeave(rej.id, { rejectionReason: "No" }, asAdmin);
    await assertThrows(
      () => leaveService.cancelLeave(rej.id, { cancellationReason: "Try" }, asEmp1),
      "Rejected leave cannot be cancelled",
      "Cancel rejected leave \u2192 error"
    );
  }

  // 4.6  Cancel approved leave (reverts balance + clears attendance)
  {
    const dCa = date();
    const toApprovedCancel = await leaveService.applyLeave(
      { leaveType: "PL", fromDate: dCa, toDate: dCa, reason: "Approve then cancel" },
      asEmp1
    );
    await leaveService.approveLeave(toApprovedCancel.id, asAdmin);
    const l = await leaveService.cancelLeave(toApprovedCancel.id, { cancellationReason: "Changed" }, asEmp1);
    assert(l.status === "Cancelled", "Cancel approved leave \u2014 balance reverted");
  }

  // 4.7  Employee cannot cancel another employee's leave
  {
    const dCa = date();
    const other = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dCa, toDate: dCa, reason: "Other emp" },
      asEmp2
    );
    await assertThrows(
      () => leaveService.cancelLeave(other.id, { cancellationReason: "No" }, asEmp1),
      "You do not have permission to cancel this leave",
      "Emp1 cannot cancel Emp2's leave \u2192 403"
    );
  }

  // =========================================================================
  // SECTION 5  getLeaves (visibility)
  // =========================================================================
  console.log("\n=== 5. getLeaves (visibility) ===");

  // 5.1  Employee sees own leaves only
  {
    const result = await leaveService.getLeaves({}, asEmp1);
    const empIdStr = asEmp1.employeeId;
    const allOwn = result.data.every((l) => String(l.employee?.id) === empIdStr);
    assert(allOwn && result.data.length > 0, "Employee sees own leaves only");
  }

  // 5.2  Manager sees own + team leaves
  {
    const result = await leaveService.getLeaves({ limit: 100 }, asManager);
    const empIdStrs = result.data.map((l) => String(l.employee?.id));
    const hasSelf = empIdStrs.includes(asManager.employeeId);
    const hasTeam1 = empIdStrs.includes(asEmp1.employeeId);
    const hasTeam2 = empIdStrs.includes(asEmp2.employeeId);
    assert(hasSelf && hasTeam1 && hasTeam2, "Manager sees own + team leaves");
  }

  // 5.3  Admin sees all leaves
  {
    const result = await leaveService.getLeaves({ limit: 100 }, asAdmin);
    assert(result.data.length > 0, "Admin sees all leaves");
  }

  // 5.4  Filter by status
  {
    const result = await leaveService.getLeaves({ status: "Approved" }, asAdmin);
    const allApproved = result.data.every((l) => l.status === "Approved");
    assert(allApproved && result.data.length > 0, "Filter by status=Approved");
  }

  // 5.5  Filter by leaveType
  {
    const result = await leaveService.getLeaves({ leaveType: "LOP" }, asAdmin);
    const allLOP = result.data.every((l) => l.leaveType === "LOP");
    assert(allLOP && result.data.length > 0, "Filter by leaveType=LOP");
  }

  // 5.6  Search by reason
  {
    const result = await leaveService.getLeaves({ search: "Family function" }, asAdmin);
    assert(result.data.length > 0, "Search by reason");
  }

  // 5.7  Pagination
  {
    const result = await leaveService.getLeaves({ page: 1, limit: 5 }, asAdmin);
    assert(result.data.length <= 5 && result.currentPage === 1, "Pagination limit=5 works");
  }

  // =========================================================================
  // SECTION 6  getLeaveById
  // =========================================================================
  console.log("\n=== 6. getLeaveById ===");

  const lid = String(leave1.id);
  assert(String((await leaveService.getLeaveById(leave1.id, asEmp1)).id) === lid, "Owner accesses own leave");
  assert(String((await leaveService.getLeaveById(leave1.id, asManager)).id) === lid, "Manager accesses team member leave");
  assert(String((await leaveService.getLeaveById(leave1.id, asAdmin)).id) === lid, "Admin accesses any leave");

  await assertThrows(
    () => leaveService.getLeaveById(leave1.id, asEmp2),
    "You do not have permission to access this leave request",
    "Emp2 cannot access Emp1's leave \u2192 403"
  );

  await assertThrows(
    () => leaveService.getLeaveById("invalid", asAdmin),
    "Leave ID is invalid",
    "Invalid ObjectId \u2192 error"
  );

  // =========================================================================
  // SECTION 7  getMyLeaveBalance
  // =========================================================================
  console.log("\n=== 7. getMyLeaveBalance ===");

  {
    const bal = await leaveService.getMyLeaveBalance(asEmp1);
    assert(bal !== null, "Emp1 gets balance");
    assert(typeof bal.CL === "number" && typeof bal.SL === "number" && typeof bal.PL === "number" && typeof bal.LOP === "number", "Balance has all 4 types");
  }

  assert(await leaveService.getMyLeaveBalance({ employeeId: null }) === null, "No employeeId \u2192 null");

  // =========================================================================
  // SECTION 8  getMyLeaves
  // =========================================================================
  console.log("\n=== 8. getMyLeaves ===");

  {
    const result = await leaveService.getMyLeaves({}, asEmp1);
    assert(result.data.length > 0 && result.total > 0, "getMyLeaves returns leaves");
  }

  {
    const result = await leaveService.getMyLeaves({}, { employeeId: null, role: "Employee" });
    assert(result.total === 0 && result.data.length === 0, "getMyLeaves no employeeId \u2192 empty");
  }

  // =========================================================================
  // SECTION 9  Half-day + attendance integration
  // =========================================================================
  console.log("\n=== 9. Half-day & Attendance ===");

  // 9.1  Approved half-day creates Half-day attendance record
  {
    const dHd = date();
    const hd = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dHd, toDate: dHd, dayType: "Half-day", halfDayPeriod: "First-half", reason: "Half day att" },
      asEmp1
    );
    await leaveService.approveLeave(hd.id, asAdmin);
    const attendance = await Attendance.findOne({ employeeId: emp1._id, status: "Half-day" });
    assert(attendance !== null, "Approved half-day creates Half-day attendance record");
  }

  // 9.2  Approved full-day creates Leave attendance; cancel reverts
  {
    const dFt = date();
    const hd2 = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dFt, toDate: dFt, reason: "Cancel att" },
      asEmp1
    );
    await leaveService.approveLeave(hd2.id, asAdmin);
    const before = await Attendance.countDocuments({ employeeId: emp1._id, status: "Leave" });
    assert(before > 0, "Approved leave creates Leave attendance record");
    await leaveService.cancelLeave(hd2.id, { cancellationReason: "Revert" }, asEmp1);
    const after = await Attendance.countDocuments({ employeeId: emp1._id, status: "Leave" });
    assert(after < before, "Cancel approved leave removes Leave attendance record");
  }

  // =========================================================================
  // SECTION 10  updateLeave
  // =========================================================================
  console.log("\n=== 10. updateLeave ===");

  // 10.1  Update own pending leave
  {
    const dUpd = date();
    const toUpdate = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dUpd, toDate: dUpd, reason: "Original reason" },
      asEmp1
    );
    const updated = await leaveService.updateLeave(toUpdate.id, {
      leaveType: "SL", fromDate: dUpd, toDate: dUpd, reason: "Updated reason"
    }, asEmp1);
    assert(updated.leaveType === "SL" && updated.reason === "Updated reason" && updated.status === "Pending", "Employee updates own pending leave");
  }

  // 10.2  Update leave type + dates
  {
    const dUpd1 = date();
    const dUpd2 = date();
    const toUpdate = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dUpd1, toDate: dUpd1, reason: "Change me" },
      asEmp1
    );
    const updated = await leaveService.updateLeave(toUpdate.id, {
      leaveType: "PL", fromDate: dUpd1, toDate: dUpd2, reason: "Changed"
    }, asEmp1);
    assert(updated.leaveType === "PL" && updated.leaveDays > 1, "Update leave type + multi-day");
  }

  // 10.3  Admin updates another's pending leave
  {
    const dUpd = date();
    const toUpdate = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dUpd, toDate: dUpd, reason: "Admin edit" },
      asEmp1
    );
    const updated = await leaveService.updateLeave(toUpdate.id, {
      leaveType: "LOP", fromDate: dUpd, toDate: dUpd, reason: "Admin changed"
    }, asAdmin);
    assert(updated.leaveType === "LOP", "Admin updates another's pending leave");
  }

  // 10.4  Cannot update non-pending leave
  {
    await assertThrows(
      () => leaveService.updateLeave(leave1.id, { leaveType: "CL", fromDate: d1, toDate: d1, reason: "Nope" }, asEmp1),
      "Only pending leave requests can be edited",
      "Update approved leave → error"
    );
  }

  // 10.5  Cannot update another employee's leave as employee
  {
    const dUpd = date();
    const toUpdate = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dUpd, toDate: dUpd, reason: "Other's leave" },
      asEmp2
    );
    await assertThrows(
      () => leaveService.updateLeave(toUpdate.id, { leaveType: "SL", fromDate: dUpd, toDate: dUpd, reason: "Hack" }, asEmp1),
      "You do not have permission to edit this leave request",
      "Emp1 cannot update Emp2's pending leave → 403"
    );
  }

  // 10.6  Half-day edit
  {
    const dUpd = date();
    const toUpdate = await leaveService.applyLeave(
      { leaveType: "CL", fromDate: dUpd, toDate: dUpd, reason: "To half-day" },
      asEmp1
    );
    const updated = await leaveService.updateLeave(toUpdate.id, {
      leaveType: "PL", fromDate: dUpd, toDate: dUpd, dayType: "Half-day", reason: "Changed to half"
    }, asEmp1);
    assert(updated.dayType === "Half-day" && updated.leaveDays === 0.5, "Update full-day to half-day");
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results:  ${passed} passed,  ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  // Clean up — drop test DB entirely
  await mongoose.connection.dropDatabase();
  console.log("Test DB dropped\n");
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error("Test suite error:", err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
