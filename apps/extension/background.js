// Tabme Background Service Worker

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_DASHBOARD") {
    const url = chrome.runtime.getURL(`dashboard.html${message.query ? `?${message.query}` : ""}`);
    chrome.tabs.create({ url });
    sendResponse({ success: true });
    return true;
  }
});
