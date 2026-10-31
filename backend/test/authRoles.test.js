const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const authMiddleware = require("../middlewares/authMiddleware");
const { requireRole } = authMiddleware;
const User = require("../models/User");
const PendingUser = require("../models/PendingUser");

// Set up mock secret for test run if not present
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_12345";

// Lightweight Mock Response Generator
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STAGE 1 MARKETPLACE AUTH & ROLE TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: User Schema Defaults & Enums
  try {
    const user = new User({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "hashedpassword",
      phone: "1234567890",
    });
    assert(user.role === "farmer", "User schema defaults role to 'farmer' for legacy compatibility");

    const buyerUser = new User({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      password: "hashedpassword",
      phone: "1234567891",
      role: "buyer",
    });
    assert(buyerUser.role === "buyer", "User schema accepts valid role 'buyer'");

    const bulkBuyer = new User({
      firstName: "Corp",
      lastName: "Buyer",
      email: "corp@example.com",
      password: "hashedpassword",
      phone: "1234567892",
      role: "bulk_buyer",
    });
    assert(bulkBuyer.role === "bulk_buyer", "User schema accepts valid role 'bulk_buyer'");

    const invalidRoleUser = new User({
      firstName: "Bad",
      lastName: "Actor",
      email: "bad@example.com",
      password: "hashedpassword",
      phone: "1234567893",
      role: "admin",
    });
    const validationErr = invalidRoleUser.validateSync();
    assert(
      validationErr && validationErr.errors && validationErr.errors.role,
      "User schema rejects non-allowlisted role ('admin')"
    );
  } catch (err) {
    assert(false, `User schema test threw unexpected error: ${err.message}`);
  }

  // TEST 2: PendingUser Schema Role Field
  try {
    const pending = new PendingUser({
      firstName: "Pending",
      lastName: "User",
      email: "pending@example.com",
      password: "pass",
      role: "bulk_buyer",
    });
    assert(pending.role === "bulk_buyer", "PendingUser schema stores 'bulk_buyer' role correctly");
  } catch (err) {
    assert(false, `PendingUser test error: ${err.message}`);
  }

  // TEST 3: AuthMiddleware - Missing Token returns 401
  try {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => {
      nextCalled = true;
    });
    assert(res.statusCode === 401, "authMiddleware returns HTTP 401 when token is missing");
    assert(!nextCalled, "authMiddleware does not call next() when token is missing");
  } catch (err) {
    assert(false, `Missing token test error: ${err.message}`);
  }

  // TEST 4: AuthMiddleware - Invalid Token returns 401
  try {
    const req = { headers: { authorization: "Bearer invalid.jwt.token" } };
    const res = createMockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => {
      nextCalled = true;
    });
    assert(res.statusCode === 401, "authMiddleware returns HTTP 401 when token is invalid");
    assert(!nextCalled, "authMiddleware does not call next() when token is invalid");
  } catch (err) {
    assert(false, `Invalid token test error: ${err.message}`);
  }

  // TEST 5: AuthMiddleware - Legacy Token without role defaults to 'farmer'
  try {
    const legacyToken = jwt.sign(
      { id: "legacy123", email: "legacy@farm.com", firstName: "Old", lastName: "Farmer" },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${legacyToken}` } };
    const res = createMockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => {
      nextCalled = true;
    });
    assert(nextCalled, "authMiddleware accepts valid legacy token and calls next()");
    assert(req.user && req.user.role === "farmer", "Legacy token defaults req.user.role to 'farmer'");
  } catch (err) {
    assert(false, `Legacy token test error: ${err.message}`);
  }

  // TEST 6: Role Authorization - Authorized Role accesses protected route
  try {
    const farmerToken = jwt.sign(
      { id: "farmer1", email: "f@farm.com", role: "farmer" },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${farmerToken}` } };
    const res = createMockRes();
    let nextCalled = false;

    const farmerGuard = requireRole("farmer");
    farmerGuard(req, res, () => {
      nextCalled = true;
    });
    assert(nextCalled, "requireRole('farmer') permits user with 'farmer' role");
    assert(res.statusCode === 200, "Response status remains 200 on authorized role");
  } catch (err) {
    assert(false, `requireRole authorized test error: ${err.message}`);
  }

  // TEST 7: Role Authorization - Unauthorized Role is rejected with HTTP 403
  try {
    const buyerToken = jwt.sign(
      { id: "buyer1", email: "b@buyer.com", role: "buyer" },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${buyerToken}` } };
    const res = createMockRes();
    let nextCalled = false;

    const farmerGuard = requireRole("farmer");
    farmerGuard(req, res, () => {
      nextCalled = true;
    });
    assert(!nextCalled, "requireRole('farmer') blocks user with 'buyer' role");
    assert(res.statusCode === 403, "requireRole returns HTTP 403 Forbidden for unauthorized role");
    assert(res.body && res.body.message.includes("Forbidden"), "403 response contains clear Forbidden message");
  } catch (err) {
    assert(false, `requireRole forbidden test error: ${err.message}`);
  }

  // TEST 8: Multi-role Authorization (e.g., buyer and bulk_buyer)
  try {
    const bulkBuyerToken = jwt.sign(
      { id: "bulk1", email: "bulk@store.com", role: "bulk_buyer" },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${bulkBuyerToken}` } };
    const res = createMockRes();
    let nextCalled = false;

    const buyerOrBulkGuard = requireRole("buyer", "bulk_buyer");
    buyerOrBulkGuard(req, res, () => {
      nextCalled = true;
    });
    assert(nextCalled, "requireRole('buyer', 'bulk_buyer') permits 'bulk_buyer'");
  } catch (err) {
    assert(false, `Multi-role test error: ${err.message}`);
  }

  // TEST 9: requireRole without token returns HTTP 401
  try {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    const farmerGuard = requireRole("farmer");
    farmerGuard(req, res, () => {
      nextCalled = true;
    });
    assert(!nextCalled, "requireRole without credentials does not call next()");
    assert(res.statusCode === 401, "requireRole returns HTTP 401 when no token is supplied");
  } catch (err) {
    assert(false, `Unauthenticated requireRole test error: ${err.message}`);
  }

  console.log("==================================================");
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
