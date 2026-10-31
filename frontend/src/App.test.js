import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Mock axios to avoid ESM transform issues under react-scripts jest
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: [] })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
}));

// Mock chart.js and recharts
jest.mock('react-chartjs-2', () => ({
  Line: () => null,
  Bar: () => null,
  Doughnut: () => null,
  Pie: () => null,
}));

import App from './App';

test('renders Farm Management System without crashing', async () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  await act(async () => {
    root.render(<App />);
  });
  expect(div.textContent).toContain('Farm Management System');
  expect(div.textContent).toContain('Farm Marketplace');
  await act(async () => {
    root.unmount();
  });
});
