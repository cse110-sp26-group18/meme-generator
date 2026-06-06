<a id="top"></a>
# Version History and Documentation
This document tracks each version of the project, including overall AI use, observations, feedback, and next steps.

## Table of Contents

[Version 0.1.0](#version-0.1.0) (5/10/26).  
[Version 0.2.0](#version-0.2.0) (5/17/26).    
[Version 0.3.0](#version-0.3.0) (5/24/26).   
[Version 0.4.0](#version-0.4.0) (5/31/26).   
  
---
<a id="version-0.1.0"></a>
## Version 0.1.0

### AI Model Used 
Claude Opus 4.6 in high effort plan mode 

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


---
<a id="version-0.2.0"></a>
## Version 0.2.0

### Prompt Used

Constraints given by CLAUDE.md file

## Observations

### Version Summary

Version 0.2.0 focused on improving the core meme-editing workflow and expanding the project's usability beyond the initial prototype. Focus of this version was making the text editing process simple, fast, and intuitive for the users. It also explored the image uploads, and introducing the first meme template library. Besides the features of the app, the team spent time establishing a more structured development workflow, including weekly version releases, feature branches, GitHub issue tracking, and version documentation.

User feedback from the initial prototype, the user survey, and conversation with stakeholders heavily influenced feature prioritization, particularly around ease of use and mobile compatibility.

#### What Worked
* Drag-and-drop image uploading was successfully implemented.
* Text editing became significantly more flexible through additional font and formatting options.
* Image sizing issues present in Version 0.1.0 were improved.
* The first meme template library was introduced.
* GitHub issue tracking and branch-based development improved team coordination.
* Documentation and version tracking processes became more organized.

#### What Did Not Work
* Text box sizing and resizing behavior remained inconsistent.
* The user workflow for creating and deleting text boxes was not yet intuitive.
* Search and categorization features for templates were still incomplete.
* Mobile responsiveness was identified as an important need but was not fully addressed.
* AI-assisted editing features were still in the research and planning phase.

#### Next Steps for 0.3.0
* Improve text box sizing and editing interactions.
* Expand the meme template library and categorization system.
* Begin implementing AI-assisted meme features.
* Improve mobile responsiveness.
* Add stronger testing and documentation workflows.
* Improve overall user experience and interface consistency.

---
<a id="version-0.3.0"></a>
## Version 0.3.0

### Prompt Used

Constraints given by CLAUDE.md file

## Observations

### Version Summary

Version 0.3.0 focused on scalability, usability, and the first wave of AI-assisted functionality. The project expanded beyond basic meme editing by introducing template categorization, meme search capabilities, AI suggestion prototypes, and early text-recognition research. Significant effort was also spent improving the application's responsiveness across devices and organizing the growing template library.

This release represented a major feature expansion. The meme generator evolved from a simple editor into a webapp capable of supporting larger template collections, future AI integrations, and more advanced editing workflows. Internal documentation, workflow management, and testing practices also improved during this sprint.

#### What Worked
* Internal and external meme library systems were successfully implemented separately. 
* Search functionality for meme templates was introduced and inital efforts and direction for AI usage in this scope. 
* Text auto-sizing improvements reduced usability and UI issues.
* Mobile responsiveness work began and produced a functional mobile version.
* Early AI-assisted features such as caption suggestions and text recognition prototypes were developed, although they are not yet fully integrated or functional as we would hope them to be.
* Team workflow and GitHub processes continued to improve.

#### What Did Not Work
* Search functionality only supported meme titles and not emotions, tags, or descriptions.
* Empty text boxes are not automatically removed.
* Text visibility issues still occurrs during certain resize operations.
* Unsupported image file types fail silently without user feedback.
* Downloaded images appear lower quality than the editor preview.
* AI text recognition and removal functionality are still incomplete.

#### Next Steps for 0.4.0
* Improve search through automated tagging and categorization.
* Continue mobile UI improvements.
* Fix remaining text-box visibility and deletion issues.
* Improve image export quality.
* Expand AI-assisted editing features.
* Begin gathering larger-scale user feedback and testing data.

---
<a id="version-0.4.0"></a>
## Version 0.4.0

### Prompt Used

Constraints given by CLAUDE.md file

## Observations

### Version Summary

After talking with stake holders and users, the importance of a clean UI became the highest priority of this sprint.Version 0.4.0 focused on refining the user experience, improving cross-platform support, and integrating AI-driven functionality into the interface. The team invested heavily in UI brainstorming, and redesigning efforts for both desktop and mobile devices while continuing to improve text editing behavior, template organization, and AI-assisted meme generation workflows.

This release emphasized usability over feature quantity. Instead of introducing any more features, the team has decided to value quality of quantity and focus the reminaining time on making what we currently have fully functional.

#### What Worked
* Text visibility issues during editing are mainly resolved.
* Empty text boxes are now automatically removed when deselected.
* Mobile and desktop UI redesign efforts significantly improved usability.
* Native mobile sharing functionality is now implemented.
* AI meme suggestion functionality was introduced on mobile devices.
* Template tagging infrastructure continued to improve search scalability.

#### What Did Not Work
* Search still relies primarily on meme titles instead of emotions, descriptions, or fuzzy matching.
* Unsupported image formats still lack graceful error handling.
* The text-detection feature remains incomplete despite visible UI elements.
* Some UI controls, including the settings button, are not yet functional.
* Copy-to-clipboard functionality is not implemented.
* AI meme generation is only available on mobile and needs a clearer workflow.

#### Next Steps for Future Versions
* Fully implement AI text detection and text removal workflows.
* Expand AI meme generation to desktop devices in accordance to the design discussed with team and stakeholders.
* Add automated image tagging and smarter search for the meme library.
* Implement graceful handling of unsupported file types.
* Complete remaining UI features such as settings and copy-to-clipboard support.
* Continue collecting user feedback and refining the interface based on testing results. 

--- 
