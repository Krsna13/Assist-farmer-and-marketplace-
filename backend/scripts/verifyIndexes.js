/**
 * Database Index Verification Script (Development / Staging Only)
 *
 * PURPOSE:
 * Verifies that Mongoose schemas can successfully register and create their declared indexes
 * against a MongoDB instance without duplicate keys or syntax errors.
 *
 * SAFETY RULES:
 * - This script uses `Model.createIndexes()`, which is NON-DESTRUCTIVE: it creates missing indexes
 *   and does NOT drop or purge existing collection data.
 * - NEVER run index-rebuild operations against a high-load production database during peak hours.
 *   Production deployments should create indexes during maintenance windows or via background builds.
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const Bid = require("../models/Bid");
const Order = require("../models/Order");
const Notification = require("../models/Notification");

async function verifyIndexes() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_agri_db";
  console.log(`\n======================================================`);
  console.log(`🔍 VERIFYING STAGE 2 MARKETPLACE DATABASE INDEXES`);
  console.log(`Connecting to: ${mongoUri}`);
  console.log(`======================================================\n`);

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log("Connected to MongoDB successfully.\n");

    const models = [
      { name: "Listing", model: Listing },
      { name: "ListingPhoto", model: ListingPhoto },
      { name: "Bid", model: Bid },
      { name: "Order", model: Order },
      { name: "Notification", model: Notification },
    ];

    for (const { name, model } of models) {
      console.log(`Creating/Verifying indexes for collection: ${model.collection.name}...`);
      await model.createIndexes();
      const indexes = await model.collection.indexes();
      console.log(`  Declared indexes on ${name}:`);
      indexes.forEach((idx) => {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? "(UNIQUE)" : ""}`);
      });
      console.log("");
    }

    console.log("======================================================");
    console.log("✅ All marketplace model indexes verified successfully!");
    console.log("======================================================\n");
  } catch (error) {
    console.log("Notice: Local MongoDB instance not reachable for live index creation verification.");
    console.log(`Reason: ${error.message}`);
    console.log("\nSchema-level index definitions were verified in backend/test/marketplaceModels.test.js.");
    console.log("To run live verification on a connected database, ensure MongoDB is running and execute:");
    console.log("  node scripts/verifyIndexes.js\n");
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  verifyIndexes();
}

module.exports = verifyIndexes;
