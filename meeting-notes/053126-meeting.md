# Meeting 7 - 05/21/26

## Team 18 - Pandalorian
Notetaker: Olivia Sun

## Members

- [x] Aaron Delgado
- [x] Aila Jahromi
- [X] Olivia Sun
- [x] Ajay Anbolu
- [] Anvay Patil
- [x] Ayat Alwazir
- [x] Brendan Nguyen
- [x] Daniel John
- [x] Howard Guan
- [x] Solaiman Alwazir
- [x] Tim Nguyen

## Meeting Place & Time
We had a meeting on Google Meet from 4:00 - 5:00pm

## Agenda
- [Meeting 7 - 05/21/26](#meeting-7---052126)
  - [Team 18 - Pandalorian](#team-18---pandalorian)
  - [Members](#members)
  - [Meeting Place \& Time](#meeting-place--time)
  - [Agenda](#agenda)
- [Progress From Last Week](#progress-from-last-week)
- [Priorities This Week](#priorities-this-week)
      - [UI improvements:](#ui-improvements)
      - [Library improvements:](#library-improvements)
- [Notes](#notes)
- [Plan Going Forward (After 6/2 Midterm)](#plan-going-forward-after-62-midterm)

---

# Progress From Last Week

- Mobile UI rough draft (Aaron)
- Desktop UI rough draft (Howard)
- Textbox drag-and-drop, auto-minimize for text visibility, fixed bug that was causing text to jump in size when re-sizing (code by Ayat, reviewed by Solaiman)
- AI suggestion feature (Ajay)
- Text detection feature (Tim + Anvay)
- Meme library tagging (Brendan + Daniel)
- Manual testing template and documentation from v3 manual testing (Aila)
- JSDoc comments + automated linting (Olivia)

---
# Priorities This Week
#### UI improvements:
Mobile:
- Make the upload + button bigger (2x the size)
- Remove the templates on the editing mode (Duplicate feature with browse meme currently)
- Add the AI suggestion feature to the panda emoji on the bottom left (after clicking, should pop up a panel to get user input)
- Home page should be meme library page
- Make sure aspect ratio of original image is retained
  
Desktop:
- Center the meme under the upload and download button
- Remove 'meme' from 'download meme' button
- Set a max drag out for the meme library to take up half the horizontal width of screen
- Add a copy feature (use a sizeable emoji on the top-right corner of the image or create a button on top of the image)
- Remove textbox border when not editing (but keep it for selecting)
- Add the AI suggestion feature to the left of the image

Mobile + Desktop:
- Make the 'enter text...' inside color white instead of grey and make it all caps
- in settings, add light and dark mode (current version can be dark and the lighter mode can be a more pastel green)
- Hide the name of the meme for UI (users do not want / need to know)
- Remove textbox border when not editing (should only be visible when actively editing or selected)
- Remove toggle bar but allow users to change font and delete with a button on top-left of image

#### Library improvements:
Meme libary:
- Workflow for AI tagging during monthly refreshes (current: manual tagging)
- Increase internal library (everyone can add memes to assets folder)

# Notes

- Looking into issue with textbox starting at border and going off the image (Ayat)

---

# Plan Going Forward (After 6/2 Midterm)

- Aaron, Tim, and Howard on UI improvements
- Brendan and Daniel on Library improvements
- Ajay and Anvay on full E2E testing framework and implement paths-ignore (to avoid tests when docs change)
- Solaiman and Ayat on finalizing textbox changes
- Olivia and Aila review PRs and merge, documenting user feedback and key changes we should think about
- User testing: everyone gets feedback from 3 friends