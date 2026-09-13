# Tabme Chrome extension

Captures the current window's tabs and sends them to the Tabme review app.

## Load unpacked

1. Start the web app from the repo root: `npm run dev:web`
2. Open `chrome://extensions`
3. Enable Developer mode
4. Click **Load unpacked** and choose this folder (`apps/extension`)
5. Open a few normal tabs, click the Tabme icon, then **Capture tabs**

The popup posts to `http://127.0.0.1:3100/api/generate-suggestions`. Change
`API_BASE` in `popup.js` if the review app is on another host.

## Known limits

- Only the current window is captured.
- `chrome://`, extension, and similar pages are marked unsupported.
- Scraping may fail; title and URL are still sent.
- No auth. Sessions live in web-app memory and disappear on restart.
