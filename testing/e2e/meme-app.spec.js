const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const templateImagePath = path.join(__dirname, '../../assets/templates/lebron-meme-templates/lebron-funny.jpg');
const templateImageBuffer = fs.readFileSync(templateImagePath);

async function silenceExternalFonts(page) {
  await page.route('https://fonts.googleapis.com/**', route => {
    route.fulfill({ status: 200, contentType: 'text/css', body: '' });
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

test.beforeEach(async ({ page }) => {
  await silenceExternalFonts(page);
  await mockMemeTemplateList(page);
});

test('uploads an image, adds text, changes font, and downloads the meme', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Meme Generator');
  await expect(page.locator('#download-btn')).toBeDisabled();
  await expect(page.locator('#placeholder')).toBeVisible();

  await uploadTemplate(page);

  await expect(page.locator('#placeholder')).toBeHidden();
  await expect(page.locator('#hint')).toBeVisible();
  await expect(page.locator('#download-btn')).toBeEnabled();

  const canvas = page.locator('#meme-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const textBox = page.locator('.text-box');
  await expect(textBox).toHaveCount(1);

  const textarea = textBox.locator('.text-content');
  await textarea.fill('PLAYWRIGHT MEME');
  await expect(textarea).toHaveValue('PLAYWRIGHT MEME');

  await textBox.locator('.font-select').selectOption('Anton');
  await expect(textBox.locator('.font-select')).toHaveValue('Anton');

  const download = page.waitForEvent('download');
  await page.locator('#download-btn').click();
  expect((await download).suggestedFilename()).toBe('meme.png');
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
