# Meme Generator — Test Suite

**Frameworks:** Jest 29 + jsdom + jest-canvas-mock, plus Playwright for browser E2E tests

## 1. What Each Test File Covers

| File | Goal It Validates | Corresponding Modules |
|------|---------------------|----------------------|
| `upload.test.js` | "Upload photo functionality" | `ImageLoader.js` |
| `text_editing.test.js` | "Click image to add/edit movable text" | `TextBox.js`, `TextBoxManager.js`, `DragResize.js` |
| `customization.test.js` | "Basic text customization" (fonts, border, resize) | `TextBox.js`, `DragResize.js` |
| `download.test.js` | "Download generated meme" | `Exporter.js` |
| `responsive.test.js` | "Mobile-friendly and responsive design" (structural only) | `index.html` DOM structure |
| `drag_drop.test.js` | Drag-and-drop image upload onto the canvas region | `app.js` |
| `click_upload.test.js` | Click the empty canvas region to open the file picker | `app.js` |
| `meme_search.test.js` | Search and load meme templates from an external library | `MemeSearch.js` |
| `e2e/meme-app.spec.js` | Browser-level upload, text editing, download, and meme-template search flows | Full `meme-app/` UI |

### Detailed breakdown of each test file

**`upload.test.js`** — image upload and scaling
- PNG / JPG / WEBP formats all load correctly
- Images wider than 800 px are scaled down proportionally; smaller images are untouched
- Re-uploading a second image replaces the first without crashing
- Edge cases: empty file, null callback

**`text_editing.test.js`** — click-to-add, drag, delete
- Clicking the canvas creates a text box at the click position (only after an image is loaded)
- Dragging moves the box and is clamped within the container boundary
- Delete button removes the box from the DOM

**`customization.test.js`** — font, border, resize
- Font dropdown switches font family and updates state
- Border toggle switches on/off and reflects in CSS class and state
- All four corner handles resize the box; minimum size (80×40 px) is enforced
- Emoji, CJK, and long strings are stored as plain text without errors

**`download.test.js`** — export to PNG
- `exportMeme()` produces a PNG blob and triggers a `meme.png` download
- Empty / whitespace text boxes are skipped; non-empty ones are all rendered
- Text wraps on long lines; `\n` splits into separate lines

**`responsive.test.js`** — HTML structure across viewports
- Viewport meta tag exists; key elements (upload / canvas / download) are present at 375 / 768 / 1280 px
- Note: CSS layout cannot be verified in jsdom — manual testing in DevTools is required

`setup.js` mocks browser APIs unavailable in Node.js (`URL.createObjectURL`, `<a>.click()`) and loads all MemeGen modules into the global scope before each test file runs.
`jest.config.js` and `package.json` provide test configuration.

## 2. Prerequisites

### Install Node.js

Download from https://nodejs.org (LTS version recommended).
Verify installation:

```bash
node --version   # should print v18 or later
npm --version
```

## 3. Install Dependencies

Run this **once** from the **project root** (where `package.json` lives):

```bash
npm install
```

## 4. Run All Tests

```bash
npm test
```

## 5. Run a Specific Test File

```bash
# Upload tests only
npm run test:upload

# Text editing tests only
npm run test:text

# Customization tests only
npm run test:custom

# Download tests only
npm run test:download

# Responsive / layout tests only
npm run test:responsive

# Meme-search tests only
npm run test:search
```

Or pass the filename directly:

```bash
npx jest testing/upload.test.js
```

## 6. Run End-to-End Tests

Install Playwright's Chromium browser once per machine:

```bash
npx playwright install chromium
```

Playwright serves `meme-app/` locally and opens it in Chromium:

```bash
npm run test:e2e
```

For interactive debugging:

```bash
npm run test:e2e:ui
```

The E2E suite mocks external font and Imgflip requests so it can run without relying on third-party network availability.

## 7. Result Interpretation

### Coverage Gaps — features not yet implemented

The following items are listed in the project goals but are **not yet shipped**. Tests for them are written as `it.todo(...)` so they appear as pending reminders without failing CI.

| Gap | Status | Notes |
|-----|--------|-------|
| Text color picker | Not implemented | Text is hardcoded white fill + black stroke; no color UI |
| Mobile layout (media queries) | Partial | CSS has limited breakpoints; some layouts overflow on narrow phones |
| Non-image file rejection (JS) | Not implemented | Only the `accept="image/*"` HTML attribute is present; no JS validation |
