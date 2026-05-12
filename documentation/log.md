<a id="top"></a>
# AI Use Log

## Table of Contents

[Prompt 1](#prompt-1)

---
<a id="prompt-1"></a>
## Prompt 1

### Prompt Used
> Create a website where a user can upload photo, click on the uploaded photo to add text, and the user can download the the edited image. 
* text that the user adds must be shiftable based on drag-and-drop and the text should be automatically resizable based of drag-and-drop of the corners of the text box
* the default text should be the Impact font with white text and black borders
* font can be modified with a toggle bar above the text box that has a dropdown menu of the following other fonts: Arial, Comic Sans, Helvetica, Montserrat
* allow users to choose between no border and border (the default option should be borders)
  
### Observations 

Tim - I used Claude Opus 4.6 in high effort plan mode.

#### Goals Achieved
* Text added by the user is draggable and repositionable via drag-and-drop
* Text box corners support drag-and-drop resizing to automatically resize the text box
* Default font is Impact with white text and black borders
* A toggle bar above the text box includes a dropdown menu allowing font selection from: Arial, Comic Sans, Helvetica, and Montserrat
* Users can toggle between no border and border styles, with border enabled as the default

#### Goals Not Achieved (Evaluate and re-implement)
* Font size does not automatically resize based on the text box size — font resizability was not achieved

#### Next Steps
* Fix font automatic resizing
* Improve design/ui
* Begin implementing features

