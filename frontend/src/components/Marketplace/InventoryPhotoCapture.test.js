import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InventoryPhotoCapture from './InventoryPhotoCapture';

describe('InventoryPhotoCapture Component', () => {
  let container;
  let root;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    originalCreateObjectURL = window.URL.createObjectURL;
    originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-image-preview');
    window.URL.revokeObjectURL = jest.fn();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  test('renders initial capture choices (Rear Camera and Choose Image File)', async () => {
    await act(async () => {
      root.render(
        <InventoryPhotoCapture
          listingId="507f1f77bcf86cd799439011"
          listingTitle="Fresh Corn"
          onCancel={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('Farm Inventory Photo Capture');
    expect(container.textContent).toContain('Fresh Corn');
    expect(container.textContent).toContain('Start Rear Camera');
    expect(container.textContent).toContain('Choose Image File');
  });

  test('handles file input selection and shows review preview with confirm button', async () => {
    await act(async () => {
      root.render(
        <InventoryPhotoCapture
          listingId="507f1f77bcf86cd799439011"
          listingTitle="Fresh Corn"
        />
      );
    });

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const mockFile = new File(['mock_image_binary_data'], 'test_harvest.jpg', {
      type: 'image/jpeg',
    });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Uploaded File');
    expect(container.textContent).toContain('Confirm & Upload Photo');
    expect(container.textContent).toContain('Retake');
    expect(container.textContent).toContain('Attach Device GPS (Optional)');
  });

  test('retake button resets to initial capture options', async () => {
    await act(async () => {
      root.render(
        <InventoryPhotoCapture
          listingId="507f1f77bcf86cd799439011"
        />
      );
    });

    const fileInput = container.querySelector('input[type="file"]');
    const mockFile = new File(['mock'], 'photo.jpg', { type: 'image/jpeg' });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [mockFile] });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Confirm & Upload Photo');

    const retakeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Retake')
    );
    expect(retakeBtn).toBeTruthy();

    await act(async () => {
      retakeBtn.click();
    });

    expect(container.textContent).toContain('Start Rear Camera');
    expect(container.textContent).toContain('Choose Image File');
  });
});
