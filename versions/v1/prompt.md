# Version 1 Prompt

This file documents the prompt used to generate Version 1 of the meme generator, the model that ran it, and the results.

---

## Model Used

Claude Opus 4.6, run in high effort plan mode.

Run by: Tim.

---

## Goal of This Version

Prove the core meme creation flow end-to-end:

1. Open the app
2. Upload an image
3. Click on the image to add text
4. Move the text around the image
5. Resize the text box
6. Style the text (font, border)
7. Download the finished meme

Full v1 scope, stretch goals, and out-of-scope items are documented in `documentation/goals/v1-goals.md`.

---

## Prompt

> Create a website where a user can upload photo, click on the uploaded photo to add text, and the user can download the the edited image.
>
> - Text that the user adds must be shiftable based on drag-and-drop and the text should be automatically resizable based of drag-and-drop of the corners of the text box
> - The default text should be the Impact font with white text and black borders
> - Font can be modified with a toggle bar above the text box that has a dropdown menu of the following other fonts: Arial, Comic Sans, Helvetica, Montserrat
> - Allow users to choose between no border and border (the default option should be borders)

---

## Constraints Provided

- Vanilla HTML, CSS, and JavaScript — no frameworks or build step.
- Default font: Impact, white fill, black stroke.
- Font dropdown options: Arial, Comic Sans, Helvetica, Montserrat.
- Border on by default, with a no-border toggle.
- Text boxes must be draggable and corner-resizable.

---

## What Was Generated

A working meme editor split across the following files:

- `index.html` — main app page
- `css/styles.css` — app styling
- `js/app.js` — main app logic
- `js/ImageLoader.js` — image upload handling
- `js/TextBox.js` — individual text box logic
- `js/TextBoxManager.js` — manages multiple text boxes on the canvas
- `js/DragResize.js` — drag-and-resize behavior for text boxes
- `js/Exporter.js` — meme download/export

---

## Results

### What Worked

- Text added by the user is draggable and repositionable via drag-and-drop.
- Text box corners support drag-and-drop resizing.
- Default font is Impact with white text and black borders.
- Toggle bar above the text box has a dropdown for Arial, Comic Sans, Helvetica, and Montserrat.
- Border / no-border toggle works, with border as the default.
- Download works on Mac.

### What Did Not Work

- Font size does not automatically resize based on text box size — this was part of the prompt but not delivered.
- Downloaded meme has a different text appearance than what is shown on the webpage. Compare:
  - `documentation/screenshots/v1_downloadedmeme.png` (downloaded)
  - `documentation/screenshots/v1_memefromwebpage.png` (webpage)

### Next Steps for the Next Version

- Fix automatic font resizing.
- Support drag-and-drop image upload.
- Make default text render in all caps.
- Resize the text box when inputted text overflows.
- Constrain image size to a sensible range.
- Generate a mini template library.
- Improve overall UI / design.
- Begin implementing additional planned features.

---

## Testing Notes

The testing team should verify the items above against the live app. The full v1 testing checklist lives in the project [README.md](../../README.md) under "Testing Goals." Key areas to confirm:

- Upload, add text, move text, resize, font selection, border toggle, download.
- Whether the downloaded meme matches the webpage preview (this is a known v1 gap).
- Layout behavior on desktop, tablet, and phone widths.

---

## Related Files

- `versions/v1/README.md` — v1 overview, status, and known issues
- `documentation/log.md` — full AI use log including this prompt and observations
- `documentation/goals/v1-goals.md` — v1 scope, required features, stretch goals
- `documentation/screenshots/` — before/after screenshots referenced above
