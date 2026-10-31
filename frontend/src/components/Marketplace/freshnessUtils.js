/**
 * freshnessUtils.js
 * Shared freshness evaluation and timestamp formatting for farm inventory photographs.
 *
 * Rules:
 * - Fresh: <= 24 hours old
 * - Recent: > 24 hours and <= 7 days old
 * - Stale: > 7 days old
 * - No photo: when no photo or server timestamp exists
 *
 * CRITICAL INTEGRITY NOTE:
 * Freshness calculations MUST use `serverReceivedAt` (the authoritative server receipt time),
 * NOT clientCapturedAt or any untrusted device clock.
 *
 * Freshness indicates solely how recently the backend server accepted the photograph record;
 * it does NOT independently verify physical crop quality, disease state, weight, stock quantity,
 * or GPS presence.
 */

export const FRESHNESS_THRESHOLDS = {
  FRESH_MAX_MS: 24 * 60 * 60 * 1000, // 24 hours
  RECENT_MAX_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const FRESHNESS_DISCLAIMER =
  "Freshness indicates when this photograph was received by the server. It does not independently guarantee crop condition, weight, biological health, or physical harvest date.";

/**
 * Computes freshness status for a given photo or serverReceivedAt timestamp.
 *
 * @param {Date|string|number|null} serverReceivedAt
 * @param {Date|number} [now=Date.now()]
 * @returns {{
 *   status: 'fresh' | 'recent' | 'stale' | 'no_photo',
 *   label: string,
 *   badgeColor: string,
 *   description: string
 * }}
 */
export function calculateFreshness(serverReceivedAt, now = Date.now()) {
  if (!serverReceivedAt) {
    return {
      status: "no_photo",
      label: "No Photo",
      badgeColor: "bg-gray-100 text-gray-700 border-gray-300",
      description: "No inventory photograph has been uploaded for this listing.",
    };
  }

  const timestamp = new Date(serverReceivedAt).getTime();
  if (isNaN(timestamp)) {
    return {
      status: "no_photo",
      label: "Invalid Timestamp",
      badgeColor: "bg-gray-100 text-gray-700 border-gray-300",
      description: "Recorded timestamp cannot be parsed.",
    };
  }

  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  const elapsedMs = Math.max(0, currentTime - timestamp);

  if (elapsedMs <= FRESHNESS_THRESHOLDS.FRESH_MAX_MS) {
    return {
      status: "fresh",
      label: "Fresh Today",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      description: "Server received this photo within the last 24 hours.",
    };
  } else if (elapsedMs <= FRESHNESS_THRESHOLDS.RECENT_MAX_MS) {
    return {
      status: "recent",
      label: "Recent Photo",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      description: "Server received this photo between 1 and 7 days ago.",
    };
  } else {
    return {
      status: "stale",
      label: "Photo Outdated (Stale)",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
      description: "Server received this photo more than 7 days ago. Newer photo recommended.",
    };
  }
}

/**
 * Formats a timestamp into an understandable local date and time string.
 *
 * @param {Date|string|number} dateInput
 * @returns {string}
 */
export function formatLocalDateTime(dateInput) {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Invalid Date";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
