import React, { act } from "react";
import { createRoot } from "react-dom/client";
import StockUpdateModal from "./StockUpdateModal";

describe("StockUpdateModal Component", () => {
  const mockListing = {
    _id: "listing_123",
    id: "listing_123",
    title: "Organic Red Apples",
    quantityAvailable: 150,
    quantityReserved: 30,
    quantitySold: 20,
    unit: "kg",
    status: "available",
  };

  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test("renders stock details preserving reserved and sold quantities", async () => {
    await act(async () => {
      root.render(
        <StockUpdateModal
          listing={mockListing}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );
    });

    expect(container.textContent).toContain("Update Marketplace Stock");
    expect(container.textContent).toContain("Organic Red Apples");
    expect(container.textContent).toContain("150 kg"); // Available
    expect(container.textContent).toContain("30 kg"); // Reserved
    expect(container.textContent).toContain("20 kg"); // Sold
    expect(container.textContent).toContain("Safe Stock Guarantee");
  });

  test("calls onClose when Cancel button is clicked", async () => {
    const handleClose = jest.fn();

    await act(async () => {
      root.render(
        <StockUpdateModal
          listing={mockListing}
          onClose={handleClose}
          onSuccess={() => {}}
        />
      );
    });

    const cancelBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Cancel")
    );
    expect(cancelBtn).toBeTruthy();

    await act(async () => {
      cancelBtn.click();
    });

    expect(handleClose).toHaveBeenCalled();
  });
});
