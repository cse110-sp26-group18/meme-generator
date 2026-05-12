# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meme generator web app for CSE110. Users upload a photo, click to add text overlays, and download the result. Pure client-side — no server or build step.

## Architecture

- **Vanilla HTML/CSS/JS** — no frameworks, no bundler
- **HTML5 Canvas** for image rendering, text compositing, and export
- Text overlays are draggable and resizable via drag-and-drop
- Download uses `canvas.toDataURL()` or `canvas.toBlob()`

## Text Requirements

- Default font: Impact, white fill with black stroke
- Available fonts: Arial, Comic Sans, Helvetica, Montserrat (dropdown selector)
- Border toggle: border on by default, option for no border
- Text boxes are repositionable (drag) and resizable (corner drag)

## Development

No build tools. Open `index.html` directly in a browser or use any static server:

```
open index.html
# or
npx serve .
```

## Repository Structure

- `/Versions/` — working directory for iterative versions of the app
- `/documentation/log.md` — AI prompt log tracking each iteration's goals and observations
- `/research/` — user studies and workflow research (Miro board link)
