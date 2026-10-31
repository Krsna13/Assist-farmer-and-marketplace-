/**
 * backend/routes/cropRecordRoutes.js
 *
 * Extended with Marketplace Auto-Sync for the configured owner account.
 * Sync is triggered server-side after every successful save/update.
 * No client-submitted field can grant auto-publish permission.
 */
const express = require("express");
const router = express.Router();
const CropRecord = require("../models/CropRecord");
const authMiddleware = require("../middlewares/authMiddleware");
const { syncCropRecord, deactivateListingForSource } = require("../services/marketplaceAutoSyncService");

// Allowed sync fields that the client may submit (whitelist)
const SYNC_ALLOWED_FIELDS = [
  "harvestDate",
  "harvestQty",
  "harvestUnit",
  "conditionNotes",
  "forSale",
  "marketSalePrice",
  "minOrderQty",
];

// Strip any sync-status fields the client should never control
function stripServerFields(body) {
  const copy = { ...body };
  delete copy.syncStatus;
  delete copy.syncListingId;
  delete copy.syncError;
  delete copy.lastSyncedAt;
  delete copy.user;
  return copy;
}

// Create Crop Record
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      cropFarmId,
      season,
      cropType,
      cropName,
      duration,
      seedingDate,
      seedQuantity,
      notes,
      // Harvest / sale fields
      harvestDate,
      harvestQty,
      harvestUnit,
      conditionNotes,
      forSale,
      marketSalePrice,
      minOrderQty,
    } = stripServerFields(req.body);

    if (
      !cropFarmId ||
      !season ||
      !cropType ||
      !cropName ||
      !duration ||
      !seedingDate ||
      !seedQuantity
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be filled." });
    }

    const cropRecord = new CropRecord({
      user: req.user.id,
      cropFarmId,
      season,
      cropType,
      cropName,
      duration,
      seedingDate,
      seedQuantity,
      notes,
      harvestDate: harvestDate || null,
      harvestQty: harvestQty || null,
      harvestUnit: harvestUnit || "kg",
      conditionNotes: conditionNotes || "",
      forSale: !!forSale,
      marketSalePrice: marketSalePrice || null,
      minOrderQty: minOrderQty || 1,
    });

    await cropRecord.save();

    // Attempt marketplace sync — non-blocking; result attached to response
    let syncResult = { synced: false, reason: "Auto-sync not attempted" };
    if (cropRecord.forSale) {
      syncResult = await syncCropRecord(cropRecord, req.user.id);
      // Write sync status back
      const statusFields = {
        syncStatus: syncResult.synced ? "synced" : "error",
        syncError: syncResult.synced ? null : syncResult.reason,
        lastSyncedAt: syncResult.synced ? new Date() : null,
      };
      if (syncResult.listingId) {
        statusFields.syncListingId = syncResult.listingId;
      }
      await CropRecord.findByIdAndUpdate(cropRecord._id, statusFields);
      cropRecord.syncStatus = statusFields.syncStatus;
      cropRecord.syncError = statusFields.syncError;
      cropRecord.lastSyncedAt = statusFields.lastSyncedAt;
    }

    res.status(201).json({ cropRecord, syncResult });
  } catch (error) {
    console.error("Crop Record Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all crop records for a specific crop farm
router.get("/:cropFarmId", authMiddleware, async (req, res) => {
  try {
    const cropRecords = await CropRecord.find({
      user: req.user.id,
      cropFarmId: req.params.cropFarmId,
    });
    res.status(200).json(cropRecords);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update existing Crop Record
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const safeBody = stripServerFields(req.body);

    const updated = await CropRecord.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      safeBody,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Crop record not found." });
    }

    // Attempt marketplace sync after update
    let syncResult = { synced: false, reason: "Auto-sync not attempted" };
    if (updated.forSale) {
      syncResult = await syncCropRecord(updated, req.user.id);
      const statusFields = {
        syncStatus: syncResult.synced ? "synced" : "error",
        syncError: syncResult.synced ? null : syncResult.reason,
        lastSyncedAt: syncResult.synced ? new Date() : null,
      };
      if (syncResult.listingId) statusFields.syncListingId = syncResult.listingId;
      await CropRecord.findByIdAndUpdate(updated._id, statusFields);
      updated.syncStatus = statusFields.syncStatus;
      updated.syncError = statusFields.syncError;
      updated.lastSyncedAt = statusFields.lastSyncedAt;
    } else {
      await deactivateListingForSource("CropRecord", updated._id);
      await CropRecord.findByIdAndUpdate(updated._id, {
        syncStatus: "inactive",
        lastSyncedAt: new Date(),
      });
      syncResult = { synced: true, action: "deactivated", message: "Listing deactivated as crop is no longer for sale" };
    }

    res.status(200).json({ cropRecord: updated, syncResult });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete existing Crop Record
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await CropRecord.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: "Crop record not found." });
    }
    await deactivateListingForSource("CropRecord", deleted._id);
    res.status(200).json({ message: "Crop record deleted successfully." });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
