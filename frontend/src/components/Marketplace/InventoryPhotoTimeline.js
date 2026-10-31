import React, { useState } from "react";
import {
  FaClock,
  FaCamera,
  FaImage,
  FaInfoCircle,
  FaEye,
} from "react-icons/fa";
import {
  calculateFreshness,
  formatLocalDateTime,
  FRESHNESS_DISCLAIMER,
} from "./freshnessUtils";

/**
 * Reusable Inventory Photo Timeline & Gallery Component.
 * Displays the latest inventory photo with freshness badges,
 * stable chronological history cards, watermark derivative toggling,
 * condition notes, and explicit freshness disclaimers.
 */
const InventoryPhotoTimeline = ({
  photos = [],
  listingTitle = "Produce Listing",
  onOpenUpload,
  canUpload = false,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showWatermarked, setShowWatermarked] = useState(true);

  const hasPhotos = photos && photos.length > 0;
  const currentPhoto = hasPhotos ? photos[selectedPhotoIndex] || photos[0] : null;
  const freshness = currentPhoto
    ? calculateFreshness(currentPhoto.serverReceivedAt)
    : calculateFreshness(null);

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden text-gray-800">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-emerald-800 to-gray-800 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FaCamera className="text-emerald-300" />
          <h3 className="font-bold text-sm md:text-base">Inventory Photo Timeline</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Freshness Badge */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 shadow-sm ${freshness.badgeColor}`}
            title={freshness.description}
          >
            <FaClock className="text-[11px]" />
            {freshness.label}
          </span>

          {canUpload && onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1"
            >
              <FaCamera /> Add Photo
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 space-y-5">
        {!hasPhotos ? (
          /* Empty State */
          <div className="text-center py-10 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xl">
              <FaImage />
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 text-sm">No Inventory Photos Available</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                The farmer has not yet uploaded a verified photograph for this listing.
              </p>
            </div>
            {canUpload && onOpenUpload && (
              <div className="pt-2">
                <button
                  onClick={onOpenUpload}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm inline-flex items-center gap-1.5"
                >
                  <FaCamera /> Take or Upload First Photo
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Display Gallery & Timeline */
          <div className="space-y-4">
            {/* Featured Photo Viewer */}
            <div className="relative rounded-xl overflow-hidden border border-gray-300 shadow-sm bg-gray-900 aspect-video flex items-center justify-center">
              <img
                src={
                  showWatermarked && currentPhoto.watermarkedUrl
                    ? currentPhoto.watermarkedUrl
                    : currentPhoto.imageUrl
                }
                alt={`${listingTitle} inventory`}
                className="w-full h-full object-contain"
              />

              {/* Watermark Toggle */}
              {currentPhoto.watermarkedUrl && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs text-white">
                  <FaEye className="text-emerald-400" />
                  <span>Watermark:</span>
                  <button
                    onClick={() => setShowWatermarked(!showWatermarked)}
                    className={`text-[11px] px-2 py-0.5 rounded font-bold transition ${
                      showWatermarked
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-600 hover:bg-gray-500 text-gray-200"
                    }`}
                  >
                    {showWatermarked ? "ON" : "OFF"}
                  </button>
                </div>
              )}

              {/* Method & Primary Badges */}
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                {currentPhoto.isPrimary && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                    Primary Photo
                  </span>
                )}
                <span className="bg-black/60 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded flex items-center gap-1">
                  {currentPhoto.captureMethod === "live_camera" ? (
                    <>
                      <FaCamera className="text-emerald-400" /> Live Camera
                    </>
                  ) : (
                    <>
                      <FaImage className="text-blue-400" /> File Upload
                    </>
                  )}
                </span>
              </div>

              {/* Bottom Meta Overlay */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 text-white text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-gray-300 text-[11px]">Authoritative Server Receipt: </span>
                  <span className="font-mono font-bold text-emerald-300">
                    {formatLocalDateTime(currentPhoto.serverReceivedAt)}
                  </span>
                </div>
                {currentPhoto.clientCapturedAt && (
                  <div className="text-[10px] text-gray-400 italic">
                    Reported capture: {formatLocalDateTime(currentPhoto.clientCapturedAt)} (unverified)
                  </div>
                )}
              </div>
            </div>

            {/* Condition Notes */}
            {currentPhoto.conditionNotes && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700">
                <span className="font-semibold text-gray-900 block mb-0.5">Farmer Condition Notes:</span>
                <p className="italic">{currentPhoto.conditionNotes}</p>
              </div>
            )}

            {/* Freshness Disclaimer Box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2">
              <FaInfoCircle className="mt-0.5 text-emerald-600 flex-shrink-0" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Freshness Verification Policy</span>
                <p className="text-[11px] text-emerald-800">{FRESHNESS_DISCLAIMER}</p>
              </div>
            </div>

            {/* Chronological History Carousel / Thumbnails */}
            {photos.length > 1 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Photo History ({photos.length} photos)
                </h4>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {photos.map((item, idx) => {
                    const itemFreshness = calculateFreshness(item.serverReceivedAt);
                    const isSelected = idx === selectedPhotoIndex;
                    return (
                      <button
                        key={item.id || idx}
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition text-left relative aspect-video w-32 bg-gray-100 ${
                          isSelected
                            ? "border-emerald-600 ring-2 ring-emerald-400 shadow-md"
                            : "border-gray-200 hover:border-gray-300 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={item.imageUrl}
                          alt="History snapshot"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 right-1">
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${itemFreshness.badgeColor}`}
                          >
                            {itemFreshness.status}
                          </span>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] text-white px-1 py-0.5 truncate text-center">
                          {formatLocalDateTime(item.serverReceivedAt)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryPhotoTimeline;
