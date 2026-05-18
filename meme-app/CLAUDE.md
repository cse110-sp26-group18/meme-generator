# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meme generator web app for CSE110. Users upload a photo, click to add text overlays, and download the result. Pure client-side — no server or build step.

## Architecture

- Vanilla HTML/CSS/JS — no frameworks, no bundler
- Output must be vanilla JavaScript
- Pure client-side implementation only
- Server-side based technologies must be compatible with Cloudflare Pages or GitHub Pages
- HTML5 Canvas for image rendering, text compositing, and export
- Text overlays are draggable and resizable via drag-and-drop
- Download uses `canvas.toDataURL()` or `canvas.toBlob()`
- Avoid introducing new dependencies unless explicitly approved in the prompt

## UI & UX Requirements

- Generated features should prioritize mobile responsiveness and simple UI layouts
- All generated UI components must work on both desktop and mobile screen sizes
- Prioritize readability, maintainability, and efficiency in generated code
- Do not add unrequested features or UI elements
- If improvements or missing functionality are identified, list them separately as suggestions after the code

## Implementation Rules

- New features must ship with Jest tests under `testing/`
- Require AI models to list any assumptions they made when the prompt is incomplete or ambiguous
- Require AI models to list the files they changed and explain why each file was modified
- When modifying an existing file, do not restructure unrelated code
- Only edit the minimum lines necessary to implement the requested change

## Development

No build tools. Open `index.html` directly in a browser or use any static server:
