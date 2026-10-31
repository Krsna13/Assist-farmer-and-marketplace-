import React from "react";
import {
  FaMapMarkerAlt,
  FaBoxes,
  FaCamera,
  FaStore,
} from "react-icons/fa";
import { formatLocalDateTime } from "./freshnessUtils";

const CATEGORY_STYLES = {
  crop: { label: "Crop Harvest", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  livestock: { label: "Livestock", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
  produce: { label: "Fresh Produce", bg: "bg-lime-100", text: "text-lime-800", border: "border-lime-300" },
  other: { label: "Farm Resource", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
};

const ListingCard = ({
  listing,
  onSelectListing,
  onSelectFarm,
}) => {
  const {
    id,
    title,
    category,
    fixedPricePerUnit,
    quantityUnit,
    quantityAvailable,
    minimumOrderQuantity,
    locationSummary,
    farmer,
    primaryPhoto,
    photoFreshness,
    lastStockUpdatedAt,
    status,
  } = listing;

  const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.other;
  const isAvailable = status === "available" && quantityAvailable > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-200 transition-all duration-200 overflow-hidden flex flex-col group h-full">
      {/* Photo Section */}
      <div className="relative h-48 w-full bg-gradient-to-br from-emerald-900/10 to-gray-100 overflow-hidden flex items-center justify-center">
        {primaryPhoto && (primaryPhoto.watermarkedUrl || primaryPhoto.imageUrl) ? (
          <img
            src={primaryPhoto.watermarkedUrl || primaryPhoto.imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400 p-4 text-center">
            <FaCamera className="text-3xl mb-1 text-gray-300" />
            <span className="text-xs font-medium">No Photo Uploaded</span>
          </div>
        )}

        {/* Category Pill */}
        <span
          className={`absolute top-3 left-3 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs backdrop-blur-xs ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
        >
          {catStyle.label}
        </span>

        {/* Freshness Badge */}
        {photoFreshness && (
          <span
            className={`absolute top-3 right-3 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs flex items-center gap-1 ${photoFreshness.badgeColor}`}
            title={photoFreshness.description}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {photoFreshness.label}
          </span>
        )}

        {/* Availability Overlay if sold/reserved */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center">
            <span className="bg-rose-600 text-white font-extrabold text-xs uppercase px-3 py-1 rounded-md shadow-md">
              Sold Out / Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Farm & Location Header */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectFarm && locationSummary) {
                  onSelectFarm(locationSummary.model, locationSummary.id);
                }
              }}
              className="hover:text-emerald-700 font-semibold flex items-center gap-1 truncate max-w-[65%] text-left group/farm"
              title="View Public Virtual Farm Profile"
            >
              <FaStore className="text-emerald-600 flex-shrink-0" />
              <span className="truncate group-hover/farm:underline">
                {locationSummary ? locationSummary.name : "Registered Farm"}
              </span>
            </button>

            <span className="flex items-center gap-1 text-[11px] text-gray-400 truncate max-w-[35%]">
              <FaMapMarkerAlt className="text-gray-400 flex-shrink-0" />
              <span className="truncate">
                {locationSummary ? locationSummary.generalLocation : "Regional"}
              </span>
            </span>
          </div>

          {/* Produce Title */}
          <h3
            onClick={() => onSelectListing(id)}
            className="font-bold text-base text-gray-900 group-hover:text-emerald-700 transition cursor-pointer line-clamp-1 mb-2"
            title={title}
          >
            {title}
          </h3>

          {/* Pricing & Available Units */}
          <div className="bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-100/80 mb-3 flex items-baseline justify-between">
            <div>
              <span className="text-xs text-gray-500 block leading-tight">Fixed Asking Price</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-emerald-900">₹{Number(fixedPricePerUnit).toLocaleString("en-IN")}</span>
                <span className="text-xs font-semibold text-emerald-700">/ {quantityUnit}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-500 block leading-tight">Available Stock</span>
              <span className="text-sm font-bold text-gray-800">
                {Number(quantityAvailable).toLocaleString("en-IN")}{" "}
                <span className="text-xs font-normal text-gray-600">{quantityUnit}</span>
              </span>
            </div>
          </div>

          {/* Order specs & Timestamps */}
          <div className="space-y-1 text-[11px] text-gray-500">
            {minimumOrderQuantity > 1 && (
              <div className="flex items-center justify-between">
                <span>Minimum Order:</span>
                <span className="font-semibold text-gray-700">
                  {minimumOrderQuantity} {quantityUnit}
                </span>
              </div>
            )}

            {/* Authoritative Stock Update Timestamp */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FaBoxes className="text-emerald-600" /> Stock Checked:
              </span>
              <span className="font-medium text-gray-700">
                {lastStockUpdatedAt ? formatLocalDateTime(lastStockUpdatedAt) : "Initial lot stock"}
              </span>
            </div>

            {/* Authoritative Photo Upload Timestamp */}
            {primaryPhoto && primaryPhoto.serverReceivedAt && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <FaCamera className="text-blue-600" /> Photo Upload:
                </span>
                <span className="font-medium text-gray-700">
                  {formatLocalDateTime(primaryPhoto.serverReceivedAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer: Action */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">
            By <strong className="text-gray-600 font-semibold">{farmer ? farmer.name : "Grower"}</strong>
          </span>

          <button
            type="button"
            onClick={() => onSelectListing(id)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            View Details &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
