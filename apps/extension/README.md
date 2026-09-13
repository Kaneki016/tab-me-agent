# Tabme Chrome extension

Full tab-triage surface running inside Chrome's native Side Panel. Captures current-window tabs, proposes actions, enables in-panel review and chat, and executes actions upon explicit approval.

## Load unpacked

1. Start the web app backend from the repo root: `npm run dev:web`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `apps/extension` folder
5. Click the Tabme icon in Chrome's toolbar or extension menu to open the **Tabme Side Panel**
6. Click **Capture tabs in this window**

The Side Panel interacts with `http://127.0.0.1:3100`. Change `API_BASE` in `sidepanel.js` (and `popup.js`) if running on another host.

## Features

- **Side Panel Triage**: Stays open side-by-side with your active tabs as you switch between them.
- **Scanned Tab Rail**: Shows chips for all captured tabs with status (`captured`, `scraped`, `unsupported`).
- **Human-in-the-Loop Action Approvals**: Select/deselect proposed actions with checkboxes; nothing executes without your explicit click on "Approve selected".
- **Chrome Tab Grouping**: Automatically groups approved/triaged tabs into a color-coded "Tabme: Triaged" tab group in Chrome upon approval.
- **Ask Tabme Assistant**: In-panel assistant to cluster tabs or recommend approvals without navigating away.

## Known limits

- Only the current window is captured.
- `chrome://`, extension, and system pages are marked unsupported.
- Sessions are kept in backend memory and reset when the web server restarts.

