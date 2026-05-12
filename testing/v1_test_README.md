# Meme Generator v1 — Test Suite

**Framework:** Jest 29 + jsdom + jest-canvas-mock

## 1. What Each Test File Covers

| File | v1 Goal It Validates | Corresponding Modules in v1 |
|------|---------------------|----------------------|
| `v1_test_upload.test.js` | "Upload photo functionality" | `ImageLoader.js` |
| `v1_test_text_editing.test.js` | "Click image to add/edit movable text" | `TextBox.js`, `TextBoxManager.js`, `DragResize.js` |
| `v1_test_customization.test.js` | "Basic text customization" (fonts, border, resize) | `TextBox.js`, `DragResize.js` |
| `v1_test_download.test.js` | "Download generated meme" | `Exporter.js` |
| `v1_test_responsive.test.js` | "Mobile-friendly and responsive design" (structural only) | `index.html` DOM structure |

### Detailed breakdown of each test file

**`v1_upload.test.js`** — image upload and scaling
- PNG / JPG / WEBP formats all load correctly
- Images wider than 800 px are scaled down proportionally; smaller images are untouched
- Re-uploading a second image replaces the first without crashing
- Edge cases: empty file, null callback

**`v1_text_editing.test.js`** — click-to-add, drag, delete
- Clicking the canvas creates a text box at the click position (only after an image is loaded)
- Dragging moves the box and is clamped within the container boundary
- Delete button removes the box from the DOM

**`v1_customization.test.js`** — font, border, resize
- Font dropdown switches font family and updates state
- Border toggle switches on/off and reflects in CSS class and state
- All four corner handles resize the box; minimum size (80×40 px) is enforced
- Emoji, CJK, and long strings are stored as plain text without errors

**`v1_download.test.js`** — export to PNG
- `exportMeme()` produces a PNG blob and triggers a `meme.png` download
- Empty / whitespace text boxes are skipped; non-empty ones are all rendered
- Text wraps on long lines; `\n` splits into separate lines

**`v1_responsive.test.js`** — HTML structure across viewports
- Viewport meta tag exists; key elements (upload / canvas / download) are present at 375 / 768 / 1280 px
- Note: CSS layout cannot be verified in jsdom — manual testing in DevTools is required

`setup.js` mocks browser APIs unavailable in Node.js (`URL.createObjectURL`, `<a>.click()`) and loads all v1 modules into the global scope before each test file runs.
`jest.config,js` and `package.json` provide package for testing

## 2. Prerequisites — 

### 2a. Ensure v1 files are present

The tests reference `versions/v1/js/*.js`. These files live on Tim's branch.
If they aren't on your local `main` yet, check out the branch first:

```bash
git fetch origin
git checkout first-iteration-tim
```

### 2b. Install Node.js

Download from https://nodejs.org (LTS version recommended).  
Verify installation:

```bash
node --version   # should print v18 or later
npm --version
```

## 3. Install Dependencies — 

Run this **once** from the **project root** (where `package.json` lives):

```bash
npm install
```

## 4. Run All Tests — 
```bash
npm test
```

## 5. Run a Specific Test File — 

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
```

Or pass the filename directly:

```bash
npx jest testing/v1_test_upload.test.js
```

## 6. Result Interpretation — 

### Coverage Gaps — v1 features not yet implemented

The following items are listed in the project goals but were **not shipped in v1**. Tests for them are written as `it.todo(...)` so they appear as pending reminders without failing CI.

| Gap | Status | Notes |
|-----|--------|-------|
| Text color picker | Not implemented | v1 hardcodes white fill + black stroke; no color UI |
| Font size auto-resize | Not achieved | Documented in `documentation/log.md` under "Goals Not Achieved" |
| Mobile layout (media queries) | Partial | CSS has no breakpoints; `min-width: 400px` on canvas container overflows on narrow phones |
| Non-image file rejection (JS) | Not implemented | Only the `accept="image/*"` HTML attribute is present; no JS validation |

