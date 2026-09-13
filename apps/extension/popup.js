import { captureTabs } from "./utils/tabs.js";
import { formatGroupTitle } from "./utils/group-title.js";
import { browserApi, isFirefox } from "./utils/browser-runtime.js";

const groupAndOpenBtn = document.getElementById("groupAndOpenBtn");
const openDashboardBtn = document.getElementById("openDashboardBtn");
const openPanelBtn = document.getElementById("openPanelBtn");
const statusEl = document.getElementById("status");

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type;
}

// 1. One-Click: Stash Tabs, Close Them, & Open Tabme Dashboard Instantly
groupAndOpenBtn.addEventListener("click", async () => {
  setStatus("Stashing tabs…");
  groupAndOpenBtn.disabled = true;

  try {
    const currentWindow = await browserApi.windows.getCurrent();
    const tabs = await captureTabs();
    if (!tabs.length) {
      throw new Error("No tabs found in this window.");
    }

    // Filter out internal and extension tabs so we only stash user tabs
    const isExtensionUrl = (url) =>
      !url ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("moz-extension://") ||
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:");

    const stashedTabs = tabs.filter((t) => !isExtensionUrl(t.url));
    const tabsToSave = stashedTabs.length > 0 ? stashedTabs : tabs;
    const tabIdsToClose = stashedTabs.map((t) => t.id).filter((id) => typeof id === "number");

    // Intelligent title
    const groupTitle = formatGroupTitle(tabsToSave);
    const now = new Date();

    const newSession = {
      id: `session_${Date.now()}`,
      reviewId: null,
      title: groupTitle,
      createdAt: now.toISOString(),
      tabs: tabsToSave,
      suggestions: [],
      status: "analyzing",
    };

    // Save session immediately to local storage
    if (browserApi.storage?.local) {
      const stored = await browserApi.storage.local.get(["savedSessions"]);
      const savedSessions = Array.isArray(stored.savedSessions) ? stored.savedSessions : [];
      savedSessions.unshift(newSession);
      await browserApi.storage.local.set({
        savedSessions,
        activeSessionId: newSession.id,
      });
    }

    // Open Dashboard page in current window FIRST
    const dashboardUrl = browserApi.runtime.getURL(`dashboard.html?sessionId=${newSession.id}`);
    await browserApi.tabs.create({
      windowId: currentWindow.id,
      url: dashboardUrl,
      active: true,
    });

    // Close all stashed tabs in the browser (they will only restore when user asks)
    if (tabIdsToClose.length > 0 && browserApi.tabs?.remove) {
      try {
        await browserApi.tabs.remove(tabIdsToClose);
      } catch (removeErr) {
        console.warn("Could not close tabs:", removeErr);
      }
    }

    window.close();
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Failed to stash tabs.", "error");
    groupAndOpenBtn.disabled = false;
  }
});

// 2. Open Existing Dashboard
openDashboardBtn.addEventListener("click", async () => {
  const dashboardUrl = browserApi.runtime.getURL("dashboard.html");
  await browserApi.tabs.create({ url: dashboardUrl });
  window.close();
});

// 3. Open Side Panel (Chrome) / Sidebar (Firefox)
openPanelBtn.addEventListener("click", async () => {
  // Firefox revokes "user input handler" status the instant a promise is
  // awaited, so sidebarAction.open() must fire before any other await in
  // this handler — it cannot go through the same tabs.query() path Chrome
  // needs for a windowId.
  if (isFirefox) {
    try {
      await browserApi.sidebarAction.open();
      window.close();
    } catch (err) {
      console.error(err);
      setStatus("Failed to open the sidebar.", "error");
    }
    return;
  }

  try {
    const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId && browserApi.sidePanel?.open) {
      await browserApi.sidePanel.open({ windowId: tab.windowId });
      window.close();
    } else {
      setStatus("Side panel not supported in this window.", "error");
    }
  } catch (err) {
    console.error(err);
    setStatus("Failed to open side panel.", "error");
  }
});
