# Meme Generator - Manual Testing Checklist

**Developer:** Aila Jahromi  
**Date Tested:** 6/3/2026  
**Version:** Completed Version 4
**Environment:** Chrome, Desktop and Mobile 
## 1. App Startup

- [X] App loads successfully
- [X] Upload area is visible
- [X] Meme templates load from ImgFlip API 
- [ ] In case of API failure, internal library shows (leave blank if N/A)
- [X] No obvious UI issues or console errors

**Comments**
> The internal library is implemented but workflow of fallback is not yet implemented

---

## 2. Template & Image Selection

### Template Selection
- [X] User can select a template 
- [X] Selected template opens in editor

### Image Upload
- [X] Drag-and-drop upload works
- [X] File picker upload works
- [X] Uploaded image opens in editor
- [ ] The templates on the right can be dragged but the upload area does not accept it

**Comments**
> Still no graceful degradation of unsupported image types

---

## 3. Meme Editing

### Text Creation
- [X] Clicking image creates a text box
- [X] Multiple text boxes can be added

### Text Editing
- [X] User can type/edit text
- [X] Text box auto-expands for long text
- [X] Text remains visible at all times

### Styling
- [X] Font can be changed
- [X] +/- buttons change font size
- [X] Text box can be resized by dragging
- [X] Text border can be enabled

### Text Removal
- [X] X button deletes text box
- [X] Empty text box is removed when clicking away

**Comments**
> On desktop: The "scan-text" button being overlayed with uploaded pictures whose dimensions are large --> messy UI
---

## 4. Navigation

- [X] User can return to template selection 
- [X] User can upload a different image without issues
- [ ] All buttons are functional and intuitive

**Comments**
> The settings button is not clickable and is dysfunctional 
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
> There is a 'scan-text' button that does nothing currently 


---

## 7. Share/Download

- [X] (mobile) Clicking the Share button pops up the device's native share sheet
- [X] Downloaded/share image opens correctly
- [X] Text, borders, and formatting appear correctly
- [X] Downloaded image matches editor preview
- [X] (desktop) Download button 
- [ ] copy to clipboard button

**Comments**
> No implementation of the copy to clipboard button 

---

## 8. AI Meme Generation

- [X] (only mobile) An AI generation button exists 
- [ ] Intuitive and easy to follow 
- [ ] Clear UI design after generation
- [X] Clear meme generation suggestions

**Comments** 
> The feature only exists on mobile and not desktop 
> The panda button needs a title so user knows its the AI generator 
> The process of getting the API key is fine but possibly slow 
> The fonts on the suggested memes blend in with the background 

--- 
## Final Assessment

### Status
- [ ] Pass
- [X] Pass with Minor Issues
- [ ] Fail

### Bugs Found
| Severity | Description |
|-----------|-------------|
| unsupported image files        |       implement graceful degregation of unsupported image types   |
| meme search | only works for meme titles, not emotions or descriptions, or even slight misspellings |
| text-detection button | button UI is always visible and not functional |
| AI suggested memes | implement the feature on desktop as well and work on a clear and intuitive UI/UX | 

### Suggestions / Feedback
1. Implement a graceful error pop-up for when user picks an unsupported image file.    
2. Improve meme search functionality by tagging the images automatically   
3. Implement the text-detection button and fix UI to only have it visible on uploaded pictures (or run automatically)  
4. Scale the implementation of the AI suggested memes 

