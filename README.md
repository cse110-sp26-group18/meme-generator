# Meme Generator

## Team 18 — Pandalorian

## Members

- Aaron Delgado
- Aila Jahromi
- Olivia Sun
- Ajay Anbolu
- Anvay Patil
- Ayat Alwazir
- Brendan Nguyen
- Daniel John
- Horward Guan
- Solaiman Alwazir
- Tim Nguyen

---

## Project Overview

Our project is a meme generator that is meant to make creating and editing memes faster, easier, and less annoying. A lot of meme generators already exist, but many of them feel clunky, especially when users are trying to quickly edit text or make something on their phone.

The main idea for our app is that users should be able to upload an image, click directly on the image to add text, move that text around, customize the text, and then download or copy the finished meme. We also want users to be able to choose from a small meme template library if they do not already have an image they want to use.

Since memes are usually made and shared quickly in group chats, social media, and conversations, our focus is on speed and ease of use. We do not want the user to feel like they are using a complicated editing app just to make one joke.

---

## Current Version

The current version of the app is stored in:

`versions/v1/`

Version 1 focuses on the basic meme creation flow:

- Upload an image
- Add text directly on top of the image
- Move text using drag-and-drop
- Resize the text box
- Change the font
- Toggle text border on or off
- Download the edited meme

Some features are working, but others still need improvement. Notes about what worked, what did not work, and what should be fixed next are tracked in `documentation/log.md`.

---

## First Iteration Goals

For the first iteration, our goal is to create a basic working meme generator where users can complete the main meme creation flow from start to finish.

Users should be able to:

- Upload an image
- Click directly on the image to add text
- Edit the text content
- Move text around the image
- Resize text or the text box
- Customize the text with basic styling
- Download the final meme image

This version is focused on proving the core interaction of the app. More advanced features, such as a full meme template library and character emotion swapping, are planned for later versions.

---

## Prioritized Features

### Core Features

- Upload an image from the user's device
- Add text directly on top of the image
- Move text around the image
- Resize text or the text box
- Download the final meme

### Text Customization

- Default meme font: Impact
- Font options:
  - Impact
  - Arial
  - Comic Sans
  - Helvetica
  - Montserrat
- Bold and italic text
- Text color options, starting with white and black
- Border and background options:
  - No border
  - Text outline
  - Background highlight

### Future Features

- Meme template library with 5–10 starter templates
- Popular meme categories
- Permutable character memes with selectable emotions
- Better mobile support
- Copy and paste support for finished memes

---

## Repo Organization

This repo is organized so that people can understand both the project idea and the different versions of the app.

The main folders are:

- `documentation/`
- `research/`
- `versions/`

The `documentation/` folder is for project planning, goals, workflow, screenshots, and AI usage logs.

The `research/` folder is for user research, survey information, personas, and user stories.

The `versions/` folder is for the generated versions of the app.

---

## Important Folders and Files

### `documentation/`

This folder holds the main planning and process documents for the project.

### `documentation/goals/core-design.md`

This file explains what the project is about. It has the deeper project overview, the core design goals, and the main direction for the meme generator.

### `documentation/Goals/feature-list.md`

This file tracks the features we want to build. It works like a task list for the project features, including what is high priority, what is lower priority, what is already done, and what still needs to be worked on.

### `documentation/log.md`

This file tracks what happens during each AI-generated iteration of the project. It includes the prompts used, the model used, what worked, what did not work, and what should be fixed or improved in the next version.

### `documentation/screenshots/`

This folder stores screenshots from different app versions. These screenshots help compare what appears on the webpage with what appears in the downloaded meme.

### `documentation/workflow.md`

This file explains how we organize ideas, make project decisions, and move from planning to implementation.

### `research/`

This folder holds the user research for the project.

### `research/user-study.md`

This file contains the user study work. It includes the survey, user responses, personas, and user stories. This helps us understand who we are building the app for and what problems we are trying to solve.

### `versions/`

This folder contains the different generated versions of the meme generator app. Each version has its own folder so we can keep track of how the app changes over time.

### `versions/v1/`

This folder contains the first generated version of the meme generator app.

---

## AI Generation and Version Tracking

Because this project uses AI-assisted generation, we are keeping track of each generated version of the app.

For each version, we document:

- The prompt used
- The model or tool used
- The goal of that version
- What worked
- What did not work
- Feedback for the next version
- Related screenshots, issues, or pull requests

This information is mainly stored in:

- `documentation/log.md`
- `documentation/screenshots/`
- `versions/`

Each folder inside `versions/` should represent a major version of the app so that we can compare progress over time.

---

## Testing Goals

The testing team will focus on checking whether the main meme creation flow works correctly.

Important features to test include:

- Image upload works
- Uploaded image displays correctly
- User can add text to the image
- User can edit text content
- User can move text around the image
- Text box resizing works
- Font selection works
- Border toggle works
- Final meme can be downloaded
- Downloaded meme matches what is shown on the webpage
- Layout works on different screen sizes

---

## Contributing Workflow

When adding or changing something in the project, team members should follow this basic workflow:

1. Create or claim a GitHub issue.
2. Create a branch for the task.
3. Make the change.
4. Commit with a clear message.
5. Open a pull request.
6. Link the pull request to the related issue.

Example branch names:

```txt
docs/update-readme
docs/add-generation-log
feature/text-on-image
feature/image-download
test/download-feature
fix/mobile-layout
```
