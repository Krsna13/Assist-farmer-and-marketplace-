import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FaMapMarkerAlt, FaStore, FaShieldAlt, FaSyncAlt } from "react-icons/fa";

const MarketplaceMap = ({
  onSelectListing,
  onSelectFarm,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [markers, setMarkers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState("");

  // Fetch approximate public map markers from backend
  const fetchMapMarkers = useCallback(async () => {
    setIsLoading(true);
    setMapError("");
    try {
      const res = await fetch(`${apiBaseUrl}/map-locations`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}: Failed to load locations`);
      }
      setMarkers(data.markers || []);
    } catch (err) {
      setMapError("Unable to retrieve farm map coordinates. " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchMapMarkers();
  }, [fetchMapMarkers]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [19.75, 75.71], // Central agro-region
        zoom: 6,
        minZoom: 4,
        maxZoom: 14,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map markers whenever markers data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (!markers || markers.length === 0) return;

    const bounds = L.latLngBounds();

    markers.forEach((m) => {
      if (!m.coordinates || m.coordinates.length !== 2) return;
      const [lat, lng] = m.coordinates;

      const farmPinIcon = L.divIcon({
        className: "custom-farm-pin",
        html: `
          <div style="background: linear-gradient(135deg, #059669, #047857); color: white; border-radius: 9999px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #ffffff; cursor: pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"></path>
              <circle cx="12" cy="9" r="2.5"></circle>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([lat, lng], { icon: farmPinIcon });

      // Create popup HTML
      const sampleItemsHtml = (m.sampleListings || [])
        .map(
          (item) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px;">
              <span style="font-weight: 600; color: #111827; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</span>
              <span style="font-weight: 700; color: #065f46;">₹${item.price}/${item.unit}</span>
            </div>
          `
        )
        .join("");

      const imageHtml = m.photoUrl
        ? `
          <div style="position: relative; width: 100%; height: 115px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #f3f4f6;">
            <img src="${m.photoUrl}" alt="${m.representativeItemTitle || m.farmName}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'"/>
            <span style="position: absolute; top: 6px; right: 6px; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; background: rgba(5, 150, 105, 0.9); color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
              ${m.freshnessLabel || "Active"}
            </span>
          </div>
        `
        : "";

      const repProductHtml = m.representativeItemTitle
        ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px;">
            <div style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #047857;">Featured Lot</div>
            <div style="font-weight: 700; font-size: 12px; color: #064e3b; margin: 1px 0;">${m.representativeItemTitle}</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
              <span style="color: #374151; font-weight: 600;">Available: ${Number(m.availableQuantity).toLocaleString()} ${m.quantityUnit}</span>
              <span style="color: #047857; font-weight: 800;">₹${m.fixedPricePerUnit}/${m.quantityUnit}</span>
            </div>
          </div>
        `
        : "";

      const uploadTimeHtml = m.serverReceivedAt
        ? `
          <div style="font-size: 9.5px; color: #6b7280; margin-top: 3px;">
            <strong>Server Verified:</strong> ${new Date(m.serverReceivedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        `
        : "";

      const popupContent = document.createElement("div");
      popupContent.className = "p-1 text-gray-800";
      popupContent.style.minWidth = "250px";
      popupContent.style.maxWidth = "280px";
      popupContent.innerHTML = `
        <div style="font-family: inherit;">
          ${imageHtml}
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase;">
            <span>${m.locationModel || "Farm"}</span>
            <span style="background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 1px 4px; border-radius: 4px; font-size: 9px;">Approx. Region</span>
          </div>
          <h4 style="font-weight: 800; font-size: 14px; margin: 2px 0 1px; color: #111827;">${m.farmName}</h4>
          <div style="font-size: 11px; font-weight: 600; color: #059669; margin-bottom: 4px;">
            Grower: <span style="color: #1f2937;">${m.farmerDisplayName || m.farmerName || "Demo Farmer"}</span>
          </div>
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 5px 7px; margin: 4px 0 6px; font-size: 10px; color: #4b5563; line-height: 1.3;">
            <strong style="color: #111827;">Regional Centroid:</strong> ${m.generalLocation || m.generalRegion || "Agricultural Zone"}<br/>
            <span style="color: #6b7280; font-size: 9px;">Coordinates represent approximate agro-zone to safeguard grower privacy.</span>
            ${uploadTimeHtml}
          </div>

          ${repProductHtml}

          <div style="margin-bottom: 6px;">
            <div style="font-size: 10px; font-weight: 600; color: #4b5563; margin-bottom: 2px;">Total Active Lots: ${m.totalListings}</div>
            ${sampleItemsHtml || '<div style="font-size: 11px; color: #9ca3af;">No active listings</div>'}
          </div>

          <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 8px;">
            <button id="btn-farm-${m.locationId}" style="flex: 1; background-color: #059669; color: white; border: none; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer;">
              Farm Profile
            </button>
            ${
              m.representativeListingId
                ? `<button id="btn-lot-${m.locationId}" style="flex: 1; background-color: #1f2937; color: white; border: none; padding: 6px 8px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer;">
                     View Lot
                   </button>`
                : ""
            }
          </div>
        </div>
      `;

      // Attach click events to popup buttons
      const farmBtn = popupContent.querySelector(`#btn-farm-${m.locationId}`);
      if (farmBtn) {
        farmBtn.addEventListener("click", () => {
          if (onSelectFarm) {
            onSelectFarm(m.locationModel, m.locationId);
          }
        });
      }

      const lotBtn = popupContent.querySelector(`#btn-lot-${m.locationId}`);
      if (lotBtn) {
        lotBtn.addEventListener("click", () => {
          if (onSelectListing && m.representativeListingId) {
            onSelectListing(m.representativeListingId);
          }
        });
      }

      marker.bindPopup(popupContent);
      layer.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }, [markers, onSelectFarm, onSelectListing]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* Top Map Control Bar */}
      <div className="bg-gradient-to-r from-emerald-900 via-gray-900 to-emerald-950 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <FaMapMarkerAlt className="text-emerald-400 text-sm" />
          <span className="font-bold">Agricultural Regional Discovery Map</span>
          <span className="text-gray-400 text-[11px]">({markers.length} Approximate Agricultural Regions)</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMapMarkers}
            disabled={isLoading}
            className="flex items-center gap-1 text-[11px] bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded transition text-emerald-200"
            title="Refresh map coordinates"
          >
            <FaSyncAlt className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-200/90 bg-emerald-800/40 px-2.5 py-1 rounded-full border border-emerald-700/50">
            <FaShieldAlt className="text-yellow-400" />
            <span>Approximate coordinates protect grower privacy</span>
          </div>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative w-full h-[520px] bg-emerald-50/50">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10">
            <div className="bg-white rounded-xl shadow-lg p-5 flex items-center gap-3 border border-gray-200">
              <div className="w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-gray-700">Loading map markers...</span>
            </div>
          </div>
        )}

        {/* Map Error Fallback */}
        {mapError && (
          <div className="absolute top-4 left-4 right-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs shadow-md z-10 flex items-center justify-between">
            <span>{mapError}</span>
            <button
              onClick={() => setMapError("")}
              className="text-rose-500 font-bold ml-2 text-sm"
            >
              &times;
            </button>
          </div>
        )}

        {/* Empty State when no markers */}
        {!isLoading && markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-white/95 rounded-2xl shadow-md p-6 max-w-sm text-center border border-gray-200 pointer-events-auto">
              <FaStore className="text-emerald-600 text-3xl mx-auto mb-2" />
              <h4 className="font-bold text-sm text-gray-900 mb-1">No Active Farm Locations Found</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                As growers publish active produce with general locations, regional centroid pins will appear across this map.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Map Legend */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block shadow-2xs"></span>
            <strong>Approximate Regional Centroid:</strong> Marker represents general farming area (not exact boundaries)
          </span>
          <span className="text-gray-400">&bull;</span>
          <span>Zoom and pan to explore agricultural regions</span>
        </div>

        <span className="text-gray-400">Map tile data &copy; OpenStreetMap</span>
      </div>
    </div>
  );
};

export default MarketplaceMap;
