const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

let memServerInstance = null;
const activeUriPath = path.resolve(__dirname, "../.mongo-data/active_uri.txt");

const connectDB = async () => {
  // 1. If explicit MONGO_URI is set in .env (e.g. MongoDB Atlas), use it
  if (process.env.MONGO_URI) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(` MongoDB Connected (Custom/Atlas): ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (error) {
      console.error(` Failed to connect to MONGO_URI: ${error.message}`);
      throw error;
    }
  }

  // 1.5. If active embedded Mongo URI file exists, connect to running instance (avoids lock file collision)
  if (fs.existsSync(activeUriPath)) {
    try {
      const savedUri = fs.readFileSync(activeUriPath, "utf8").trim();
      if (savedUri) {
        const conn = await mongoose.connect(savedUri, { serverSelectionTimeoutMS: 2000 });
        console.log(`✅ Connected to active MongoDB instance: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
      }
    } catch (activeErr) {
      // Running instance stopped or not reachable; remove stale file and continue
      try {
        fs.unlinkSync(activeUriPath);
      } catch (e) {}
    }
  }

  // 2. Otherwise try local MongoDB service at 127.0.0.1:27017
  const localUri = "mongodb://127.0.0.1:27017/smart_agri_db";
  try {
    const conn = await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(` MongoDB Connected (Local Service): ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (localError) {
    console.log(`\n⚠️ Local MongoDB service not active at ${localUri}.`);
    console.log(`⚡ Initializing embedded persistent MongoDB instance...`);

    // 3. Fallback: Automatically start persistent embedded MongoDB
    try {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const dbPath = path.resolve(__dirname, "../.mongo-data");
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }

      memServerInstance = await MongoMemoryServer.create({
        instance: {
          dbPath,
          storageEngine: "wiredTiger",
        },
      });

      const memUri = `${memServerInstance.getUri()}smart_agri_db`;
      try {
        fs.writeFileSync(activeUriPath, memUri, "utf8");
      } catch (e) {}

      const conn = await mongoose.connect(memUri);
      console.log(`✅ Embedded MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      console.log(`📁 Local database stored at: ${dbPath}\n`);
      return conn;
    } catch (memError) {
      console.error("❌ Failed to start embedded MongoDB:", memError.message);
      console.warn("Please ensure MongoDB is running or specify MONGO_URI in 'backend/.env'\n");
      throw memError;
    }
  }
};

// Graceful cleanup on shutdown
const cleanup = async () => {
  if (memServerInstance) {
    try {
      await mongoose.disconnect();
      await memServerInstance.stop();
    } catch (e) {}
  }
};

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

process.once("SIGUSR2", async () => {
  await cleanup();
  process.kill(process.pid, "SIGUSR2");
});

module.exports = connectDB;
