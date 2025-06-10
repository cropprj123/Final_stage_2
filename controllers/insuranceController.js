const InsurancePolicy = require("../models/insuranceModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const blockchainService = require("../services/blockchainService");

exports.createPolicy = catchAsync(async (req, res, next) => {
  const policy = await InsurancePolicy.create({
    ...req.body,
    createdBy: req.user.id,
  });

  // --- Blockchain integration: minimum change ---
  try {
    // Extract the first crop's minTemperature as the threshold value
    const cropDetails = policy.cropDetails?.[0]?.crops?.[0];
    const cropType = cropDetails?.cropType;
    const thresholdValue = cropDetails?.thresholds?.temperature?.minTemperature;
    const startDate = Math.floor(
      new Date(policy.seasonDates.startDate).getTime() / 1000
    );
    const endDate = Math.floor(
      new Date(policy.seasonDates.endDate).getTime() / 1000
    );
    // Use the admin private key from env/config (replace as needed)
    const privateKey = process.env.ADMIN_PRIVATE_KEY;
    if (privateKey && cropType && thresholdValue && startDate && endDate) {
      await blockchainService.createPolicy(
        privateKey,
        cropType,
        thresholdValue,
        startDate,
        endDate
      );
    } else {
      console.warn(
        "Blockchain policy not created: missing data or private key"
      );
    }
  } catch (err) {
    console.error("Blockchain policy creation failed:", err);
  }
  // --- End blockchain integration ---

  res.status(201).json({
    status: "success",
    data: { policy },
  });
});

// Get all policies (accessible to everyone)
exports.getAllPolicies = catchAsync(async (req, res, next) => {
  const policies = await InsurancePolicy.find().populate(
    "createdBy",
    "name email"
  );

  res.status(200).json({
    status: "success",
    results: policies.length,
    data: { policies },
  });
});

// Get a single policy by ID (accessible to everyone)
exports.getPolicy = catchAsync(async (req, res, next) => {
  const policy = await InsurancePolicy.findById(req.params.id);

  if (!policy) {
    return next(new AppError("No policy found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { policy },
  });
});

// Create a policy (admin-only)

// Update a policy (restricted to the creator admin)
exports.updatePolicy = catchAsync(async (req, res, next) => {
  const policy = await InsurancePolicy.findById(req.params.id);

  if (!policy) {
    return next(new AppError("No policy found with that ID", 404));
  }

  if (policy.createdBy.toString() !== req.user.id) {
    return next(
      new AppError("You do not have permission to update this policy", 403)
    );
  }

  const updatedPolicy = await InsurancePolicy.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true, // Return the updated document
      runValidators: true, // Ensure validation rules are applied
    }
  );

  res.status(200).json({
    status: "success",
    data: { policy: updatedPolicy },
  });
});

// Delete a policy (restricted to the creator admin)
exports.deletePolicy = catchAsync(async (req, res, next) => {
  const policy = await InsurancePolicy.findById(req.params.id);

  if (!policy) {
    return next(new AppError("No policy found with that ID", 404));
  }

  if (policy.createdBy.toString() !== req.user.id) {
    return next(
      new AppError("You do not have permission to delete this policy", 403)
    );
  }

  await InsurancePolicy.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: "success",
    data: null,
  });
});
