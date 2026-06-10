# Architecture Decision Record

This document summarizes the team discussion about MemeMaxxing features, priorities, and decisions throughout each version.

## Main Takeaway

The first version should focus on the basic meme editing flow:

1. Upload an image.
2. Click directly on the image to add text.
3. Move and resize the text.
4. Customize basic text styling.
5. Download or copy the finished meme.

More advanced features should come later after the basic editor works.

## Feature Discussions

### External Meme Library (using ImgFlip API) 

**Pros**
- Helps users find memes that fit a situation.
- Gives users inspiration.
- Lets users find recognizable memes they may want to edit.
- Automatically updates every 30 days with 100 most popular memes (as per ImgFlip website) 

**Cons**
- A large library may overwhelm users or cause decision fatigue.
- Having an external library causes a dependency that may break outside our control and lead to inconsistent app.

**Decision**
V1: Start with a small template library later. The first priority is getting the upload/edit/export flow working.
V2: Create an internal library first that we can work with
V3: Integrate the ImgFlip API due to its ease of regular updates, maintainibility over the long term, and popularity measure calculations
V4/V5: Integrate a fall back method where in case of API failure, the meme template on MemeMaxxing still showcases our internal library 

---

### Face Swap Memes

**Pros**
- Could be funny and unique.
- Could make the app stand out.
- More relevant in social media comment sections and with popularity of pop-culture personas

**Cons**
- Raises privacy concerns.
- Could be misused.
- People may not want edited images of themselves shared.

**Decision**
V1: This can be considered later. Focus is on core features of meme-editing 
V2: After reviewing user preferences and talking with stakeholders, this feature is not as appealing as other features
V3: Attempted to implement but results with AI were not satisfactory as per standards of developers. Feature is abondoned for now. 
V4-V5: Focus is on other core, useful features. This can be a future feature in the long term. 

---

### Edit Text on Existing Memes

**Pros**
- This is one of the most important features.
- Makes editing faster and less clunky than existing meme generators.
- Reduces the number of steps users need to take.
- Especially useful on phones.

**Cons**
- Too many customization options could make the interface more complicated.
- Many different implementation of text-editing is available and choosing the right one is crucial to being user friendly and intuitive. 

**Decision**
V1: High priority 
V2-V4: Keep working on text-box feature to debug, and make intuitive 
V5: Adapt Instagram story implementation of text editing for usability and user habits. 

---

### Mobile-Friendly Design

**Pros**
- Most memes are shared through phones and group chats.
- Makes the app easier to use in real situations.
- Makes sharing faster.

**Cons**
- Testing across screen sizes takes more work.
- There are features that make sense on one device over the other (e.g. drag and drop only applicable to desktop). 

**Decision**
V1: Focus on desktop for this version to get features working
V2: Start thinking about desktop and mobile designs 
V3: Focus is on functionality of features, not the UI 
V4: Focus on Mobile-Friendly Design and ensuring the UI is clean and features make sense for each device they appear on
V5: Build a responsive website that works on desktop, tablet, and phone.

---

### Emotion-Based Meme Search

**Pros**
- Users may know the feeling they want but not the meme name.
- Helps users who are less familiar with meme titles.
- Users showed interest in this feature
  
**Cons**
- Emotion tagging can be subjective.
- Manual emotion tagging can be labor-extensive and not maintainable in the long run with external library 
- Requires a meme database.

**Decision**
V1: Not a priority since there are no meme libraries yet 
V2: The internal library is in the form of a JSON file that allows for tagging based on emotions.
V3: Using an ImgFlip API so the search is a little better than internal library and other features are priority 
V4/V5: Using AI to automatically tag populated memes with emotions and account for synonyms in user search (e.g. recognize the "Left Exit 12 Off Ramp" meme if user searches "highway") 

---

### Video/GIF Text Editing

**Pros**
- Video memes are popular on TikTok, Instagram Reels, YouTube Shorts, and group chats.
- They have becoe more popular in comments of social medias

**Cons**
- Adds more complexity.
- Scope could become too large.
- Need additional library for popular GIFs

**Decision**
V1: Not part of this version. Focus on image editing first.
V2-V5: Users and stakeholders did not seem to care for this feature as much as other core functionalities. Focusing on quality over quantity and leaving this feature to future implementations. 

---

### Direct Sharing

**Pros**
- Makes it easier to share memes immediately.
- Matches how memes are usually used.

**Cons**
- Different apps have different sharing restrictions.
- Could be complicated across desktop and mobile.

**Decision**
V1: Focusing on download button for this version. 
V3: Implementing the device's native share sheet for mobile to allow for fast and customized sharing 
V5: Changing desktop and mobile to allow for quick copy/paste
