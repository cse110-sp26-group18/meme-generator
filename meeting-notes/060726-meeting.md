# Meeting 4 - 06/07/26

## Team 18 - Pandalorian

## Members

- [X] Aaron Delgado (Late)
- [x] Aila Jahromi
- [x] Olivia Sun
- [ ] Ajay Anbolu
- [ ] Anvay Patil
- [x] Ayat Alwazir
- [x] Brendan Nguyen
- [X] Daniel John (In and out of meeting)
- [x] Horward Guan
- [x] Solaiman Alwazir
- [x] Tim Nguyen

## Meeting Place & Time
We had a meeting on Google Meet.

## Agenda
- [Blockers & Development Updates](#blockers--development-updates)
- [Feature Review & Testing](#feature-review--testing)
- [Presentation Planning](#presentation-planning)
- [To-Do Items](#to-do-items)

---

# Blockers & Development Updates

## Current Blockers
- An internal library previously merged by Brendan was accidentally reverted.
- Brendan will submit a quick PR to restore those changes.
- Issues in testing files caused Ayat's PRs to fail despite the feature work being completed.

## Repository Updates
- Some GitHub issues are not closing automatically after PR merges.
- Team members should manually close any issues they have already addressed.
- Everyone should remain active on Slack throughout the day for coordination.

---

# Feature Review & Testing

## Manual Testing

### Meme Editor
- Discussed whether custom fonts are necessary.
- Identified issues when switching between Impact and Arial fonts.
- The meme should remain centered on the page.
- Some previously implemented features appear to have been lost and need investigation.

### Text Recognition Feature
- The feature works well overall and demonstrates strong functionality.
- Performance decreases with:
  - More complicated image backgrounds.
  - Smaller text sizes.
- Decision:
  - Include a working demo in the final presentation.
  - Explain that it is an ongoing feature that the team plans to continue improving.
  - Highlight its usefulness for users who find a meme online but do not have access to the original template.

### AI-Suggested Memes
- The current implementation differs from the previously working version.
- Decision:
  - Revert to Ajay's working version.
  - Olivia will merge the working implementation into V5.
  - Remove the settings menu and Panda button since they are no longer needed.
- Tim will review PR #91.

### E2E Testing
- Brendan, Anvay, and Ayat added additional end-to-end tests.
- All new tests should now be included in V5.

### Merge Coordination
- Tim will wait for Olivia's updates, pull the newest changes, and then merge his branch.
- Once V5 contains the AI recommendation updates, Tim will open a PR for the text-recognition feature.

---

# Presentation Planning

## Tuesday Meeting
- The team will meet online since not everyone can attend in person.
- Create a PowerPoint presentation and face-cam video presentation.
- Team members can record their assigned sections individually.
- Individual recordings will be combined into a cohesive final presentation.
- This approach allows work to be parallelized and completed more efficiently.

---

# To-Do Items

## Brendan
- Restore the reverted internal library through a PR.

## Tim
- Wait for AI recommendation updates in V5.
- Open a PR for the text-recognition feature after updating.

## Ayat & Solaiman
- Fix mobile text-box dragging behavior.
- Ensure dragging a selected text box does not cause the page to scroll.

## Horward
- Clean up the repository.
- Assist with code reviews.

## Aila & Olivia
- Set up the PowerPoint presentation.
- Create the presentation outline.
- Organize and assign presentation/video sections based on the Canvas assignment requirements.
- Review PRs.
- Resolve merge conflicts.
- Coordinate with team members as needed.

## Everyone
- Close completed GitHub issues manually if they remain open.
- Stay active on Slack for the remainder of the day.
