import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Marketplace from './Marketplace';

test('renders Marketplace without crashing and displays Farm Marketplace title', async () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  await act(async () => {
    root.render(
      <Marketplace
        onBackToLanding={() => {}}
        onLoginRequired={() => {}}
        isLoggedIn={false}
        userRole={null}
      />
    );
  });
  expect(div.textContent).toContain('Farm Marketplace');
  expect(div.textContent).toContain('No Marketplace Listings Published Yet');
  expect(div.textContent).toContain('All Produce');
  await act(async () => {
    root.unmount();
  });
});
