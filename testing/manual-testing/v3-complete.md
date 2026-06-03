# Meme Generator - Manual Testing Checklist

**Developer:** Aila Jahromi  
**Date Tested:** 5/30/2026  
**Version:** Completed Version 3  
**Environment:** Chrome, Desktop 
## 1. App Startup

- [X] App loads successfully
- [X] Upload area is visible
- [X] Meme templates load from ImgFlip API 
- [ ] In case of API failure, internal library shows (leave blank if N/A)
- [X] No obvious UI issues or console errors

**Comments**
> There is no implementation of internal library fallback workflow

---

## 2. Template & Image Selection

### Template Selection
- [X] User can select a template 
- [X] Selected template opens in editor

### Image Upload
- [X] Drag-and-drop upload works
- [X] File picker upload works
- [X] Uploaded image opens in editor

**Comments**
> HEIC images do not upload, and no error is shown

---

## 3. Meme Editing

### Text Creation
- [X] Clicking image creates a text box
- [X] Multiple text boxes can be added

### Text Editing
- [X] User can type/edit text
- [X] Text box auto-expands for long text
- [ ] Text remains visible at all times

### Styling
- [X] Font can be changed
- [X] +/- buttons change font size
- [X] Text box can be resized by dragging
- [X] Text border can be enabled

### Text Removal
- [X] X button deletes text box
- [ ] Empty text box is removed when clicking away

**Comments**
> If the font size is large, resizing the text-box makes parts of the text invisible
> An empty text box should disappear upon clicking outside of it 
---

## 4. Navigation

- [X] User can return to template selection
- [X] User can upload a different image without issues

**Comments**
> 

---

## 5. Template Search

- [X] Search returns relevant templates
- [ ] Search works with meme keywords/emotions
- [X] Clearing search restores results

**Comments**
> Search only works for meme titles and not emotions or descriptions

---

## 6. AI Text Removal

- [ ] AI detects existing text on uploaded images
- [ ] AI removes detected text successfully
- [ ] Resulting image remains usable and clean 
- [ ] Failure/error states are handled gracefully

**Comments**
> not implemented in this version 

---

## 7. Share/Download

- [ ] Clicking the Share button pops up the device's native share sheet
- [X] Downloaded/share image opens correctly
- [X] Text, borders, and formatting appear correctly
- [X] Downloaded image matches editor preview

**Comments**
> There is no share button at the moment, only download 
> The downloaded picture is worse quality than preview 

---

## Final Assessment

### Status
- [ ] Pass
- [X] Pass with Minor Issues
- [ ] Fail

### Bugs Found
| Severity | Description |
|-----------|-------------|
| unsupported image files        |       there is no pop-up to tell the user why their image did not upload if they use unsupported file types     |
|    text box       |   resizing the text-box makes parts of the text invisible          |
| empty text box | should be deleted upon clicking away, but right now it stays on | 
| meme search | only works for meme titles, not emotions or descriptions, or even slight misspellings |
| pic quality| downloaded pic quality is visibily worse than preview |

### Suggestions / Feedback
1. Implement a graceful error pop-up for when user picks an unsupported image file.   
2. Fix text-box resizing visibility, and deleting empty ones automatically   
3. Improve meme search functionality by tagging the images automatically   
4. Find how we can improve downloaded picture quality   

