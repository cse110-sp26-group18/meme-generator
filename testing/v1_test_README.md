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

And setup.json is used to simulate API in Browser but unprovided in node.js

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

## 6. Known Limitations — 

### Responsive / layout testing

jsdom runs tests in a headless Node environment and **does not execute CSS**. This means:

- Media queries are never evaluated.
- `offsetWidth`, `offsetHeight`, `getBoundingClientRect()` all return `0` by default — tests mock these where necessary.
- Visual layout at different viewport widths cannot be verified automatically.

**What to do:** After the unit tests pass, open `versions/v1/index.html` in Chrome DevTools and use the device toolbar to manually test at 375 px (iPhone SE), 768 px (iPad), and 1280 px (desktop).

### Coverage Gaps — v1 features not yet implemented

The following items are listed in the project goals but were **not shipped in v1**. Tests for them are written as `it.todo(...)` so they appear as pending reminders without failing CI.

| Gap | Status | Notes |
|-----|--------|-------|
| Text color picker | Not implemented | v1 hardcodes white fill + black stroke; no color UI |
| Font size auto-resize | Not achieved | Documented in `documentation/log.md` under "Goals Not Achieved" |
| Mobile layout (media queries) | Partial | CSS has no breakpoints; `min-width: 400px` on canvas container overflows on narrow phones |
| Non-image file rejection (JS) | Not implemented | Only the `accept="image/*"` HTML attribute is present; no JS validation |

