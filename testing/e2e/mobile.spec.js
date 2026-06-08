const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// Mobile E2E. The unique value here over the jsdom unit tests is that a REAL
// browser evaluates the @media (max-width: 768px) CSS, so we can assert the
// mobile-only layout: toolbar hidden, floating X-delete shown, browse overlay.

const templateImagePath = path.join(
  __dirname,
  '../../assets/templates/lebron-meme-templates/lebron-funny.jpg'
);

const templateImageBuffer = fs.readFileSync(templateImagePath);

async function silenceExternalFonts(page) {
  await page.route('https://fonts.googleapis.com/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: ''
    });
  });

  await page.route('https://fonts.gstatic.com/**', route => {
    route.abort();
  });
}

async function mockMemeTemplateList(page) {
  await page.route('https://api.imgflip.com/get_memes', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          memes: [
            {
              id: '181913649',
              name: 'Drake Hotline Bling',
              url: 'https://i.imgflip.com/drake-test.jpg',
              width: 1200,
              height: 1200
            }
          ]
        }
      })
    });
  });
}

async function mockMemeTemplateImage(page) {
  await page.route('https://i.imgflip.com/*-test.jpg', route => {
    route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: templateImageBuffer
    });
  });
}

// This spec only makes sense on a touch/mobile viewport.
// The playwright.config "mobile-chromium" project emulates an iPhone 13;
// on the desktop project the mobile-only CSS never applies.
test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only spec; runs under the mobile-chromium project');
  await silenceExternalFonts(page);
  await mockMemeTemplateList(page);
  await mockMemeTemplateImage(page);
});

test('boots into the browse overlay, loads a meme, and shows the mobile editor layout', async ({ page }) => {
  await page.goto('/');

  // 1. On mobile the app boots into the Browse Memes overlay.
  await expect(page.locator('body')).toHaveClass(/browse-open/);
  await expect(page.locator('#mobile-home-back-btn')).toBeHidden();

  // 2. Pick a mocked search result → editor view.
  await page.locator('#meme-search-input').fill('drake');

  await expect(page.locator('#meme-search-results .meme-search-card')).toHaveCount(1);

  await page.locator('#meme-search-results .meme-search-card[title="Drake Hotline Bling"]').click();

  await expect(page.locator('#canvas-container')).toHaveClass(/has-image/);
  await expect(page.locator('body')).not.toHaveClass(/browse-open/);
  await expect(page.locator('#share-btn')).toBeVisible();
  await expect(page.locator('#download-btn')).toBeHidden();
  await expect(page.locator('.bottom-actions')).toBeVisible();
});

test('selecting a text box applies the mobile layout (toolbar hidden, floating X-delete shown)', async ({ page }) => {
  await page.goto('/');

  // Get into the editor with a loaded image first.
  await page.locator('#meme-search-input').fill('drake');
  await page.locator('#meme-search-results .meme-search-card[title="Drake Hotline Bling"]').click();

  await expect(page.locator('#canvas-container')).toHaveClass(/has-image/);

  // Tap the canvas to create + select a text box.
  await page.locator('#meme-canvas').tap();

  const textBox = page.locator('.text-box');

  await expect(textBox).toHaveCount(1);
  await expect(textBox).toHaveClass(/selected/);

  // The redesigned mobile layout:
  // - the text toolbar is hidden,
  // - the floating red X delete button is visible,
  // - the Browse/Share row is hidden while a box is selected.
  await expect(textBox.locator('.text-box-toolbar')).toBeHidden();
  await expect(textBox.locator('.text-box-delete-btn')).toBeVisible();
  await expect(page.locator('.bottom-actions')).toBeHidden();
});

test('Browse Memes reopens the overlay and back returns to the editor', async ({ page }) => {
  await page.goto('/');

  // Load a meme so we land in the editor with an image.
  await page.locator('#meme-search-input').fill('drake');
  await page.locator('#meme-search-results .meme-search-card[title="Drake Hotline Bling"]').click();

  await expect(page.locator('#canvas-container')).toHaveClass(/has-image/);
  await expect(page.locator('body')).not.toHaveClass(/browse-open/);

  // Tap Browse Memes → overlay opens.
  await page.locator('#browse-memes-btn').click();

  await expect(page.locator('body')).toHaveClass(/browse-open/);
  await expect(page.locator('#mobile-home-back-btn')).toBeVisible();

  await page.locator('#mobile-home-back-btn').click();

  await expect(page.locator('body')).not.toHaveClass(/browse-open/);
});