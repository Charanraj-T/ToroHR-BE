import Employee from "../models/employee.model.js";
import Claim from "../models/claim.model.js";

const claimPopulateOptions = [
  {
    path: "employeeId",
    select: "employeeId fullName email department designation reportingManagerId"
  },
  {
    path: "submittedBy",
    select: "name email role"
  },
  {
    path: "approvedBy",
    select: "name email role"
  },
  {
    path: "rejectedBy",
    select: "name email role"
  },
  {
    path: "cancelledBy",
    select: "name email role"
  },
  {
    path: "reimbursedBy",
    select: "name email role"
  }
];

const listClaimPopulateOptions = [
  {
    path: "employeeId",
    select: "employeeId fullName email department designation reportingManagerId"
  }
];

export const findEmployeeById = (employeeId, session = null) => {
  return Employee.findById(employeeId).select("status reportingManagerId").session(session);
};

export const createClaim = async (claimData, session = null) => {
  const [claim] = await Claim.create([claimData], { session });
  return Claim.populate(claim, claimPopulateOptions);
};

export const updateClaimById = (id, updateData, session = null) => {
  return Claim.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    session
  }).populate(claimPopulateOptions);
};

export const findClaimById = (id, session = null) => {
  return Claim.findById(id).session(session).populate(claimPopulateOptions);
};

export const deleteClaimById = (id, session = null) => {
  return Claim.findByIdAndDelete(id).session(session);
};

export const listClaims = async ({ query, page, limit }) => {
  const skip = (page - 1) * limit;

  const [totalCount, data] = await Promise.all([
    Claim.countDocuments(query),
    Claim.find(query, { "attachments.data": 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(listClaimPopulateOptions)
      .lean()
  ]);

  return {
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit) || 1,
    data
  };
};

export const getClaimSummary = async (query) => {
  const results = await Claim.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  const summary = {
    Pending: 0,
    Approved: 0,
    Rejected: 0,
    Reimbursed: 0
  };

  for (const item of results) {
    if (Object.prototype.hasOwnProperty.call(summary, item._id)) {
      summary[item._id] = item.count;
    }
  }

  return summary;
};

export const getTeamEmployeeIds = async (managerId) => {
  const employees = await Employee.find({ reportingManagerId: managerId }).select("_id").lean();
  return employees.map((employee) => employee._id);
};

export const updateClaimStatus = (id, updateData, session = null) => {
  return updateClaimById(id, updateData, session);
};
