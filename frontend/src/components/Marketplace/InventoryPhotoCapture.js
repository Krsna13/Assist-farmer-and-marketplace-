import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FaCamera,
  FaRedo,
  FaCloudUploadAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaTimes,
  FaSpinner,
  FaImage,
  FaInfoCircle,
} from "react-icons/fa";

/**
 * Reusable Mobile-Friendly Inventory Photo Capture Component.
 * Supports HTML5 WebRTC camera capture (rear-facing environment camera preferred)
 * with graceful file-input fallback, client compression, optional GPS consent,
 * and comprehensive error handling.
 */
const InventoryPhotoCapture = ({
  listingId,
  listingTitle,
  onUploadSuccess,
  onCancel,
  authToken,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  // Mode & Stream states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captureMethod, setCaptureMethod] = useState("file_upload"); // 'live_camera' | 'file_upload'
  const [conditionNotes, setConditionNotes] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  // Optional GPS coordinates
  const [includeGps, setIncludeGps] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(""); // 'requesting' | 'acquired' | 'denied' | 'unsupported'

  // Progress, error, and result states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successResult, setSuccessResult] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop all camera tracks safely
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping media track:", e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (
        previewUrl &&
        previewUrl.startsWith("blob:") &&
        typeof URL !== "undefined" &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [stopCameraStream, previewUrl]);

  // Start Rear-facing Camera
  const startCamera = async () => {
    setErrorMessage("");
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        "Camera access is not supported by your browser. Please use the file upload option below."
      );
      return;
    }

    try {
      // Prefer rear camera with fallback
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage(
          "Camera permission was denied. Please allow camera access in your browser settings or use the file upload fallback."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMessage("No camera hardware found on this device.");
      } else {
        setErrorMessage(`Unable to access camera: ${err.message || "Unknown error"}.`);
      }
      setIsCameraActive(false);
    }
  };

  // Capture snapshot from video stream and compress via canvas
  const takeSnapshot = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      // Scale down large images while preserving crisp inventory condition details
      const maxDim = 1600;
      let targetW = width;
      let targetH = height;
      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setErrorMessage("Failed to capture image snapshot. Please retry.");
            return;
          }
          stopCameraStream();
          const url = URL.createObjectURL(blob);
          setCapturedBlob(blob);
          setPreviewUrl(url);
          setCaptureMethod("live_camera");
        },
        "image/jpeg",
        0.85
      );
    } catch (err) {
      console.error("Snapshot error:", err);
      setErrorMessage("Error capturing snapshot: " + err.message);
    }
  };

  // Handle fallback file input selection
  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setErrorMessage("");

    // Validate size (5 MB client-side check)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Selected file exceeds the maximum 5 MB limit. Please select a smaller photo.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Selected file must be an image (JPEG, PNG, or WebP).");
      return;
    }

    stopCameraStream();
    const url = URL.createObjectURL(file);
    setCapturedBlob(file);
    setPreviewUrl(url);
    setCaptureMethod("file_upload");
  };

  // Retake / Clear photo to start over
  const handleRetake = () => {
    if (
      previewUrl &&
      previewUrl.startsWith("blob:") &&
      typeof URL !== "undefined" &&
      typeof URL.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    setErrorMessage("");
    setSuccessResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Request optional device GPS on explicit farmer action
  const handleToggleGps = () => {
    if (includeGps) {
      setIncludeGps(false);
      setGpsCoordinates(null);
      setGpsStatus("");
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus("unsupported");
      setErrorMessage("Geolocation is not supported by your browser.");
      return;
    }

    setGpsStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoordinates({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setIncludeGps(true);
        setGpsStatus("acquired");
      },
      (err) => {
        console.warn("Geolocation denied or failed:", err);
        setGpsStatus("denied");
        setIncludeGps(false);
        setGpsCoordinates(null);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  // Upload handler with duplicate submission guard
  const handleUpload = async () => {
    if (!capturedBlob || isUploading) return;

    setIsUploading(true);
    setUploadProgress(15);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append(
        "photo",
        capturedBlob,
        captureMethod === "live_camera" ? "inventory_camera.jpg" : capturedBlob.name || "inventory_photo.jpg"
      );
      formData.append("captureMethod", captureMethod);
      formData.append("conditionNotes", conditionNotes.trim());
      formData.append("isPrimary", String(isPrimary));

      // Optional untrusted client capture timestamp
      formData.append("clientCapturedAt", new Date().toISOString());

      // Optional consented GPS
      if (includeGps && gpsCoordinates) {
        formData.append("latitude", String(gpsCoordinates.latitude));
        formData.append("longitude", String(gpsCoordinates.longitude));
      }

      setUploadProgress(40);

      const targetEndpoint = `${apiBaseUrl}/listings/${listingId}/photos`;
      const token = authToken || localStorage.getItem("token") || localStorage.getItem("authToken");

      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      setUploadProgress(85);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Upload failed with status ${response.status}`);
      }

      setUploadProgress(100);
      setSuccessResult(data.photo);

      if (onUploadSuccess) {
        onUploadSuccess(data.photo);
      }
    } catch (err) {
      console.error("Photo upload error:", err);
      setErrorMessage(err.message || "Failed to upload photo. Please check your connection and retry.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-w-xl mx-auto my-4 text-gray-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaCamera className="text-emerald-200 text-lg" />
          <h3 className="font-bold text-base md:text-lg">Farm Inventory Photo Capture</h3>
        </div>
        {onCancel && (
          <button
            onClick={() => {
              stopCameraStream();
              onCancel();
            }}
            className="text-emerald-200 hover:text-white p-1 rounded transition"
            title="Close"
          >
            <FaTimes />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {listingTitle && (
          <div className="text-xs text-gray-500 font-medium">
            Listing: <span className="text-gray-800 font-semibold">{listingTitle}</span>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-start gap-2">
            <FaExclamationTriangle className="mt-0.5 flex-shrink-0 text-rose-500" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Success Notification */}
        {successResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <FaCheckCircle className="text-emerald-600 text-base" />
              <span>Photograph uploaded and verified by server!</span>
            </div>
            <p className="text-xs text-emerald-700">
              Authoritative Server Receipt:{" "}
              <span className="font-mono font-bold">
                {new Date(successResult.serverReceivedAt).toLocaleString()}
              </span>
            </p>
            <div className="pt-2">
              <button
                onClick={handleRetake}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded transition"
              >
                Upload Another Photo
              </button>
            </div>
          </div>
        )}

        {/* Stage A: Active Live Camera View */}
        {isCameraActive && (
          <div className="space-y-3">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center border border-gray-800 shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                Live Camera
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={takeSnapshot}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-md"
              >
                <FaCamera /> Capture Snapshot
              </button>
              <button
                type="button"
                onClick={stopCameraStream}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition"
              >
                Cancel Camera
              </button>
            </div>
          </div>
        )}

        {/* Stage B: Photo Preview & Review Before Upload */}
        {!isCameraActive && previewUrl && !successResult && (
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden border border-gray-300 shadow-sm bg-gray-50 aspect-video flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Captured inventory preview"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-2 left-2 bg-black/75 text-white text-xs px-2.5 py-1 rounded-md backdrop-blur-sm flex items-center gap-1.5">
                {captureMethod === "live_camera" ? (
                  <>
                    <FaCamera className="text-emerald-400" /> Live Camera Snapshot
                  </>
                ) : (
                  <>
                    <FaImage className="text-blue-400" /> Uploaded File
                  </>
                )}
              </div>
            </div>

            {/* Integrity Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-start gap-2">
              <FaInfoCircle className="mt-0.5 text-amber-600 flex-shrink-0" />
              <span>
                Review carefully: Server will generate an authoritative receipt timestamp upon successful upload.
                {captureMethod === "file_upload" &&
                  " Note: File-input capture hint does not guarantee gallery selection is disabled."}
              </span>
            </div>

            {/* Farmer Condition Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Crop / Inventory Condition Notes (Optional)
              </label>
              <textarea
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="e.g., Freshly harvested this morning, stored in dry shed, grade A grain..."
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
              />
              <div className="text-right text-[10px] text-gray-400">
                {conditionNotes.length}/500
              </div>
            </div>

            {/* Primary Listing Photo Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrimaryCheckbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <label
                htmlFor="isPrimaryCheckbox"
                className="text-xs font-medium text-gray-700 cursor-pointer"
              >
                Set as Primary photo for this listing
              </label>
            </div>

            {/* Optional Device GPS */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <FaMapMarkerAlt className="text-emerald-600" />
                  <span>Attach Device GPS (Optional)</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleGps}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                    includeGps
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  {includeGps ? "Location Attached" : "Add Location"}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                GPS is completely optional. Coordinates are never exposed to public viewers by default
                and do not conclusively prove physical farm origin.
              </p>
              {gpsStatus === "denied" && (
                <p className="text-[11px] text-amber-700">
                  Location access was not granted. You can still upload without GPS.
                </p>
              )}
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Uploading and securing on server...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons with Duplicate Submission Prevention */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={handleUpload}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <FaSpinner className="animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <FaCloudUploadAlt /> Confirm & Upload Photo
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={handleRetake}
                className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg flex items-center gap-1.5 transition"
              >
                <FaRedo /> Retake
              </button>
            </div>
          </div>
        )}

        {/* Stage C: Initial State - Choose Live Camera or File Input */}
        {!isCameraActive && !previewUrl && !successResult && (
          <div className="space-y-4 text-center py-4">
            <div className="p-4 border-2 border-dashed border-gray-300 rounded-xl space-y-3 bg-gray-50/50">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shadow-inner">
                  <FaCamera />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-800">
                  Take or Select an Inventory Photo
                </h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Take a photo of the produce or harvest currently in your farm or storage.
                  Maximum file size: 5 MB (JPEG, PNG, WebP).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 transition shadow-sm text-xs"
                >
                  <FaCamera /> Start Rear Camera
                </button>

                <label className="w-full sm:w-auto bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 transition shadow-sm text-xs cursor-pointer">
                  <FaImage className="text-gray-500" /> Choose Image File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-[11px] text-gray-400 italic pt-1">
                Camera access opens directly on mobile devices with rear camera preference.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryPhotoCapture;
