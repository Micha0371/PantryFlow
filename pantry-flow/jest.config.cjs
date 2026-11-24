const path = require('node:path');

// <rootDir> is not used for paths here: on Windows, Jest keeps the backslash before a dot when it
// expands it, so the patterns break when the checkout lies below a dot folder (.verification).
const below = folder => path.join(__dirname, folder, path.sep).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/components/**/*.test.tsx'],
  // The preset turns this on, which makes an empty run pass.
  passWithNoTests: false,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  modulePathIgnorePatterns: [below('.verification'), below('dist')],
  // A cold transform cache on a fresh checkout took 10-12 s for the first
  // component test against the 5 s default (observed 2026-11-12).
  testTimeout: 30000,
  clearMocks: true,
};
