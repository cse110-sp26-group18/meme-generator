module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: [
    'jest-canvas-mock',
    '<rootDir>/testing/setup.js'
  ],
  testMatch: ['<rootDir>/testing/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['versions/v1/js/**/*.js'],
};
