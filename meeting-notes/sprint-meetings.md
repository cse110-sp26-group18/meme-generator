# Sprint Meeting Minutes

## Table of Contents  
* [5/7](#5/7)
* [5/12](#5/12)
* [5/14](#5/14)
* [5/19](#5/19)
* [5/21](#5/21)
* [5/26](#5/26)
* [5/28](#5/28)

<a id="5/7"></a>
## Sprint Meeting 1: 5/7 (6:20 PM – 6:45 PM)

### Summary
- Created a user survey to distribute via the CSE110 Slack channel to gather insights on:
  - What users want from meme generators
  - What tools/services they are currently using
- Discussed and refined questions to include in the survey form
- Talked with professor to discuss potential features and project direction
- Explored feature ideas, including:
  - Adding different characters
  - Supporting multiple emotions for each character (e.g., "Handsome Squidward" with varied expressions)


### Action Items (Before Sunday 5/10 Meeting)

#### Individual Responsibility
- Each team member must add **at least one reasoning entry** to the **Features ADR Log**
  - Example: *"We should add this feature because XYZ"*


### Tasks to Complete

#### Features ADR Log
- Add feature reasoning entries from all team members

#### Project Setup / Planning
- GitHub repository setup
- Documentation structure
- Role assignments

#### User Research & Design
- Define user stories
- Develop personas
- Review survey responses for feature prioritization

#### Prototyping
- Create basic prototypes based on initial feature ideas

--- 
<a id="5/12"></a>
## Sprint Meeting 2: 5/12 (6:20 PM – 6:45 PM)

### Summary
- Reviewed Version 1 of the meme generator web app.
- Everyone should document observations, strengths, weaknesses, and V2 feature ideas in `documents/log.md` in meme-generator repo by tomorrow.
- Agreed on a weekly workflow:
  - Define features each week.
  - Work on separate branches to avoid merge conflicts.
  - Release a new version every Sunday before the team meeting.
  - Use Sunday meetings to review progress and plan next steps.
- Split into two groups for Version 2 development: Features Group and Library Group.


### Action Items 

#### Individual Responsibility
- Review the V1 prototype and add comments and v2 suggestions to `log.md`.
- Communicate which feature branch you are working on.
- Prepare progress updates for Thursday’s sprint meeting.

### Tasks to Complete

#### Features Group
Focus: Text editing features for V2.

Tasks:
- Review V1 documentation for missing/improved features.
- Implement text editing functionality.
- Use separate branches for each feature.

Members:
- Tim 
- Aaron 
- Ajay 
- Solaiman 
- Ayat 
- Anvay 


#### Library Group
Focus: Meme library system for V2.

Tasks:
- Build a meme template library in the web app.
- Add 5–10 meme templates with labels and 3 emotions per character.
- Create dropdown filters for meme categories.
- Explore categories such as decision memes and statement memes.

Members:
- Aila 
- Daniel 
- Olivia 
- Howard
- Brendan 

---
<a id="5/14"></a>
## Sprint Meeting 3: 5/14 (6:20 PM – 6:40 PM)

### Summary
- Communicated about Slack notifications and making sure everyone is keeping themselves responsible for all upcoming assignments
  - Make sure your slack notification is ON and set for RECEIVING them until 12am (we need to be able to reach you when it’s time sensitive)
- We should have a standard AI Document as discussed by professor in class today

#### Blockers 
- Ayat: There was an issue in PR that was not passing the tests
  - Solaiman fixed it so now it should be 



### Action Items 
- Meeting with the professor: Should go to office hours 
  - 2-4 Wednesady. Can possibly go: Daniel, Ajay, Olivia
  - Show him v3 which will be in progress by then and ask for feedback, advice on how to prioritze features
  - Add questions we have for him [here](https://docs.google.com/document/d/1ho3q1O_Wazc8wzsk3OI7YoesBMPiLW6-WNoaDigIgoA/edit?tab=t.f964dar9qypo) 

#### Individual Responsibility
- Everyone contribute to [AI standard documentation](https://docs.google.com/document/d/1P5eOXXDR3PsoBVFp4uzcC5guoWNm4XAH_Vw1BdtXAtU/edit?tab=t.0)
  - contribute at least 2 notes
- Keep working on issues and features and feel free to open PR to check for errors and tests but we will review everything to pull everything into main on sunday meeting
- Review [rubric](../SWE%20Rubric.pdf). Have a strong understanding of what needs to get done.


#### Tasks to Complete
- Think of the pipeline we want to follow so that the workflow is very straightforward (CI pipeline built via Github Actions) 
- Architectural diagram of the project (will be discussed in Sunday meeting)
  - add ideas to [Architectural Diagram Miro](https://miro.com/app/board/uXjVHUOhHB0=/) 
- Keep working on features/issues assigned 

---

<a id="5/19"></a>
## Sprint Meeting 4: 5/19 (6:20 PM – 6:40 PM)

### Summary
- [Workflow documentation](https://docs.google.com/document/d/1HTeaZrgajNGCmCf7jVsHeb4klm5WVuD36Jaqn9a21mo/edit?tab=t.0) was drafted to ensure everyone is aligned on the development process
  - Everyone should review the document before continuing work on features
  - Add clarifying points or ask questions in `#general` in slack if anything is confusing
  - Goal is to finalize the workflow document before Sunday’s meeting so it can be pushed to the repository

#### Blockers
- No major blockers discussed
- Team should communicate any unresolved issues in the group chat as soon as possible

### Action Items
- Meeting with Powell tomorrow at 2 PM
  - Add any questions, comments, or concerns for the professor to the shared [document](https://docs.google.com/document/d/1ho3q1O_Wazc8wzsk3OI7YoesBMPiLW6-WNoaDigIgoA/edit?tab=t.f964dar9qypo) before the meeting

- Tomorrow by 6 PM:
  - [Agile: Team Status Video Notes](https://docs.google.com/document/d/1rsgM_aiGANK12TLm9Klhxjav7uKGqcxjZJLU7XpQgCo/edit?tab=t.0)
    - EVERYONE must contribute at least 2 notes
  - [Agile: Team Status Presentation](https://www.canva.com/design/DAHKLO9LBQo/KXG47URiBUqenVLdjIvaZw/edit)
    - EVERYONE must contribute at least 1 element

#### Individual Responsibility
- Review the workflow documentation before working on assigned features
- Continue resolving current issues before Sunday’s meeting
- Reach out in the chat if any blockers or concerns arise

#### Tasks to Complete
- Finalize workflow documentation before Sunday meeting
- Contribute to Agile Team Status Video Notes
- Contribute to Agile Team Status Presentation
- Resolve any current feature or issue-related problems before Sunday

---
<a id="5/21"></a> 
## Sprint Meeting 5: 5/21 (6:20 PM – 6:45 PM)

### Summary
- Discussed current testing issues on `main` branch
  - Testing may be failing due to folder path changes existing in `v3` but not in `main` (AJay fixed it in v3) 
- Team should begin merging reviewed PRs into `v3` as long as tests in `v3` are passing
- Howard will pause work on AI suggestions for now (add why in ADR) 
  - Focus will instead shift to reviewing and testing PRs
- Continue discussion about improving compatibility and project uniqueness

#### Blockers
- Ayat: Testing on `main` is currently failing
  - Possible issue caused by folder path differences between `main` and `v3`
- Olivia: Cannot push document changes to `main`, perhaps for the same reason

### Action Items
- Merge reviewed PRs into `v3` if tests are passing
- Daniel: Add another meme API as a fallback in case ImgFlip fails
- Ensure all features and APIs are compatible with each other
- Research APIs or tools for a brush feature that can delete/change meme text
  - Something that Tim and Anvay can look into implementing for their AI text-detection feature
- Explore ways to make the project stand out (“it-factor” ideas) since no longer pursuing the AI face-swap (add why in ADR) 
  - eraser brush, search for emotion tag, 
- Investigate whether additional tags can be added to the ImgFlip meme database

#### Individual Responsibility
- Continue reviewing and testing PRs
- Work on UI/UX design ideas before Sunday. Everyone must have **one** mock-up or feature placement on UI to present on Sunday. 
  - Figma, Canva, Claude Design, Drawing, etc.
  - Think about one-page app design concepts and desired feature layouts
- Fill out this [When2Meet](https://www.when2meet.com/?36809737-F1Ho8) so we can have more in-person meetings closer to deadlines

### Tasks to Complete
- Create UI design mockups by Sunday
  - Include desired features and template layouts
- Focus on becoming more coordinated as a design team
- Consider creating a project flowchart after UI design is finalized
  - Potential Week 9 issue/task assignment

#### Topics to Discuss on Sunday
- Documentation Ideas:
  - Create a `features` folder inside the `Documentation` directory
  - Each feature should have its own `.md` file
  - Developers should document:
    - How AI was used
    - What AI generated
    - Feedback/reflections for the feature
  - Entries should remain brief but descriptive
 
---
<a id="5/26"></a> 
## Sprint Meeting 5: 5/26 (6:20 PM – 6:50 PM)

### Summary
- Olivia talked to Professor Powell: showed him some of the design,
  1. stay flexible wth design and try both + test with different people/users, compartmentalize different features to it's easy to change
  2. assumptions are not always correct, so test
  3. share button + copy button --> too confusing so combine into one
  4. allow users to choose parts of their layouts --> emphasize customization
  5. keep choices of font styles limited (just impact and layout)
  6. be intentional with placement of search bars (discuss target users and already-exisisting apps) 
- Review of Group 16 code is due tonight
   - Aaron and Daniel will finish by 9:30pm
 
- Talked to Omair and some AI feature is required but vague
  - Have justification for why we are not doing face-swap and why we chose something else 

#### Blockers
- Olivia: text feature auto-enlarging does not work on Safari but works on Chrome. 

### Action Items/Individual Responsibility
- Deploy our page and add more comments in source code - Aila 
- Organize the repo - Olivia and Aila 
- Start on mobile and web UI - Aaron
- Continue on AI recognition - Tim and Anvay
- Continue working on library - Daniel and Brendan

#### Tasks to Complete
- Assignemnt due tonight
- Finalize the UI with points from Powell
- Daniel will be at OH for Powell tomorrow
- Integrate more testing and after UI design, each ask 3-4 friends for in-person feedback
- Think about what specific features we want to test so we write tests before implementing features 

----
<a id="5/28"></a>

## Sprint Meeting 6: 5/28 (6:20 PM – 6:40 PM)

### Summary
- Everyone reviewed the code reviews from different groups.
- We have just over a week before the code freeze, so we want to schedule one additional in-person meeting outside of the regular sprint meetings.
- Discussed the UI designs that Daniel and Olivia shared with Professor Powell and evaluated which design decisions make the most sense given our project goals and timeline.

#### Updates
- Aaron has continued working on the UI and implemented a settings button.
- Discussed settings functionality:
  1. Allow users to choose between different UI styles (e.g., upload button vs. blank upload box).
  2. Make the upload button larger and place it prominently on the home page.
- We need to create a manual testing template and establish a folder structure to document testing sessions and observations.

#### Blockers
- No major blockers reported during the meeting.

### Action Items/Individual Responsibility
- Continue developing the web and mobile UI following Olivia's mockups and team feedback — Aaron
- Continue working on the text-box feature; this will be the final week allocated to this effort — Soleiman and Ayat
- Continue working on the template library and implement AI tagging to improve search functionality — Daniel and Brendan
- Implement an adjustable split-view UI between the template panel and upload image panel (similar to Chrome's split-screen resizing) — Howard
- Continue working on AI text-detection and investigate fetching clean meme templates rather than removing text from uploaded images — Tim and Anvay
- Review pull requests and provide feedback — Ajay
- Create a manual testing checklist and testing subfolder to document manual testing efforts — Aila

#### Tasks to Complete
- Have a functional web and mobile UI ready by the Sunday meeting.
- Follow UI patterns commonly used in social media and editing applications (Instagram, TikTok, Snapchat).
- Implement customizable split-view sizing to allow users to personalize their workspace on web.
- Begin documenting all manual testing sessions and observations using the new testing template.
- Complete and submit availability for the next in-person meeting using the When2Meet link.
- **Fill out this [When2Meet](https://www.when2meet.com/?36809737-F1Ho8)**


