<a id="top"></a>
# AI Use Log
This document tracks each version of the project, including prompts used, AI model used, observations, feedback, and next steps.

## Table of Contents

[Version 0.1.0](#version-0.1.0) (5/11/26)

---
<a id="version-0.1.0"></a>
## Version 0.1.0

### Prompt Used

 
### AI Model Used 
Claude Opus 4.6 in high effort plan mode (Tim)

## Observations 
#### What Worked
* Text added by the user is draggable and repositionable via drag-and-drop
* Text box corners support drag-and-drop resizing to automatically resize the text box
* Default font is Impact with white text and black borders
* A toggle bar above the text box includes a dropdown menu allowing font selection from: Arial, Comic Sans, Helvetica, and Montserrat
* Users can toggle between no border and border styles, with border enabled as the default
* Download works on Mac

#### What Did Not Work
* Font size does not automatically resize based on the text box size — font resizability was not achieved.
* Downloaded meme has a different text appearance than web preview

#### Next steps for 0.2.0
* Fix font automatic resizing relative to text-box size 
* Support drag-and-drop image files uploads
* Have the text-box be typable as soon as it is generated (right now, user clicks on image, text-box pops up, and user has to click inside the text-box to enable typing. This reduces performance, so text-box should be in type mode as soon as it is generated)
* Default text is not in all caps, which is the standard meme convention.
* Make text box resize when inputted text is not all visible to the user.
* Uploaded images have no size limits, so very large or very small images can break the layout.
* Generate a mini template library (5-10 templates), where the user can filter/search based on key words
* Improve design/ui (save for future versions, but something to think about as we implement) 

[Version 0.1.0](#version-0.1.0) (5/11/26)

---
<a id="version-0.2.0"></a>
## Version 0.2.0

### Prompt Used

Constraints given by CLAUDE.md file

### AI Model Used 


## Observations 
#### What Worked
* 

#### What Did Not Work
* 

#### Next steps for 0.3.0
