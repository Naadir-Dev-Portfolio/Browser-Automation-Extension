<div align="center">

<img src="./repo-card.png" alt="Browser Automation Extension project card" width="100%" />
<br /><br />

<p><strong>Record, edit, and replay browser workflows from a side panel without leaving the page.</strong></p>

<p>Built for testers, operators, and solo builders who need repeatable browser actions without writing custom automation code.</p>

<p>
  <a href="#overview">Overview</a> |
  <a href="#feature-highlights">Feature Highlights</a> |
  <a href="#screenshots">Screenshots</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#architecture--data">Architecture & Data</a>
</p>

<h3><strong>Made by Naadir | March 2026</strong></h3>

</div>

---

## Overview

Browser Automation Extension is a Chrome extension that records browser actions, stores them locally, and replays them through a dark-themed side panel UI. It is designed for users who want lightweight workflow automation without depending on external services or a separate desktop app.

The project focuses on practical browser task repetition: capturing clicks, typing, manual URL navigation, and saved automation flows that can be replayed, edited inline, looped, exported, and imported as JSON. It exists to make browser-based routines faster to repeat and easier to inspect.

## What Problem It Solves

- Repeating the same browser workflow by hand is slow and inconsistent
- Browser automation usually requires code, external tooling, or fragile one-off scripts
- Reviewing what was recorded and understanding why replay failed is usually unclear
- Users can now capture, store, edit, replay, and compare browser action sequences from one interface

### At a glance

| Track | Analyze | Compare |
|---|---|---|
| recorded clicks, inputs, navigations, and saved automations | step timing, selector strategies, and replay success or failure | multiple saved automation runs and imported/exported workflow JSON |

## Feature Highlights

- Records clicks, text input, and manual address-bar navigation into reusable browser automations
- Replays saved automations from the original start page with step highlighting, success states, and failure states
- Stores automations in browser local storage and supports JSON import/export for portability
- Uses multi-strategy element targeting with CSS, ID, data attributes, aria-label, text matching, and XPath fallback
- Includes inline step editing, looped replay controls, detection logs, and a persistent side-panel UI

### Core capabilities

| Area | What it gives you |
|---|---|
| **Recording** | Captures browser interactions in sequence, including the starting page, recorded delays, and manual URL changes |
| **Replay Engine** | Interprets action steps, waits for pages and elements, retries lookups, and reports replay progress per step |
| **Automation Library** | Lets you review, edit, delete, import, export, and reuse saved automations directly from browser storage |

## Screenshots

<details>
<summary><strong>Open screenshot gallery</strong></summary>

<br />

<div align="center">
  <img src="./screenshots/screenshot.png" alt="Screenshot 1" width="88%" />
  <br /><br />
  <img src="./screenshots/screenshot2.png" alt="Screenshot 2" width="88%" />
</div>

</details>

## Quick Start

```bash
# install dependencies
# no package install required; this is a vanilla Chrome extension

# run the project
# open chrome://extensions, enable Developer mode, then Load unpacked -> Browser-Automation-Extension
```

Add the shortest possible path to getting the project running.

Mention required API keys, environment variables, or first-launch setup here.
No API keys or environment variables are required. After loading the unpacked extension, click the toolbar icon to open the side panel.

## Tech Stack

<details>
<summary><strong>Open tech stack</strong></summary>

<br />

| Category | Tools |
|---|---|
| **Language** | JavaScript, HTML, CSS |
| **UI / Framework** | Vanilla browser extension UI / Chrome Side Panel |
| **Data / Storage** | Chrome Extension Local Storage |
| **Charts** | None |
| **External Services** | None |

</details>

## Architecture & Data

<details>
<summary><strong>Open architecture and data details</strong></summary>

<br />

### Database schema

| Table | Key columns |
|---|---|
| `chrome.storage.local (automations/currentRecording)` | `id`, `name`, `startUrl`, `startTitle`, `steps[]`, `updatedAt` |

### Data / system notes

The extension stores all recordings locally in `chrome.storage.local`; there is no remote sync layer. Replay uses a step interpreter with wait-for-page, wait-for-element, retry, and timeout handling, and recorded steps include multiple locator strategies to improve reliability across page changes.

### Project structure

```text
Browser-Automation-Extension/
|-- README.md
|-- repo-card.png
|-- manifest.json
`-- icon/, portfolio/
```

</details>

## Contact

Questions, feedback, or collaboration: `naadir.dev.mail@gmail.com`
