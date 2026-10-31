require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Comprehensive built-in farming knowledge engine for instant offline advisory
const getAgriAdvisoryAnswer = (query, lang = "english") => {
  const q = query.toLowerCase();

  const isUrdu = lang === "urdu";

  if (q.includes("pest") || q.includes("insect") || q.includes("spray") || q.includes("کیڑا") || q.includes("اسپرے")) {
    if (isUrdu) {
      return `کیڑوں کے تدارک کے لیے تجاویز:
1. علامات کی باقاعدہ جانچ کریں اور متاثرہ پتوں کو تلف کریں۔
2. رس چوسنے والے کیڑوں (جیسے سست تیلا یا سفید مکھی) کے لیے نیم کا تیل (Neem Oil) یا سفارش کردہ کیڑے مار دوا مناسب مقدار میں اسپرے کریں۔
3. اسپرے ہمیشہ صبح سویرے یا شام کے وقت ہوا بند ہونے پر کریں۔
4. فصلوں کے ادل بدل سے کیڑوں کے حملے کے امکانات کم ہو جاتے ہیں۔`;
    }
    return `Pest Management Guidance:
1. Identify the pest early: Look underneath leaves for aphids, whiteflies, bollworms, or thrips.
2. Integrated Pest Management (IPM): Spray neem-based organic repellents before resorting to synthetic pesticides.
3. Recommended application: Apply targeted insecticide in early morning or late afternoon to prevent evaporation and leaf scorching.
4. Rotate pesticide active ingredients across seasons to avoid pest resistance build-up.`;
  }

  if (q.includes("fertiliz") || q.includes("urea") || q.includes("dap") || q.includes("npk") || q.includes("کھاد")) {
    if (isUrdu) {
      return `کھاد اور زمین کی زرخیزی کی تجاویز:
1. ڈی اے پی (DAP) بوائی کے وقت بنیادی کھاد کے طور پر استعمال کریں۔
2. یوریا (Urea) کو قسطوں میں پانی لگاتے وقت دیں تاکہ نائٹروجن ہوا میں ضائع نہ ہو۔
3. زمین کی زرخیزی کے لیے گوبر کی دیسی کھاد (FYM) یا سبز کھاد کا استعمال کریں۔
4. کھاد کے متوازن استعمال (NPK) کے لیے زمین کا تجزیہ (Soil Testing) لازمی کرائیں۔`;
    }
    return `Fertilization & Soil Nutrition Guidance:
1. Basal Application: Apply Phosphatic fertilizers (DAP) during land preparation and seed sowing so roots develop deep.
2. Nitrogen Application: Split Urea into 2–3 applications during vegetative growth stages alongside irrigation to minimize nitrogen leaching.
3. Micronutrients: Ensure Zinc and Boron application for cereal crops and vegetables to prevent stunted growth and chlorosis.
4. Soil Health: Regularly incorporate decomposed organic farmyard manure (FYM) to maintain soil moisture retention.`;
  }

  if (q.includes("water") || q.includes("irrigat") || q.includes("پانی") || q.includes("آبپاشی")) {
    if (isUrdu) {
      return `آبپاشی کے بنیادی اصول:
1. فصل کے نازک مراحل (جیسے بوائی کے بعد، شگوفے نکلتے وقت، اور پھل بنتے وقت) پانی کی کمی نہ آنے دیں۔
2. پانی کی بچت اور بہترین پیداوار کے لیے ڈرپ (Drip) یا اسپرنکلر سسٹم استعمال کریں۔
3. زمین میں وتر (نمی) کی جانچ کر کے ہی پانی دیں تاکہ جڑوں کا گلنا روکا جا سکے۔
4. شام یا صبح کے وقت پانی لگانے سے پانی کا بخارات بننا کم ہوتا ہے۔`;
    }
    return `Irrigation Management Guidance:
1. Critical Stages: Never allow moisture stress during germination, tillering/flowering, and grain/fruit filling stages.
2. Method: Adopt drip irrigation for horticulture and row crops to save 40-50% water and deliver liquid fertigation directly to roots.
3. Drainage: Ensure field drainage channels are clear during heavy rainfall to avoid waterlogging and root rot.
4. Optimal Timing: Irrigate during calm evening or early morning hours to minimize evaporative loss.`;
  }

  if (q.includes("cow") || q.includes("animal") || q.includes("livestock") || q.includes("milk") || q.includes("جانور") || q.includes("دودھ") || q.includes("گائے")) {
    if (isUrdu) {
      return `مویشیوں کی دیکھ بھال کی ہدایات:
1. متوازن غذا: جانوروں کو روزانہ سبز چارہ، خشک توڑی اور متوازن ونڈا دیں۔
2. پینے کا صاف پانی ہر وقت جانور کے سامنے دستیاب ہونا چاہیے۔
3. باقاعدہ حفاظتی ٹیکے (FMD, Black Quarter) اور پیٹ کے کیڑوں کی دوائی (Deworming) وقت پر دیں۔
4. دودھ نکالنے سے پہلے اور بعد میں تھنوں کی صفائی (Teat dipping) کریں تاکہ سوزش یا میسٹائٹس سے بچاؤ ممکن ہو۔`;
    }
    return `Livestock & Dairy Management Guidance:
1. Balanced Ration: Provide 60% green forage + 40% dry fodder, supplemented with concentrated balanced feed (Vanda) and mineral mixtures.
2. Clean Water: Ensure 24/7 access to fresh, cool drinking water (dairy cows need 60-100 liters/day for optimal milk yield).
3. Preventive Care: Follow a strict vaccination calendar for FMD, HS, and Blackleg, and deworm ruminants every 3-4 months.
4. Teat Hygiene: Clean teats before and after milking to prevent mastitis infection.`;
  }

  if (q.includes("wheat") || q.includes("گندم")) {
    if (isUrdu) {
      return `گندم کی نگہداشت:
1. بوائی کا بہترین وقت یکم نومبر سے 20 نومبر ہے۔
2. بیج کی مقدار 50 کلوگرام فی ایکڑ رکھیں۔
3. پہلا پانی بوائی کے 20 سے 25 دن بعد دیں جب شگوفے بن رہے ہوں۔
4. جڑی بوٹیوں کی تلفی پہلے پانی کے بعد وتر حالت میں اسپرے سے کریں۔`;
    }
    return `Wheat Cultivation Key Points:
1. Sowing Window: Mid-October to late November depending on zone; use certified rust-resistant seed varieties at 40-50 kg/acre.
2. Crown Root Initiation (CRI): Apply the first critical irrigation 20-25 days after sowing.
3. Nutrient Dosage: Apply full dose of DAP and Potash at sowing, and split Urea evenly between 1st and 2nd irrigation.
4. Weed Management: Apply post-emergence broadleaf and grassy herbicide 30-35 days after sowing in moist soil condition.`;
  }

  // General Agri Assistant response
  if (isUrdu) {
    return `خوش آمدید! سمارٹ زرعی انتظام کا اسسٹنٹ آپ کی خدمت میں حاضر ہے۔
آپ درج ذیل موضوعات پر رہنمائی حاصل کر سکتے ہیں:
• فصلوں کی بوائی، آبپاشی اور پیداواری تدابیر
• کیڑوں اور بیماریوں کی روک تھام
• کھاد اور زمین کی زرخیزی (یوریا، ڈی اے پی، این پی کے)
• ڈیری فارمنگ اور مویشیوں کی خوراک و علاج
• فارم وسائل اور مارکیٹ پلیس کا انتظام`;
  }

  return `Welcome to the Smart Agri Management Assistant!
I can provide immediate operational guidance on:
• Crop cycles, sowing windows, seed rates, and field activities
• Pest, insect, and fungal disease diagnosis and treatment
• Fertilizer ratios, NPK balances, and soil nutrient health
• Dairy & livestock welfare, vaccination, and milking optimization
• Farm resources, marketplace pricing, and inventory planning

Feel free to ask any specific question about your farm operations!`;
};

