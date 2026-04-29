---
<div align="center">

<img src="./repo-card.png" alt="Browser Automation project card" width="100%" />
<br /><br />

<p><strong>Browser Automation Extension is a Chromium based side panel automation tool that records browser actions like clicks, typing, and navigation, then replays them as reusable automations. It also lets users edit, loop, import, and export recorded workflows directly from browser storage.</strong></p>

<p>Built for developers, testers, and power users who need repeatable browser workflows without setting up a full automation framework.</p>

<p>
  <a href="#overview">Overview</a> |
  <a href="#what-problem-it-solves">What It Solves</a> |
  <a href="#feature-highlights">Features</a> |
  <a href="#screenshots">Screenshots</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#tech-stack">Tech Stack</a>
</p>

<h3><strong>Made by Naadir | April 2026</strong></h3>

</div>

---

## Overview

Browser Automation Extension is a Chromium side panel tool for recording browser actions and replaying them as saved automations. It captures clicks, text input, and navigation events, then stores each workflow as a reusable automation inside browser storage.

The workflow is simple: start recording, perform actions in the browser, stop recording, select the saved automation, then replay it when needed. Users can also edit recorded steps, run loops with delay and count controls, delete workflows, import JSON automations, and export saved automations for reuse.

The practical outcome is faster browser testing, repeated form actions, workflow checks, and task replay without needing Selenium, Playwright, or a separate desktop automation setup.

## What Problem It Solves

- Removes the need to manually repeat the same browser actions during testing or repetitive web tasks
- Replaces one-off manual clicking, typing, and navigation with reusable recorded workflows
- Makes recorded steps, detected elements, selectors, timing, and saved automations visible in one side panel
- Useful compared with the default manual approach because workflows can be saved, edited, replayed, looped, imported, and exported directly inside Chromium

### At a glance

| Track | Analyse | Compare |
|---|---|---|
| Browser clicks, inputs, navigation, page titles, URLs, selectors, and timing | Recorded steps, detected HTML elements, element labels, selectors, delays, and replay status | Manual browser repetition versus saved automation replay |
| Current recording state, selected automation, loop settings, and saved workflows | Step type, selector reliability, timeout values, start URL, and replay success or failure | Original recorded flow versus edited workflow |
| Save automations in browser storage, import JSON, export JSON, and monitor detection logs | Side panel step list, detection log, current recording panel, and saved automation list | One-time action sequence versus repeated loop execution |

## Feature Highlights

- **Action recording**, captures clicks, typed input, and page navigation so browser workflows can be replayed later
- **Replay controls**, runs selected saved automations from the active tab without leaving the side panel
- **Loop execution**, adds delay and count controls for repeated workflow runs
- **Step editing**, lets users adjust action type, selector, value, page URL, and timeout for recorded steps
- **Detection log**, shows the detected HTML elements and compact selector details behind each recorded action
- **Import and export**, saves automations as JSON so workflows can be backed up, reused, or moved between environments

### Core capabilities

| Area | What it gives you |
|---|---|
| **Recording engine** | Captures browser actions as structured automation steps with selectors, labels, URLs, page titles, and timing |
| **Replay engine** | Re-runs clicks, inputs, and navigation with wait logic, page settling, and replay status feedback |
| **Workflow management** | Stores, selects, deletes, edits, imports, and exports automations from the extension UI |
| **Side panel interface** | Keeps recording, replay, logs, loop controls, and saved automations visible beside the active browser tab |

## Screenshots

<details>
<summary><strong>Open screenshot gallery</strong></summary>

<br />

<div align="center">
  <img src="./screens/screen1.png" alt="Browser Automation Extension side panel showing current recording, detected steps, logs, and saved automations" width="88%" />
  <br /><br />
  <img src="./screens/screen2.png" alt="Browser automation recording workflow with start, stop, replay, loop, delay, and count controls" width="88%" />
  <br /><br />
  <img src="./screens/screen3.png" alt="Saved automations view with import, export, delete, and selected automation controls" width="88%" />
</div>

</details>

## Quick Start

```bash
# Clone the repo
git clone https://github.com/Naadir-Dev-Portfolio/Browser-Automation-Extension.git
cd Browser-Automation-Extension

# Install dependencies
No install command required

# Run
Load the folder as an unpacked extension in Chromium
```

No API keys are required. This is a local Chromium extension. Open `chrome://extensions`, enable Developer mode, choose `Load unpacked`, and select the project folder. The extension uses browser storage for saved automations and JSON files for import and export.

## Tech Stack

<details>
<summary><strong>Open tech stack</strong></summary>

<br />

| Category | Tools |
|---|---|
| **Primary stack** | `Javascript` | `HTML` | `CSS` |
| **UI / App layer** | Chromium Side Panel UI built with plain HTML, CSS, and JavaScript |
| **Data / Storage** | `chrome.storage.local`, structured automation objects, JSON import, JSON export |
| **Automation / Integration** | Chrome Extension APIs, content scripts, background service worker, tab messaging, DOM event recording, DOM replay |
| **Platform** | Chromium based browsers on Windows, macOS, and Linux |

</details>

## Architecture & Data

<details>
<summary><strong>Open architecture and data details</strong></summary>

<br />

### Application model

The side panel is the control layer. It starts and stops recordings, displays current steps, shows detection logs, manages saved automations, and triggers replay. The background script stores the current recording and saved automations in `chrome.storage.local`, listens for tab updates, creates navigation steps, and coordinates state changes.

The content script is injected into the active page. It listens for clicks and inputs, builds selector candidates, captures locator data, sends recorded steps to the background script, and executes replay commands by finding elements, scrolling them into view, clicking them, typing into them, or navigating to URLs.

The output is a saved automation made from ordered steps. Each step can include action type, selector, selector candidates, locator metadata, element label, tag name, input value, delay, offset, timeout, page URL, page title, and recorded timestamp.

### Project structure

```text
Browser-Automation-Extension/
+-- manifest.json
+-- popup.html
+-- popup.js
+-- background.js
+-- content.js
+-- styles.css
+-- icon/
|   +-- browser-automation-logo.png
+-- README.md
+-- repo-card.png
+-- screens/
|   +-- screen1.png
+-- portfolio/
    +-- browser-automation-extension.json
    +-- browser-automation-extension.webp
```

### Data / system notes

- Automations are persisted locally with `chrome.storage.local` using `automations` and `currentRecording` storage keys.
- The extension runs locally in Chromium and does not require external APIs, accounts, servers, or API keys.
- Workflows can be exported as `browser-automations.json`, imported back into the extension, edited from the side panel, and replayed with loop controls.

</details>

## Contact

Questions, feedback, or collaboration: `naadir.dev.mail@gmail.com`

<sub>Javascript | HTML | CSS</sub>
