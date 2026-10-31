import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InventoryPhotoTimeline from './InventoryPhotoTimeline';

describe('InventoryPhotoTimeline Component', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test('renders clear empty state when no photos exist', async () => {
    await act(async () => {
      root.render(
        <InventoryPhotoTimeline
          photos={[]}
          listingTitle="Wheat Grain Lot"
          canUpload={true}
          onOpenUpload={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('Inventory Photo Timeline');
    expect(container.textContent).toContain('No Inventory Photos Available');
    expect(container.textContent).toContain('Take or Upload First Photo');
  });

  test('renders active photo with freshness badge and authoritative server time', async () => {
    const mockPhotos = [
      {
        id: 'photo-1',
        imageUrl: 'https://storage.smartagri.org/clean1.webp',
        watermarkedUrl: 'https://storage.smartagri.org/wm1.webp',
        serverReceivedAt: new Date().toISOString(),
        captureMethod: 'live_camera',
        conditionNotes: 'Stored in moisture-controlled silo',
        isPrimary: true,
      },
    ];

    await act(async () => {
      root.render(
        <InventoryPhotoTimeline
          photos={mockPhotos}
          listingTitle="Wheat Grain Lot"
        />
      );
    });

    expect(container.textContent).toContain('Fresh');
    expect(container.textContent).toContain('Live Camera');
    expect(container.textContent).toContain('Authoritative Server Receipt');
    expect(container.textContent).toContain('Stored in moisture-controlled silo');
    expect(container.textContent).toContain('Freshness Verification Policy');
  });

  test('toggles watermark derivative button', async () => {
    const mockPhotos = [
      {
        id: 'photo-1',
        imageUrl: 'https://storage.smartagri.org/clean1.webp',
        watermarkedUrl: 'https://storage.smartagri.org/wm1.webp',
        serverReceivedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        captureMethod: 'file_upload',
        isPrimary: false,
      },
    ];

    await act(async () => {
      root.render(
        <InventoryPhotoTimeline
          photos={mockPhotos}
          listingTitle="Wheat Grain Lot"
        />
      );
    });

    expect(container.textContent).toContain('Recent');
    expect(container.textContent).toContain('File Upload');
    expect(container.textContent).toContain('Watermark:');
    const img = container.querySelector('img');
    expect(img.src).toBe('https://storage.smartagri.org/wm1.webp');

    // Click toggle button
    const toggleButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ON')
    );
    expect(toggleButton).toBeTruthy();

    await act(async () => {
      toggleButton.click();
    });

    expect(img.src).toBe('https://storage.smartagri.org/clean1.webp');
  });
});
