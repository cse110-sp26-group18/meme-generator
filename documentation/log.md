<a id="top"></a>
# AI Use Log
This document tracks each version of the project, including prompts used, AI model used, observations, feedback, and next steps.

## Table of Contents

[Version 1](#version-1)

---
<a id="version-1"></a>
## Version 1

### Prompt Used
Create a website where a user can upload photo, click on the uploaded photo to add text, and the user can download the the edited image. 
* text that the user adds must be shiftable based on drag-and-drop and the text should be automatically resizable based of drag-and-drop of the corners of the text box
* the default text should be the Impact font with white text and black borders
* font can be modified with a toggle bar above the text box that has a dropdown menu of the following other fonts: Arial, Comic Sans, Helvetica, Montserrat
* allow users to choose between no border and border (the default option should be borders)
  
### AI Model Used 

Tim - I used Claude Opus 4.6 in high effort plan mode.

## Observations 
#### Goals Achieved
* Text added by the user is draggable and repositionable via drag-and-drop
* Text box corners support drag-and-drop resizing to automatically resize the text box
* Default font is Impact with white text and black borders
* A toggle bar above the text box includes a dropdown menu allowing font selection from: Arial, Comic Sans, Helvetica, and Montserrat
* Users can toggle between no border and border styles, with border enabled as the default
* Download works on Mac

#### Goals Not Achieved (Evaluate and re-implement)
* Font size does not automatically resize based on the text box size — font resizability was not achieved.
* Downloaded meme has a different text appearance than what is seen on the website (example below with downloaded meme on the left and the webpage version on the right)

![Downloaded_Meme_Visual](./screenshots/v1_downloadedmeme.png)
![Webpage_Meme_Visual](./screenshots/v1_memefromwebpage.png)

#### Next steps for v2
* Fix font automatic resizing relative to text-box size 
* Support drag-and-drop image files uploads
* Have the text-box be typable as soon as it is generated (right now, user clicks on image, text-box pops up, and user has to click inside the text-box to enable typing. This reduces performance, so text-box should be in type mode as soon as it is generated)
* Make default text all caps
* Make text box resize when inputted text is not all visible
* Fix the size of the image to be within a certain range as right now, some images can appear really big or really small 
* Generate a mini template library, where the user can filter/search based on key words
* Improve design/ui (save for future versions, but something to think about as we implement) 

