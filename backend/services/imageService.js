const sharp = require("sharp");

const ALLOWED_IMAGE_FORMATS = ["jpeg", "jpg", "png", "webp"];
const MAX_DIMENSION = 4096; // 4K max dimension to prevent memory exhaustion

/**
 * Escapes characters for safe inclusion in SVG markup.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Validates raw buffer by inspecting true image metadata using Sharp.
 * Rejects corrupt images, unsupported formats, or oversized dimensions.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ format: string, width: number, height: number }>}
 */
async function validateImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid or empty image buffer");
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (err) {
    throw new Error("Invalid image data: unable to decode image file");
  }

  if (!metadata || !metadata.format) {
    throw new Error("Invalid image format: unrecognizable image content");
  }

  const normalizedFormat = metadata.format.toLowerCase();
  if (!ALLOWED_IMAGE_FORMATS.includes(normalizedFormat)) {
    throw new Error(
      `Unsupported image format '${normalizedFormat}'. Allowed formats: JPEG, PNG, WebP.`
    );
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    throw new Error(
      `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum allowed limit of ${MAX_DIMENSION}px`
    );
  }

  return {
    format: normalizedFormat,
    width: metadata.width,
    height: metadata.height,
  };
}

/**
 * Processes an uploaded image:
 * 1. Validates real image contents.
 * 2. Normalizes orientation (stripping EXIF orientation tags).
 * 3. Compresses without losing vital crop detail.
 * 4. Strips unnecessary EXIF metadata (specifically GPS coordinates).
 * 5. Generates an optional watermarked derivative with listing title, location name, and server timestamp.
 *
 * @param {Buffer} buffer - Input file buffer
 * @param {Object} options
 * @param {string} [options.listingTitle]
 * @param {string} [options.locationName]
 * @param {Date} [options.serverReceivedAt]
 * @param {boolean} [options.generateWatermark=true]
 * @returns {Promise<{
 *   cleanBuffer: Buffer,
 *   watermarkedBuffer: Buffer|null,
 *   width: number,
 *   height: number,
 *   format: string
 * }>}
 */
async function processImage(buffer, options = {}) {
  const meta = await validateImageBuffer(buffer);

  // Normalize orientation and strip EXIF metadata (strips GPS, camera serials, etc.)
  // Compress to WebP at quality 82 for optimal clarity and size
  let sharpInstance = sharp(buffer)
    .rotate() // auto-rotates based on EXIF orientation tag
    .webp({ quality: 82, effort: 4 });

  const cleanBuffer = await sharpInstance.toBuffer();
  const cleanMeta = await sharp(cleanBuffer).metadata();

  let watermarkedBuffer = null;

  if (options.generateWatermark !== false) {
    const title = options.listingTitle || "Marketplace Produce";
    const location = options.locationName || "Verified Farm Location";
    const serverTime = options.serverReceivedAt || new Date();

    const formattedTime = serverTime.toISOString().replace("T", " ").replace("Z", " UTC");

    // Dynamic sizing based on image dimensions
    const imgWidth = cleanMeta.width || meta.width || 800;
    const imgHeight = cleanMeta.height || meta.height || 600;

    const bannerHeight = Math.max(60, Math.round(imgHeight * 0.11));
    const titleFontSize = Math.max(16, Math.round(bannerHeight * 0.28));
    const subFontSize = Math.max(13, Math.round(bannerHeight * 0.22));

    const svgBanner = `
<svg width="${imgWidth}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${imgWidth}" height="${bannerHeight}" fill="rgba(15, 23, 42, 0.78)" />
  <rect x="0" y="0" width="${imgWidth}" height="3" fill="#10b981" />
  <text x="16" y="${titleFontSize + 12}" font-family="Arial, Helvetica, sans-serif" font-size="${titleFontSize}" font-weight="bold" fill="#ffffff">
    ${escapeXml(title)} &#8226; ${escapeXml(location)}
  </text>
  <text x="16" y="${titleFontSize + subFontSize + 20}" font-family="Arial, Helvetica, sans-serif" font-size="${subFontSize}" font-weight="bold" fill="#86efac">
    Server Received: ${escapeXml(formattedTime)} [Authoritative Server Timestamp]
  </text>
</svg>
`.trim();

    try {
      watermarkedBuffer = await sharp(cleanBuffer)
        .composite([
          {
            input: Buffer.from(svgBanner),
            gravity: "south",
          },
        ])
        .webp({ quality: 82 })
        .toBuffer();
    } catch (wmErr) {
      // Explicit error handling: do not silently omit watermark or pass broken image
      throw new Error(`Watermarking generation failed: ${wmErr.message}`);
    }
  }

  return {
    cleanBuffer,
    watermarkedBuffer,
    width: cleanMeta.width,
    height: cleanMeta.height,
    format: "webp",
  };
}

module.exports = {
  validateImageBuffer,
  processImage,
};
