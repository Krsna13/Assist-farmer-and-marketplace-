/**
 * backend/routes/autoSyncRoutes.js
 *
 * Endpoints for the Marketplace Auto-Sync feature:
 *   GET  /api/auto-sync/status          — check if the current user has auto-sync enabled
 *   GET  /api/auto-sync/reconcile       — dry-run preview of eligible inventory
 *   POST /api/auto-sync/reconcile       — execute reconciliation (non-destructive)
 *   GET  /api/auto-sync/listing/:id     — look up sync'd listing for a source record
 */
const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  isAllowlistedUser,
  reconcileOwnerInventory,
  getAllowlistEmail,
} = require("../services/marketplaceAutoSyncService");
const Listing = require("../models/Listing");

const router = express.Router();

/**
 * GET /api/auto-sync/status
 * Returns whether the authenticated user has auto-publish enabled.
 * Never exposes the raw allowlist email.
 */
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const allowed = await isAllowlistedUser(req.user.id);
    res.json({
      autoPublishEnabled: allowed,
      message: allowed
        ? "Your account has automatic marketplace publishing enabled."
        : "Manual publishing only for your account.",
    });
  } catch (err) {
    res.status(500).json({ message: "Error checking auto-sync status", error: err.message });
  }
});

/**
 * GET /api/auto-sync/reconcile?dryRun=true
 * Preview which existing inventory records would be synced.
 * dryRun=false runs the actual reconciliation (set in query param).
 */
router.get("/reconcile", authMiddleware, async (req, res) => {
  try {
    const allowed = await isAllowlistedUser(req.user.id);
    if (!allowed) {
      return res.status(403).json({
        message: "Auto-sync reconcile is only available for the configured owner account.",
      });
    }

    const dryRun = req.query.dryRun !== "false"; // default: safe dry-run
    const report = await reconcileOwnerInventory(req.user.id, dryRun);
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Reconcile error", error: err.message });
  }
});

/**
 * POST /api/auto-sync/reconcile
 * Body: { dryRun: false } — execute the actual reconciliation
 */
router.post("/reconcile", authMiddleware, async (req, res) => {
  try {
    const allowed = await isAllowlistedUser(req.user.id);
    if (!allowed) {
      return res.status(403).json({
        message: "Auto-sync reconcile is only available for the configured owner account.",
      });
    }

    const dryRun = req.body.dryRun !== false; // default: safe unless explicitly false
    const report = await reconcileOwnerInventory(req.user.id, dryRun);
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Reconcile error", error: err.message });
  }
});

/**
 * GET /api/auto-sync/listing/:sourceType/:sourceId
 * Returns the marketplace listing linked to a source record (if any).
 * Only the record owner can fetch this.
 */
router.get("/listing/:sourceType/:sourceId", authMiddleware, async (req, res) => {
  try {
    const { sourceType, sourceId } = req.params;
    const listing = await Listing.findOne({
      sourceRecordType: sourceType,
      sourceRecordId: sourceId,
      farmerId: req.user.id,
    }).lean();

    if (!listing) {
      return res.status(404).json({ message: "No linked listing found" });
    }
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: "Error fetching linked listing", error: err.message });
  }
});

module.exports = router;
