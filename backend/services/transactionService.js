const mongoose = require("mongoose");

/**
 * Custom error indicating the MongoDB deployment does not support transactions.
 */
class TransactionsUnsupportedError extends Error {
  constructor(originalMessage) {
    super(
      "MongoDB deployment does not support multi-document transactions. " +
      "Stage 6 purchase, bidding, and stock-reservation workflows strictly require a replica set or MongoDB Atlas cluster. " +
      "Standalone MongoDB without a replica set cannot guarantee ACID consistency across Listing, Bid, Order, and Notification documents. " +
      "Setup instructions: To enable a local replica set, restart mongod with '--replSet rs0' and execute 'rs.initiate()' in mongosh, or provide a replica-set MONGO_URI in backend/.env."
    );
    this.name = "TransactionsUnsupportedError";
    this.code = "TRANSACTIONS_UNSUPPORTED";
    this.statusCode = 503;
    this.originalError = originalMessage;
  }
}

/**
 * Checks whether the active database connection supports multi-document transactions.
 * Returns { supported: boolean, reason?: string, topology?: string }
 */
async function checkDatabaseTransactionCapability() {
  if (mongoose.connection.readyState !== 1) {
    return {
      supported: false,
      reason: "Database connection is not open (readyState !== 1).",
      topology: "Disconnected",
    };
  }

  const client = mongoose.connection.client;
  const topology = client && client.topology ? client.topology.description : null;
  const topologyType = topology ? topology.type : "Unknown";

  // Standalone MongoDB explicitly does not support transactions
  if (topologyType === "Single" || topologyType === "Standalone") {
    return {
      supported: false,
      reason: "Connected to a standalone MongoDB instance. Multi-document transactions require a replica set or mongos cluster.",
      topology: topologyType,
    };
  }

  // Attempt a dry session start and test transaction check
  let session = null;
  try {
    session = await mongoose.startSession();
    // Test if startTransaction is permitted
    session.startTransaction();
    await session.abortTransaction();
    return {
      supported: true,
      topology: topologyType,
    };
  } catch (err) {
    return {
      supported: false,
      reason: err.message,
      topology: topologyType,
    };
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

/**
 * Executes a callback within a genuine MongoDB ACID transaction session with safe retries.
 *
 * Rules:
 * 1. Uses Mongoose session and session.withTransaction() for automatic commit and transient error retry.
 * 2. If transactions are unsupported (e.g. standalone server), ABORTS without applying partial writes
 *    and throws TransactionsUnsupportedError (HTTP 503).
 * 3. Never falls back to unsafe standalone writes or partial write compensation.
 *
 * @param {Function} workFn - async function(session) that receives the active transaction session
 * @returns {Promise<any>} The result returned by workFn
 */
async function executeInTransaction(workFn) {
  if (mongoose.connection.readyState !== 1) {
    const err = new Error("Database connection is not ready. Multi-document transactions require an active MongoDB connection.");
    err.code = "DB_NOT_CONNECTED";
    err.statusCode = 503;
    throw err;
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (sessErr) {
    const isUnsupported =
      sessErr.message &&
      (sessErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        sessErr.message.includes("Transactions are not supported on standalone") ||
        sessErr.message.includes("replica set"));

    if (isUnsupported) {
      throw new TransactionsUnsupportedError(sessErr.message);
    }

    const err = new Error("Failed to initialize database session: " + sessErr.message);
    err.code = "SESSION_INIT_FAILED";
    err.statusCode = 503;
    throw err;
  }

  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await workFn(session);
      },
      {
        readPreference: "primary",
        readConcern: { level: "local" },
        writeConcern: { w: "majority" },
      }
    );
    return result;
  } catch (txErr) {
    const isUnsupported =
      txErr.message &&
      (txErr.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        txErr.message.includes("Transactions are not supported on standalone") ||
        txErr.message.includes("replica set"));

    if (isUnsupported) {
      throw new TransactionsUnsupportedError(txErr.message);
    }

    throw txErr;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

module.exports = {
  executeInTransaction,
  checkDatabaseTransactionCapability,
  TransactionsUnsupportedError,
};
