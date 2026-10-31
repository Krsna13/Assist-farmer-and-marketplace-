/**
 * frontend/src/components/shared/MarketplaceSyncBanner.js
 *
 * Displays the marketplace sync result for the auto-publish account.
 * Only shown to the owner account (autoPublishEnabled=true from backend).
 * For all other users, renders nothing.
 */
import React from "react";

const STATUS_CONFIG = {
  synced: {
    bg: "bg-emerald-50 border-emerald-300",
    icon: "✅",
    text: "text-emerald-800",
    label: "Marketplace listing updated",
  },
  created: {
    bg: "bg-emerald-50 border-emerald-300",
    icon: "🛒",
    text: "text-emerald-800",
    label: "New marketplace listing created",
  },
  updated: {
    bg: "bg-blue-50 border-blue-300",
    icon: "🔄",
    text: "text-blue-800",
    label: "Marketplace listing updated",
  },
  deactivated: {
    bg: "bg-yellow-50 border-yellow-300",
    icon: "⏸️",
    text: "text-yellow-800",
    label: "Listing deactivated (no available stock)",
  },
  error: {
    bg: "bg-red-50 border-red-300",
    icon: "⚠️",
    text: "text-red-800",
    label: "Sync incomplete",
  },
  pending: {
    bg: "bg-gray-50 border-gray-300",
    icon: "⏳",
    text: "text-gray-700",
    label: "Sync pending",
  },
};

/**
 * @param {object} props
 * @param {object} props.syncResult  - { synced, action, listingId, reason }
 * @param {boolean} props.autoPublishEnabled - from /api/auto-sync/status
 * @param {function} [props.onViewListing]   - navigate to marketplace
 */
const MarketplaceSyncBanner = ({ syncResult, autoPublishEnabled, onViewListing }) => {
  if (!autoPublishEnabled || !syncResult) return null;

  const action = syncResult.action || (syncResult.synced ? "synced" : "error");
  const config = STATUS_CONFIG[action] || STATUS_CONFIG.error;

  const isSuccess = ["synced", "created", "updated"].includes(action);
  const reason = syncResult.reason || "";

  return (
    <div
      className={`border rounded-lg px-4 py-3 mt-3 flex items-start gap-3 ${config.bg}`}
      role="status"
    >
      <span className="text-xl flex-shrink-0 mt-0.5">{config.icon}</span>
      <div className="flex-1">
        <p className={`font-semibold text-sm ${config.text}`}>
          🛒 Marketplace Auto-Sync — {config.label}
        </p>
        {isSuccess && syncResult.listingId && (
          <p className="text-xs text-gray-500 mt-0.5">
            Listing ID: <span className="font-mono">{syncResult.listingId}</span>
            {onViewListing && (
              <button
                onClick={() => onViewListing(syncResult.listingId)}
                className="ml-2 text-emerald-700 underline hover:text-emerald-900 text-xs"
              >
                View Listing →
              </button>
            )}
          </p>
        )}
        {!isSuccess && reason && (
          <p className="text-xs text-red-600 mt-0.5">
            Reason: {reason}
            {action === "error" && (
              <span className="ml-1 text-gray-500">
                — fill in all required sale fields and save again to retry.
              </span>
            )}
          </p>
        )}
        {action === "skipped" && reason && (
          <p className="text-xs text-gray-500 mt-0.5">{reason}</p>
        )}
      </div>
    </div>
  );
};

export default MarketplaceSyncBanner;
