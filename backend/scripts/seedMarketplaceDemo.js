/**
 * backend/scripts/seedMarketplaceDemo.js
 *
 * Idempotent Seed Script for Smart Agriculture Marketplace Demonstration
 * Seeds 25 distinct demo farmers, 1 demo bulk buyer, 25 farm locations in Nashik,
 * representative produce lots, and verified photo timelines across all freshness states.
 *
 * Usage:
 *   npm run seed:marketplace-demo
 *   or: node backend/scripts/seedMarketplaceDemo.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Guard against accidental production execution
if (require.main === module && process.env.NODE_ENV === "production") {
  console.error("❌ Refusing to seed demonstration dataset in PRODUCTION mode!");
  process.exit(1);
}

const User = require("../models/User");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");
const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const connectDB = require("../config/db");

const DEMO_PASSWORD = process.env.MARKETPLACE_DEMO_PASSWORD || "DemoFarmerPass123!";

// 25 Nashik Agricultural Demo Localities with distinct approximate centroids
const DEMO_FARMERS_CONFIG = [
  {
    num: "01",
    location: "Panchavati, Nashik",
    farmName: "Godavari Agro Greenhouses - Panchavati",
    listings: [
      {
        title: "Nashik Red Onions (Garwa Storage Grade)",
        category: "crop",
        unit: "quintal",
        qty: 1200,
        price: 2400,
        minOrder: 10,
        notes: "Air-cured red onions from winter crop, optimal for long storage.",
        photo: "onion_harvest.jpg",
        freshness: "fresh", // < 24h
      },
      {
        title: "Fresh Coriander & Mint Leaf Bundles",
        category: "produce",
        unit: "kg",
        qty: 250,
        price: 45,
        minOrder: 20,
        notes: "Morning harvest, irrigated with fresh river water.",
        photo: "leafy_vegetables.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "02",
    location: "Dindori, Nashik",
    farmName: "Dindori Valley Vineyards & Agro Estate",
    listings: [
      {
        title: "Thompson Seedless Export Table Grapes",
        category: "produce",
        unit: "kg",
        qty: 4500,
        price: 88,
        minOrder: 100,
        notes: "Brix 18+ sugar content, hand-pruned export grade bunches.",
        photo: "grapes_vineyard.jpg",
        freshness: "fresh",
      },
      {
        title: "Cabernet Sauvignon Wine Grapes",
        category: "produce",
        unit: "kg",
        qty: 6000,
        price: 110,
        minOrder: 500,
        notes: "High polyphenol winery grapes harvested at peak maturity.",
        photo: "grapes_vineyard.jpg",
        freshness: "recent",
      },
    ],
  },
  {
    num: "03",
    location: "Niphad, Nashik",
    farmName: "Niphad Bio-Fertile Agro Farms",
    listings: [
      {
        title: "Premium Summer Red Onions (Pol Harvest)",
        category: "crop",
        unit: "quintal",
        qty: 2200,
        price: 2550,
        minOrder: 25,
        notes: "Certified sorted medium-large bulb size, direct from grower.",
        photo: "onion_harvest.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "04",
    location: "Lasalgaon, Nashik",
    farmName: "Lasalgaon Mandi Anchor Farm",
    listings: [
      {
        title: "Lasalgaon Giant Red Onions",
        category: "crop",
        unit: "quintal",
        qty: 3500,
        price: 2350,
        minOrder: 50,
        notes: "Direct auction lot from prime Lasalgaon black cotton soils.",
        photo: "onion_harvest.jpg",
        freshness: "recent", // 2-5 days
      },
      {
        title: "Dehydrated White Onion Bulbs",
        category: "crop",
        unit: "quintal",
        qty: 850,
        price: 2900,
        minOrder: 20,
        notes: "Low pungency white bulbs ideal for dehydration and culinary use.",
        photo: "onion_harvest.jpg",
        freshness: "stale", // > 7 days
      },
    ],
  },
  {
    num: "05",
    location: "Pimpalgaon Baswant, Nashik",
    farmName: "Pimpalgaon Tomato & Horticulture Hub",
    listings: [
      {
        title: "Hybrid Red Ripe Tomatoes (Grade-A Crates)",
        category: "produce",
        unit: "kg",
        qty: 18000,
        price: 32,
        minOrder: 250,
        notes: "Firm, thick-skinned tomatoes harvested at color break stage.",
        photo: "tomatoes_farm.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "06",
    location: "Sinnar, Nashik",
    farmName: "Sinnar Semi-Arid Orchards",
    listings: [
      {
        title: "Bhagwa Super Red Pomegranates",
        category: "produce",
        unit: "kg",
        qty: 5200,
        price: 145,
        minOrder: 50,
        notes: "Deep red arils, sweet flavor, sorted 250g-350g individual fruits.",
        photo: "pomegranates_farm.jpg",
        freshness: "fresh",
      },
      {
        title: "Organic Desi Chickpeas (Chana)",
        category: "crop",
        unit: "quintal",
        qty: 400,
        price: 6800,
        minOrder: 10,
        notes: "Sun-dried farm harvested desi chana with minimal moisture.",
        photo: "pulses_dal.jpg",
        freshness: "recent",
      },
    ],
  },
  {
    num: "07",
    location: "Yeola, Nashik",
    farmName: "Yeola Golden Grain Estate",
    listings: [
      {
        title: "Sharbati Golden Whole Wheat Grain",
        category: "crop",
        unit: "quintal",
        qty: 2800,
        price: 2850,
        minOrder: 20,
        notes: "Lustrous heavy grain, high protein content for rotis.",
        photo: "wheat_grains.jpg",
        freshness: "recent",
      },
      {
        title: "Yellow Hybrid Feed & Sweet Corn",
        category: "crop",
        unit: "quintal",
        qty: 950,
        price: 1980,
        minOrder: 15,
        notes: "Threshed dry corn, double cleaned and bagged in 50kg sacks.",
        photo: "maize_corn.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "08",
    location: "Chandwad, Nashik",
    farmName: "Chandwad Hillside Vineyards",
    listings: [
      {
        title: "Sonaka Long Green Grapes",
        category: "produce",
        unit: "kg",
        qty: 3200,
        price: 95,
        minOrder: 80,
        notes: "Elongated sweet berries with crisp texture and uniform bunches.",
        photo: "grapes_vineyard.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "09",
    location: "Kalwan, Nashik",
    farmName: "Kalwan River Basin Greens",
    listings: [
      {
        title: "Spicy G4 Green Chillies",
        category: "produce",
        unit: "kg",
        qty: 1600,
        price: 62,
        minOrder: 50,
        notes: "Pungent green chillies freshly harvested in ventilated crates.",
        photo: "green_chillies.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "10",
    location: "Malegaon, Nashik",
    farmName: "Girna River Agronomy Farm - Malegaon",
    listings: [
      {
        title: "High Oil Content Soybean Grains",
        category: "crop",
        unit: "quintal",
        qty: 1400,
        price: 4650,
        minOrder: 20,
        notes: "Sorted JS-335 variety soybean, moisture under 10%.",
        photo: "soybeans_farm.jpg",
        freshness: "recent",
      },
      {
        title: "Pearl Millet (Hybrid Bajra)",
        category: "crop",
        unit: "quintal",
        qty: 700,
        price: 2300,
        minOrder: 10,
        notes: "Kharif harvest clean bold grain, stored in dry warehouse.",
        photo: "wheat_grains.jpg",
        freshness: "stale",
      },
    ],
  },
  {
    num: "11",
    location: "Satana, Baglan, Nashik",
    farmName: "Baglan Pomegranate & Onion Orchards",
    listings: [
      {
        title: "Arakta Premium Pomegranates",
        category: "produce",
        unit: "kg",
        qty: 3800,
        price: 155,
        minOrder: 40,
        notes: "Attractive glossy rind, high juice yield, export sorting.",
        photo: "pomegranates_farm.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "12",
    location: "Deola, Nashik",
    farmName: "Deola Commercial Tuber Farm",
    listings: [
      {
        title: "Kufri Jyoti Table Potatoes",
        category: "crop",
        unit: "quintal",
        qty: 2600,
        price: 1850,
        minOrder: 30,
        notes: "Smooth oval tubers, washed and graded 45mm+ size.",
        photo: "potatoes_farm.jpg",
        freshness: "recent",
      },
    ],
  },
  {
    num: "13",
    location: "Igatpuri, Nashik",
    farmName: "Sahyadri Terraced Rice Farm - Igatpuri",
    listings: [
      {
        title: "Indrayani Fragrant Long-Grain Rice",
        category: "crop",
        unit: "quintal",
        qty: 1900,
        price: 4900,
        minOrder: 15,
        notes: "Distinctive natural aroma from Western Ghats rainfed terraces.",
        photo: "rice_paddy.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "14",
    location: "Trimbakeshwar, Nashik",
    farmName: "Trimbak Heritage Agro Valley",
    listings: [
      {
        title: "Traditional Wada Kolam Rice Paddy",
        category: "crop",
        unit: "quintal",
        qty: 2400,
        price: 4350,
        minOrder: 20,
        notes: "Aged 6 months for superior swelling and non-sticky cooking.",
        photo: "rice_paddy.jpg",
        freshness: "recent",
      },
    ],
  },
  {
    num: "15",
    location: "Ozar, Nashik",
    farmName: "Ozar Airport Agro Belt Plantation",
    listings: [
      {
        title: "Grand Nain Fresh Cavendish Bananas",
        category: "produce",
        unit: "kg",
        qty: 7500,
        price: 26,
        minOrder: 300,
        notes: "Uniform finger length, packed in corrugated export boxes.",
        photo: "bananas_farm.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "16",
    location: "Vani, Nashik",
    farmName: "Vani Foothill Organic Veg Farm",
    listings: [
      {
        title: "Organic Palak (Spinach) & Fenugreek",
        category: "produce",
        unit: "kg",
        qty: 600,
        price: 38,
        minOrder: 30,
        notes: "Chemical pesticide-free greens harvested at sunrise.",
        photo: "leafy_vegetables.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "17",
    location: "Saikheda, Nashik",
    farmName: "Saikheda Sugarcane & Riverine Agro",
    listings: [
      {
        title: "High-Sugar Co-86032 Commercial Sugarcane",
        category: "crop",
        unit: "tonne",
        qty: 350,
        price: 3200,
        minOrder: 10,
        notes: "Freshly cut high sucrose cane ready for mill dispatch or juice trade.",
        photo: "maize_corn.jpg",
        freshness: "recent",
      },
    ],
  },
  {
    num: "18",
    location: "Sukene, Nashik",
    farmName: "Sukene Grape Grower Collective",
    listings: [
      {
        title: "Sharad Seedless Black Grapes",
        category: "produce",
        unit: "kg",
        qty: 2900,
        price: 118,
        minOrder: 60,
        notes: "Crisp black berries with natural bloom and sweet flavor.",
        photo: "grapes_vineyard.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "19",
    location: "Chandshi, Nashik",
    farmName: "Chandshi Polyhouse Produce",
    listings: [
      {
        title: "Dutch Greenhouse Red Cherry Tomatoes",
        category: "produce",
        unit: "kg",
        qty: 900,
        price: 78,
        minOrder: 25,
        notes: "Vine-ripened gourmet cherry tomatoes, sweet and firm.",
        photo: "tomatoes_farm.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "20",
    location: "Girnare, Nashik",
    farmName: "Girnare Valley Horticulture",
    listings: [
      {
        title: "Spicy Jwala Light Green Chillies",
        category: "produce",
        unit: "kg",
        qty: 1800,
        price: 58,
        minOrder: 40,
        notes: "Long slim chillies favored for Indian cooking and paste makers.",
        photo: "green_chillies.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "21",
    location: "Makhmalabad, Nashik",
    farmName: "Makhmalabad Hydroponic Gardens",
    listings: [
      {
        title: "Hydroponic Butterhead Lettuce & Bok Choy",
        category: "produce",
        unit: "kg",
        qty: 320,
        price: 85,
        minOrder: 15,
        notes: "Soil-free clean hydroponic greens with living root system.",
        photo: "leafy_vegetables.jpg",
        freshness: "fresh",
      },
    ],
  },
  {
    num: "22",
    location: "Bhagur, Nashik",
    farmName: "Bhagur Cereal & Seed Farm",
    listings: [
      {
        title: "Lokwan Whole Wheat Flour Grade",
        category: "crop",
        unit: "quintal",
        qty: 1750,
        price: 2950,
        minOrder: 20,
        notes: "Thoroughly machine cleaned grain, free from chaff and stones.",
        photo: "wheat_grains.jpg",
        freshness: "recent",
      },
    ],
  },
  {
    num: "23",
    location: "Sinnar MIDC Rural Agro, Nashik",
    farmName: "Sinnar MIDC Agro Resource Hub",
    listings: [
      {
        title: "Raw Bold Groundnuts in Shell (Peanuts)",
        category: "crop",
        unit: "quintal",
        qty: 920,
        price: 6500,
        minOrder: 15,
        notes: "Sun-dried bold pods with 2-3 large kernels per pod.",
        photo: "pulses_dal.jpg",
        freshness: "recent",
      },
    ],
  },
  {
    num: "24",
    location: "Igatpuri Agro Valleys, Nashik",
    farmName: "Bhavali Agro Rice Terraces",
    listings: [
      {
        title: "Traditional Red Terraced Rice",
        category: "crop",
        unit: "quintal",
        qty: 1350,
        price: 5400,
        minOrder: 10,
        notes: "Unpolished red rice rich in natural minerals and antioxidants.",
        photo: "rice_paddy.jpg",
        freshness: "stale",
      },
    ],
  },
  {
    num: "25",
    location: "Nandgaon, Nashik",
    farmName: "Nandgaon Dryland Farm Collective",
    listings: [
      {
        title: "Dry Yellow Maize Feed Lot",
        category: "crop",
        unit: "quintal",
        qty: 1100,
        price: 2150,
        minOrder: 30,
        notes: "Aflatoxin tested clean animal feed and poultry corn.",
        photo: "maize_corn.jpg",
        freshness: "recent",
      },
      {
        title: "Certified Hybrid Jowar Seeds (Lot #25-B)",
        category: "other",
        unit: "kg",
        qty: 500,
        price: 120,
        minOrder: 10,
        notes: "Certified test lot intentionally lacking recent photo for test verification.",
        photo: null, // STEP 10: Intentionally NO PHOTO listing
        freshness: "no_photo",
      },
    ],
  },
];

async function seedMarketplaceDemo() {
  console.log("\n========================================================");
  console.log("🌱 STARTING SMART AGRI MARKETPLACE DEMO SEEDING SCRIPT");
  console.log("========================================================");

  if (process.env.NODE_ENV === "production") {
    console.error("❌ Refusing to seed demonstration dataset in PRODUCTION mode!");
    if (require.main === module) {
      process.exit(1);
    }
    throw new Error("Refusing to seed demonstration dataset in PRODUCTION mode!");
  }

  try {
    await connectDB();

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    const now = Date.now();

    // 1. CLEANUP OR UPDATE EXISTING DEMO RECORDS (IDEMPOTENCY)
    console.log("🔍 Checking for existing demo accounts (*.demo@example.test)...");
    const existingDemoUsers = await User.find({
      email: { $regex: /@example\.test$/ },
    });

    const existingUserIds = existingDemoUsers.map((u) => u._id);
    if (existingUserIds.length > 0) {
      console.log(`🧹 Found ${existingUserIds.length} existing demo users. Refreshing demo dataset...`);

      // Find existing demo farms
      const existingCropFarms = await CropFarm.find({ userId: { $in: existingUserIds } });
      const farmIds = existingCropFarms.map((f) => f._id);

      // Clean existing demo listings & photos for a clean, deterministic state
      const existingListings = await Listing.find({ farmerId: { $in: existingUserIds } });
      const listingIds = existingListings.map((l) => l._id);

      await ListingPhoto.deleteMany({ listingId: { $in: listingIds } });
      await Listing.deleteMany({ _id: { $in: listingIds } });
      await CropFarm.deleteMany({ userId: { $in: existingUserIds } });
      await Farm.deleteMany({ userId: { $in: existingUserIds } });
      await Store.deleteMany({ userId: { $in: existingUserIds } });
      await User.deleteMany({ _id: { $in: existingUserIds } });
      console.log("✅ Prior demo records safely pruned without affecting genuine accounts.");
    }

    // 2. SEED THE 25 DEMO FARMERS
    console.log("\n🌾 Seeding 25 Distinct Demo Farmers across Nashik Region...");
    let seededFarmerCount = 0;
    let seededFarmCount = 0;
    let seededListingCount = 0;
    let seededPhotoCount = 0;

    const freshnessStats = { fresh: 0, recent: 0, stale: 0, no_photo: 0 };

    for (const cfg of DEMO_FARMERS_CONFIG) {
      const email = `farmer${cfg.num}.demo@example.test`;
      const phone = `+9198000000${cfg.num}`;

      // Create Farmer User
      const farmer = new User({
        firstName: "Demo",
        lastName: `Farmer ${cfg.num}`,
        email,
        phone,
        password: hashedPassword,
        role: "farmer",
        location: cfg.location,
      });
      await farmer.save();
      seededFarmerCount++;

      // Create Farm Location
      const farm = new CropFarm({
        userId: farmer._id,
        name: cfg.farmName,
        location: cfg.location,
      });
      await farm.save();
      seededFarmCount++;

      // Create Produce Listings for this Farmer
      for (let idx = 0; idx < cfg.listings.length; idx++) {
        const item = cfg.listings[idx];

        const listing = new Listing({
          farmerId: farmer._id,
          locationModel: "CropFarm",
          locationId: farm._id,
          category: item.category,
          title: item.title,
          description: `${item.notes} Simulated demonstration lot from ${cfg.farmName}, ${cfg.location}.`,
          quantityUnit: item.unit,
          quantityAvailable: item.qty,
          fixedPricePerUnit: item.price,
          minimumOrderQuantity: item.minOrder || 1,
          conditionNotes: item.notes,
          status: "available",
          lastStockUpdatedAt: new Date(now - (idx + 1) * 3600000),
        });
        await listing.save();
        seededListingCount++;

        // Create ListingPhoto if defined (Step 10 Freshness states)
        if (item.photo) {
          let simulatedAgeMs = 3 * 3600000; // default 3 hours ago (Fresh Today)
          if (item.freshness === "recent") {
            simulatedAgeMs = 3 * 86400000; // 3 days ago (Recent)
            freshnessStats.recent++;
          } else if (item.freshness === "stale") {
            simulatedAgeMs = 14 * 86400000; // 14 days ago (Outdated)
            freshnessStats.stale++;
          } else {
            freshnessStats.fresh++;
          }

          const photoDoc = new ListingPhoto({
            listingId: listing._id,
            uploaderId: farmer._id,
            imageUrl: `/demo-farm-images/${item.photo}`,
            watermarkedUrl: `/demo-farm-images/${item.photo}`,
            captureMethod: "file_upload",
            isPrimary: true,
          });
          await photoDoc.save();

          // Authoritative server timestamp update for simulated demonstration freshness
          const recordedDate = new Date(now - simulatedAgeMs);
          await ListingPhoto.updateOne(
            { _id: photoDoc._id },
            { $set: { serverReceivedAt: recordedDate } }
          );

          seededPhotoCount++;
        } else {
          freshnessStats.no_photo++;
        }
      }
    }

    // 3. SEED THE SINGLE DEMO BULK BUYER (STEP 3)
    console.log("\n🏢 Seeding Exactly One Demo Bulk Buyer Account...");
    const bulkBuyerEmail = "bulkbuyer.demo@example.test";
    const bulkBuyer = new User({
      firstName: "Demo",
      lastName: "Bulk Buyer",
      email: bulkBuyerEmail,
      phone: "+919800000099",
      password: hashedPassword,
      role: "bulk_buyer",
      location: "Commercial Procurement Division, Maharashtra",
    });
    await bulkBuyer.save();
    console.log(`✅ Bulk Buyer created: ${bulkBuyerEmail}`);

    // Print Verification Summary Table
    console.log("\n========================================================");
    console.log("🎉 SMART AGRICULTURE DEMO DATASET SEEDED SUCCESSFULLY");
    console.log("========================================================");
    console.log(`• Demo Farmers Created:        ${seededFarmerCount} (farmer01.demo@example.test - farmer25)`);
    console.log(`• Demo Bulk Buyers Created:    1 (${bulkBuyerEmail})`);
    console.log(`• Demo Farm Locations:         ${seededFarmCount} (Nashik agro-zones)`);
    console.log(`• Demo Active Listings:        ${seededListingCount}`);
    console.log(`• Demo Inventory Photos:       ${seededPhotoCount}`);
    console.log(`  - Fresh Today (≤ 24h):       ${freshnessStats.fresh}`);
    console.log(`  - Recent (1-7 days):         ${freshnessStats.recent}`);
    console.log(`  - Photo Outdated (> 7 days): ${freshnessStats.stale}`);
    console.log(`  - No Photo (Test lot):       ${freshnessStats.no_photo}`);
    console.log("--------------------------------------------------------");
    console.log(`🔑 Demo Password:              ${DEMO_PASSWORD}`);
    console.log("========================================================\n");

    const resultStats = {
      seededFarmerCount,
      seededFarmCount,
      seededListingCount,
      seededPhotoCount,
      freshnessStats,
      bulkBuyerEmail,
      demoPassword: DEMO_PASSWORD,
    };

    if (require.main === module) {
      await mongoose.connection.close();
      process.exit(0);
    }

    return resultStats;
  } catch (err) {
    console.error("❌ Demo Seeding Failed:", err);
    if (require.main === module) {
      if (mongoose.connection) {
        await mongoose.connection.close();
      }
      process.exit(1);
    }
    throw err;
  }
}

if (require.main === module) {
  seedMarketplaceDemo();
}

module.exports = seedMarketplaceDemo;
