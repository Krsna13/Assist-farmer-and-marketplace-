import React, { act } from "react";
import { createRoot } from "react-dom/client";
import FarmerDashboard from "./FarmerDashboard";

describe("FarmerDashboard Component", () => {
  let container;
  let root;
  const originalFetch = global.fetch;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Mock API fetch
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes("/farmer/dashboard")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            summary: {
              activeListings: 3,
              totalAvailableStock: 450,
              totalReservedStock: 50,
              totalSoldStock: 100,
              inactiveOrSoldListings: 1,
              stalePhotoListings: 1,
              unphotographedListings: 1,
              latestPhotoUpdate: new Date().toISOString(),
              totalBids: 2,
              pendingBids: 1,
              totalOrders: 3,
              activeOrders: 1,
            },
            recentBids: [],
            recentOrders: [],
          }),
        });
      }
      if (url.includes("/farmer/listings")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            listings: [
              {
                _id: "listing_1",
                id: "listing_1",
                title: "Basmati Rice Batch 1",
                category: "Grains & Cereals",
                quantityAvailable: 300,
                quantityReserved: 50,
                quantitySold: 100,
                unit: "kg",
                pricePerUnit: 85,
                status: "available",
                photoHealth: {
                  hasPhoto: true,
                  freshness: "fresh",
                  latestPhoto: {
                    serverReceivedAt: new Date().toISOString(),
                    photoUrl: "/uploads/mock.jpg",
                  },
                },
              },
            ],
            total: 1,
          }),
        });
      }
      if (url.includes("/farmer/source-inventory")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            sourceInventory: {
              cropRecords: [
                {
                  _id: "crop_1",
                  cropName: "Wheat",
                  cropType: "Cereal",
                  season: "Rabi",
                  seedQuantity: 120,
                  location: {
                    id: "farm_1",
                    name: "Green Acres Parcel A",
                    model: "CropFarm",
                  },
                },
              ],
              animals: [],
              productions: [],
              unitResources: [],
              itemResources: [],
            },
          }),
        });
      }
      if (url.includes("/farmer/bids")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, bids: [] }),
        });
      }
      if (url.includes("/farmer/orders")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, orders: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test("renders Farmer Marketplace Dashboard with navigation tabs", async () => {
    await act(async () => {
      root.render(
        <FarmerDashboard
          onBackToBuyerMarketplace={() => {}}
          onBackToHome={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Farmer Marketplace Dashboard");
    expect(container.textContent).toContain("Dashboard Overview");
    expect(container.textContent).toContain("My Listings");
    expect(container.textContent).toContain("Publish Farm Inventory");
    expect(container.textContent).toContain("Incoming Bids");
    expect(container.textContent).toContain("Orders");
  });

  test("can switch to Publish Farm Inventory tab", async () => {
    await act(async () => {
      root.render(
        <FarmerDashboard
          onBackToBuyerMarketplace={() => {}}
          onBackToHome={() => {}}
        />
      );
    });

    const publishTabButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent && b.textContent.includes("Publish Farm Inventory")
    );

    expect(publishTabButton).toBeDefined();

    await act(async () => {
      publishTabButton.click();
    });

    expect(container.textContent).toContain("Publish Farm Inventory");
  });
});
