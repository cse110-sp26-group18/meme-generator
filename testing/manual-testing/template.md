```md
# Meme Generator - Manual Testing Checklist

**Developer:** __________  
**Date Tested:** __________  
**Version:** __________  
**Environment:** __________ 
## 1. App Startup

- [ ] App loads successfully
- [ ] Upload area is visible
- [ ] Meme templates load from ImgFlip API 
- [ ] In case of API failure, internal library shows (leave blank if N/A)
- [ ] No obvious UI issues or console errors

**Comments**
> 

---

## 2. Template & Image Selection

### Template Selection
- [ ] User can select a template 
- [ ] Selected template opens in editor

### Image Upload
- [ ] Drag-and-drop upload works
- [ ] File picker upload works
- [ ] Uploaded image opens in editor

**Comments**
> 

---

## 3. Meme Editing

### Text Creation
- [ ] Clicking image creates a text box
- [ ] Multiple text boxes can be added

### Text Editing
- [ ] User can type/edit text
- [ ] Text box auto-expands for long text
- [ ] Text remains visible at all times

### Styling
- [ ] Font can be changed
- [ ] +/- buttons change font size
- [ ] Text box can be resized by dragging
- [ ] Text border can be enabled

### Text Removal
- [ ] X button deletes text box
- [ ] Empty text box is removed when clicking away

**Comments**
> 

---

## 4. Navigation

- [ ] User can return to template selection
- [ ] User can upload a different image without issues

**Comments**
> 

---

## 5. Template Search

- [ ] Search returns relevant templates
- [ ] Search works with meme keywords/emotions
- [ ] Clearing search restores results

**Comments**
> 

---

## 6. AI Text Removal

- [ ] AI detects existing text on uploaded images
- [ ] AI removes detected text successfully
- [ ] Resulting image remains usable and clean 
- [ ] Failure/error states are handled gracefully

**Comments**
> 

---

## 7. Share/Download

- [ ] Clicking the Share button pops up the device's native share sheet
- [ ] Downloaded/share image opens correctly
- [ ] Text, borders, and formatting appear correctly
- [ ] Downloaded image matches editor preview

**Comments**
> 

---

## Final Assessment

### Status
- [ ] Pass
- [ ] Pass with Minor Issues
- [ ] Fail

### Bugs Found
| Severity | Description |
|-----------|-------------|
|           |             |
|           |             |

### Suggestions / Feedback
>
```
