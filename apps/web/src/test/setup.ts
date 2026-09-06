import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no localStorage quirks to worry about here, but tests that seed
// a session should start from a clean slate.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
