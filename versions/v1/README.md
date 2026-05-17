# Version 1

## Overview

Version 1 is the first generated version of the meme generator app.

The goal of this version is to prove the basic meme creation flow:

1. Open the app
2. Upload an image
3. Click on the image to add text
4. Move text around the image
5. Resize the text box
6. Style the text
7. Download the final meme

---

## Planned Features for V1

- Upload image support
- Click-to-add text
- Drag-and-drop text movement
- Resizable text box
- Font selection
- Border toggle
- Download final meme

---

## Current Status

Version 1 creates a working starting point for the app, but some features still need improvement.

---

## What Works

- Text can be added to the image.
- Text can be moved using drag-and-drop.
- Text box corners support resizing.
- Default font is Impact with white text and black border.
- Font dropdown includes Arial, Comic Sans, Helvetica, and Montserrat.
- Border toggle is available.
- Download works on Mac.

---

## Known Issues

- Font size does not automatically resize based on text box size.
- Downloaded meme does not visually match the webpage preview exactly.
- Drag-and-drop image upload is not supported yet.
- Image sizing needs better limits.
- UI/design needs improvement.

---

## Next Version Goals

- Fix automatic font resizing.
- Improve downloaded image accuracy.
- Add drag-and-drop upload support.
- Improve responsive layout.
- Begin adding meme templates.

---

## Related Files

- `index.html` — main app page
- `css/styles.css` — app styling
- `js/app.js` — main app logic
- `js/DragResize.js` — drag and resize logic
- `js/Exporter.js` — download/export logic
- `js/ImageLoader.js` — image upload logic
- `js/TextBox.js` — individual text box logic
- `js/TextBoxManager.js` — manages text boxes
