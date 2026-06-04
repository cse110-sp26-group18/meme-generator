const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './testing/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000
  },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node testing/e2e/serve-static.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: '4173',
      ROOT_DIR: 'meme-app'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