const sendMessage = async (req, res) => {
  const { userMessage, lang } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: "Message is required" });
  }

  const rawKey = process.env.GOOGLE_API_KEY || "";
  const apiKey = rawKey.trim();

  // If no Gemini API key is configured in backend/.env, provide intelligent Agri Advisory
  if (!apiKey || apiKey === "" || apiKey === "your_gemini_api_key_here") {
    const advisoryAnswer = getAgriAdvisoryAnswer(userMessage, lang);
    const keyHint =
      lang === "urdu"
        ? "\n\n(نوٹ: لائیو گوگل جیمینائی AI کو فعال کرنے کے لیے backend/.env میں GOOGLE_API_KEY شامل کریں)"
        : "\n\n💡 Pro-Tip: To activate full live Google Gemini Generative AI, add your free GOOGLE_API_KEY in backend/.env.";

    return res.status(200).json({ response: advisoryAnswer + keyHint });
  }

  // Attempt Google Gemini AI generation with verified active models
  const modelsToTry = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-3.8-flash"
  ];
  let reply = null;
  let lastError = null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);


    let prompt = `You are the Expert AI Assistant for the Smart Agri Management System.
You assist farmers with questions regarding crop management, livestock, soil, fertilization, irrigation, pests, and farm finance.

IMPORTANT FORMATTING RULES:
- Always organize the answer with clear, clean bullet points (* or -) and numbered steps.
- Use bold headings (e.g. ### Heading) to separate logical parts.
- Highlight key terms, crop varieties, quantities, timings, and chemical/fertilizer names in **bold**.
- Keep paragraphs short (1-2 sentences max). Never output a giant wall of unformatted text.
- Make the answer easy for a farmer to scan and execute immediately.

User query: ${userMessage}
`;

    if (lang === "urdu") {
      prompt += "\nPlease respond in Urdu with clearly spaced bullet points and clean structure.";
    } else {
      prompt += "\nPlease respond in English formatted with clearly spaced bullet points and numbered steps.";
    }


    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        if (result && result.response) {
          reply = result.response.text();
          if (reply) break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed, trying next:`, err.message);
      }
    }

    if (reply) {
      return res.status(200).json({ response: reply });
    }

    // If Gemini models encountered API issues, fall back smoothly to the Agri engine
    console.error("Gemini AI API error:", lastError?.message);
    const fallbackAnswer = getAgriAdvisoryAnswer(userMessage, lang);
    return res.status(200).json({
      response:
        fallbackAnswer +
        `\n\n⚠️ (Notice: Gemini API responded with: "${lastError?.message || 'Quota/Key check required'}". Showing Agri Advisory knowledge base response.)`
    });
  } catch (error) {
    console.error("Chat controller error:", error.message);
    const fallbackAnswer = getAgriAdvisoryAnswer(userMessage, lang);
    res.status(200).json({ response: fallbackAnswer });
  }
};

module.exports = { sendMessage };

