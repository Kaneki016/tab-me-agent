// Tabme background: a service worker on Chrome, an event page on Firefox.
import { browserApi } from "./utils/browser-runtime.js";

browserApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_DASHBOARD") {
    const url = browserApi.runtime.getURL(
      `dashboard.html${message.query ? `?${message.query}` : ""}`,
    );
    browserApi.tabs.create({ url });
    sendResponse({ success: true });
    return true;
  }
});
