import { captureTabs } from "./utils/tabs.js";

const API_BASE = "http://127.0.0.1:3100";

const groupAndOpenBtn = document.getElementById("groupAndOpenBtn");
const openDashboardBtn = document.getElementById("openDashboardBtn");
const openPanelBtn = document.getElementById("openPanelBtn");
const statusEl = document.getElementById("status");

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type;
}

// 1. One-Click: Group Tabs & Open Tabme Dashboard
groupAndOpenBtn.addEventListener("click", async () => {
  setStatus("Grouping tabs…");
  groupAndOpenBtn.disabled = true;

  try {
    const tabs = await captureTabs();
    if (!tabs.length) {
      throw new Error("No tabs found in this window.");
    }

    // Group tabs in Chrome
    const rawTabIds = tabs.map((t) => t.id).filter((id) => typeof id === "number");
    if (chrome.tabs?.group && rawTabIds.length > 0) {
      try {
        const groupId = await chrome.tabs.group({ tabIds: rawTabIds });
        if (chrome.tabGroups?.update) {
          const timeStr = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
          await chrome.tabGroups.update(groupId, {
            title: `Tabme: ${timeStr}`,
            color: "orange",
          });
        }
      } catch (groupErr) {
        console.warn("Tab grouping error:", groupErr);
      }
    }

    // Call backend for suggestions
    let reviewId = null;
    let suggestions = [];
    try {
      const response = await fetch(`${API_BASE}/api/generate-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabs }),
      });
      const data = await response.json();
      if (data.reviewId) {
        reviewId = data.reviewId;
        const revRes = await fetch(`${API_BASE}/api/suggestions/${reviewId}`);
        const revData = await revRes.json();
        if (revData.success && Array.isArray(revData.suggestions)) {
          suggestions = revData.suggestions;
        }
      }
    } catch (apiErr) {
      console.warn("Backend suggestion error:", apiErr);
    }

    // Save session to chrome.storage.local
    if (chrome.storage?.local) {
      const stored = await chrome.storage.local.get(["savedSessions"]);
      const savedSessions = Array.isArray(stored.savedSessions) ? stored.savedSessions : [];
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

      const newSession = {
        id: `session_${Date.now()}`,
        reviewId,
        title: `Tabme — ${dateStr}, ${timeStr}`,
        createdAt: now.toISOString(),
        tabs,
        suggestions,
        status: "pending",
      };

      savedSessions.unshift(newSession);
      await chrome.storage.local.set({
        savedSessions,
        activeSessionId: newSession.id,
      });
    }

    // Open Dashboard page
    const dashboardUrl = chrome.runtime.getURL("dashboard.html");
    await chrome.tabs.create({ url: dashboardUrl });
    window.close();
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Failed to group tabs.", "error");
    groupAndOpenBtn.disabled = false;
  }
});

// 2. Open Existing Dashboard
openDashboardBtn.addEventListener("click", async () => {
  const dashboardUrl = chrome.runtime.getURL("dashboard.html");
  await chrome.tabs.create({ url: dashboardUrl });
  window.close();
});

// 3. Open Side Panel
openPanelBtn.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId && chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    } else {
      setStatus("Side panel not supported in this window.", "error");
    }
  } catch (err) {
    console.error(err);
    setStatus("Failed to open side panel.", "error");
  }
});
