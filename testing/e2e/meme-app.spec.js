const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

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
            },
            {
              id: '112126428',
              name: 'Distracted Boyfriend',
              url: 'https://i.imgflip.com/distracted-test.jpg',
              width: 1200,
              height: 800
            }
          ]
        }
      })
    });
  });
}

async function uploadTemplate(page) {
  await page.locator('#image-input').setInputFiles(templateImagePath);
  await expect(page.locator('#canvas-container')).toHaveClass(/has-image/);
}

// These flows exercise desktop-only UI. The old per-box toolbar is now hidden,
// so this spec verifies upload, text creation/editing, and download without
// interacting with hidden toolbar controls.
test.beforeEach(async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop-only spec; mobile flows live in mobile.spec.js');
  await silenceExternalFonts(page);
  await mockMemeTemplateList(page);
});

test('uploads an image, adds text, and downloads the meme', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Meme Generator');
  await expect(page.locator('#download-btn')).toBeDisabled();
  await expect(page.locator('#placeholder')).toBeVisible();

  await uploadTemplate(page);

  await expect(page.locator('#placeholder')).toBeHidden();
  await expect(page.locator('#hint')).toBeVisible();
  await expect(page.locator('#download-btn')).toBeEnabled();

  await page.locator('#meme-canvas').click();

  const textBox = page.locator('.text-box');
  await expect(textBox).toHaveCount(1);

  const textarea = textBox.locator('.text-content');
  await textarea.fill('PLAYWRIGHT MEME');
  await expect(textarea).toHaveValue('PLAYWRIGHT MEME');

  await expect(textBox.locator('.text-box-toolbar')).toBeHidden();
  await expect(textBox.locator('.text-box-delete-btn')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.locator('#download-btn').click();

  expect((await download).suggestedFilename()).toBe('meme.png');
});

// KNOWN BUG / old toolbar behavior:
// The toolbar is now hidden in the redesigned textbox UI, so this guard remains
// fixme until font changing is exposed through a visible replacement control.
test.fixme('changing font keeps the text fitting inside the box (review finding #1)', async ({ page }) => {
  await page.goto('/');

  await uploadTemplate(page);

  await page.locator('#meme-canvas').click();

  const textarea = page.locator('.text-box .text-content');
  await textarea.fill('WIDE TEXT THAT IS QUITE LONG INDEED');

  await page.locator('.text-box .font-select').selectOption('Arial');

  const fits = await textarea.evaluate(
    el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight
  );

  expect(fits).toBe(true);
});

test('searches mocked meme templates and loads a selected result onto the canvas', async ({ page }) => {
  await page.route('https://i.imgflip.com/*-test.jpg', route => {
    route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: templateImageBuffer
    });
  });

  await page.goto('/');

  await expect(page.locator('#meme-search-status')).toHaveText('');

  await page.locator('#meme-search-input').fill('drake');

  await expect(page.locator('#meme-search-results .meme-search-card')).toHaveCount(1);

  await page.locator('#meme-search-results .meme-search-card[title="Drake Hotline Bling"]').click();

  await expect(page.locator('#canvas-container')).toHaveClass(/has-image/);
  await expect(page.locator('#download-btn')).toBeEnabled();
  await expect(page.locator('#meme-search-status')).toHaveText('');
});