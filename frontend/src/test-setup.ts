import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { forgetLists } from './listCache';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetLists();  // each test starts with no remembered Wishlist/Collection
});
