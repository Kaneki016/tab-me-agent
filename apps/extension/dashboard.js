import { captureTabs } from "./utils/tabs.js";

const API_BASE = "http://127.0.0.1:3100";

// State
let activeSession = null;
let savedSessions = [];
let selectedIds = new Set();
let executing = false;

// DOM Elements
const sessionTitleEl = document.getElementById("sessionTitle");
const sessionMetaEl = document.getElementById("sessionMeta");
const tabCountLabel = document.getElementById("tabCountLabel");
const tabList = document.getElementById("tabList");

const restoreAllBtn = document.getElementById("restoreAllBtn");
const groupChromeBtn = document.getElementById("groupChromeBtn");
const deleteSessionBtn = document.getElementById("deleteSessionBtn");
const consolidateBtn = document.getElementById("consolidateBtn");

const suggestionsList = document.getElementById("suggestionsList");
const selectAllBtn = document.getElementById("selectAllBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const approveBtn = document.getElementById("approveBtn");
const selectedCountEl = document.getElementById("selectedCount");
const closeTabsCheckbox = document.getElementById("closeTabsOnApprove");
const executionBanner = document.getElementById("executionBanner");

const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const historyList = document.getElementById("historyList");
const historyCountEl = document.getElementById("historyCount");

// Initialize
init();

async function init() {
  bindEvents();
  await loadStoredSessions();

  const urlParams = new URLSearchParams(window.location.search);
  const paramReviewId = urlParams.get("reviewId");
  const paramSessionId = urlParams.get("sessionId");

  if (paramSessionId) {
    const found = savedSessions.find((s) => s.id === paramSessionId);
    if (found) {
      await selectSession(found);
      return;
    }
  }

  if (paramReviewId) {
    await loadFromBackend(paramReviewId);
    return;
  }

  if (savedSessions.length > 0) {
    await selectSession(savedSessions[0]);
  } else {
    // If empty, auto-capture the current window!
    await captureAndConsolidate();
  }
}

function bindEvents() {
  consolidateBtn.addEventListener("click", () => captureAndConsolidate());
  restoreAllBtn.addEventListener("click", () => handleRestoreAll());
  groupChromeBtn.addEventListener("click", () => handleGroupInChrome());
  deleteSessionBtn.addEventListener("click", () => handleDeleteCurrentSession());

  selectAllBtn.addEventListener("click", () => handleToggleSelectAll());
  regenerateBtn.addEventListener("click", () => handleRegenerateSuggestions());
  approveBtn.addEventListener("click", () => handleApprove());

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
      chatInput.value = "";
      sendAssistantMessage(text);
    }
  });

  document.querySelectorAll(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prompt = btn.getAttribute("data-prompt");
      if (prompt) sendAssistantMessage(prompt);
    });
  });
}

async function loadStoredSessions() {
  if (!chrome.storage?.local) return;
  const data = await chrome.storage.local.get(["savedSessions", "activeSessionId"]);
  savedSessions = Array.isArray(data.savedSessions) ? data.savedSessions : [];
  renderHistory();
}

async function saveStoredSessions() {
  if (!chrome.storage?.local) return;
  await chrome.storage.local.set({
    savedSessions,
    activeSessionId: activeSession?.id,
  });
  renderHistory();
}

async function captureAndConsolidate() {
  consolidateBtn.disabled = true;
  sessionTitleEl.textContent = "Scanning active window…";
  sessionMetaEl.textContent = "Gathering tabs and grouping…";

  try {
    const tabs = await captureTabs();
    if (!tabs.length) {
      throw new Error("No tabs found to capture in this window.");
    }

    // Group the tabs in Chrome
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const timeStr = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const sessionTitle = `Tabme — ${dateStr}, ${timeStr}`;

    const rawTabIds = tabs.map((t) => t.id).filter((id) => typeof id === "number");
    if (chrome.tabs?.group && rawTabIds.length > 0) {
      try {
        const groupId = await chrome.tabs.group({ tabIds: rawTabIds });
        if (chrome.tabGroups?.update) {
          await chrome.tabGroups.update(groupId, {
            title: `Tabme: ${timeStr}`,
            color: "orange",
          });
        }
      } catch (groupErr) {
        console.warn("Could not group tabs in browser:", groupErr);
      }
    }

    // Send to Tabme backend for triage suggestions
    const response = await fetch(`${API_BASE}/api/generate-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs }),
    });

    const resData = await response.json();
    const reviewId = resData.reviewId;

    let suggestions = [];
    if (reviewId) {
      const fetchReview = await fetch(`${API_BASE}/api/suggestions/${reviewId}`);
      const reviewData = await fetchReview.json();
      if (reviewData.success && Array.isArray(reviewData.suggestions)) {
        suggestions = reviewData.suggestions;
      }
    }

    const newSession = {
      id: `session_${Date.now()}`,
      reviewId,
      title: sessionTitle,
      createdAt: now.toISOString(),
      tabs,
      suggestions,
      status: "pending",
    };

    savedSessions.unshift(newSession);
    await selectSession(newSession);
    await saveStoredSessions();
  } catch (err) {
    console.error(err);
    sessionTitleEl.textContent = "Capture failed";
    sessionMetaEl.textContent = err instanceof Error ? err.message : "Unable to capture tabs.";
  } finally {
    consolidateBtn.disabled = false;
  }
}

async function loadFromBackend(reviewId) {
  try {
    const res = await fetch(`${API_BASE}/api/suggestions/${reviewId}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);

    const session = {
      id: `session_${Date.now()}`,
      reviewId: data.reviewId,
      title: `Tabme Review ${data.reviewId.slice(0, 10)}`,
      createdAt: data.createdAt || new Date().toISOString(),
      tabs: data.tabs || [],
      suggestions: data.suggestions || [],
      status: data.status,
    };

    savedSessions.unshift(session);
    await selectSession(session);
    await saveStoredSessions();
  } catch (err) {
    console.error(err);
  }
}

async function selectSession(session) {
  activeSession = session;
  selectedIds = new Set(
    (session.suggestions || [])
      .filter((s) => s.status === "pending_review")
      .map((s) => s.id),
  );

  renderSession();
  renderHistory();
}

function renderSession() {
  if (!activeSession) return;

  const date = new Date(activeSession.createdAt);
  const timeFormatted = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dateFormatted = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  sessionTitleEl.textContent = activeSession.title || "Tabme Tab Group";
  sessionMetaEl.textContent = `${activeSession.tabs.length} tabs captured on ${dateFormatted} at ${timeFormatted}`;
  tabCountLabel.textContent = `Tabs in this group (${activeSession.tabs.length})`;

  // Render Tab Items
  tabList.innerHTML = "";
  activeSession.tabs.forEach((tab, index) => {
    const li = document.createElement("li");
    li.className = "tab-item";

    const linkGroup = document.createElement("div");
    linkGroup.className = "tab-link-group";

    // Favicon
    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.src = tab.favIconUrl || `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(tab.url)}`;
    favicon.onerror = () => {
      favicon.style.display = "none";
    };
    linkGroup.appendChild(favicon);

    // Title Link
    const link = document.createElement("a");
    link.href = tab.url;
    link.target = "_blank";
    link.className = "tab-title";
    link.textContent = tab.title || tab.url;
    link.title = tab.url;
    linkGroup.appendChild(link);

    // Domain
    try {
      const parsed = new URL(tab.url);
      const domainSpan = document.createElement("span");
      domainSpan.className = "tab-domain";
      domainSpan.textContent = parsed.hostname;
      linkGroup.appendChild(domainSpan);
    } catch {
      // ignore
    }

    li.appendChild(linkGroup);

    // Actions
    const actions = document.createElement("div");
    actions.className = "tab-actions";

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "icon-btn";
    restoreBtn.textContent = "Open";
    restoreBtn.title = "Open tab";
    restoreBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: tab.url });
    });
    actions.appendChild(restoreBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn";
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove from group";
    removeBtn.addEventListener("click", () => {
      activeSession.tabs.splice(index, 1);
      renderSession();
      saveStoredSessions();
    });
    actions.appendChild(removeBtn);

    li.appendChild(actions);
    tabList.appendChild(li);
  });

  // Render Suggestions
  renderSuggestions();
  updateSelectedCount();
}

function renderSuggestions() {
  if (!activeSession) return;
  suggestionsList.innerHTML = "";

  if (!activeSession.suggestions || activeSession.suggestions.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "No suggestions generated for this tab group. Click 'Re-generate' to create new suggestions.";
    suggestionsList.appendChild(p);
    return;
  }

  activeSession.suggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `dash_sug_${suggestion.id}`;
    checkbox.checked = selectedIds.has(suggestion.id);
    checkbox.disabled = activeSession.status === "executed" || suggestion.status !== "pending_review";

    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) selectedIds.add(suggestion.id);
      else selectedIds.delete(suggestion.id);
      updateSelectedCount();
    });

    const body = document.createElement("div");
    body.className = "suggestion-body";

    const title = document.createElement("span");
    title.className = "suggestion-title";
    title.textContent = suggestion.title;
    body.appendChild(title);

    if (suggestion.description) {
      const desc = document.createElement("span");
      desc.className = "suggestion-meta";
      desc.textContent = suggestion.description;
      body.appendChild(desc);
    }

    const meta = document.createElement("span");
    meta.className = "suggestion-meta";
    const typeClean = suggestion.type.replaceAll("_", " ");
    const conf = suggestion.confidence ? ` · ${Math.round(suggestion.confidence * 100)}% conf` : "";
    const due = suggestion.dueDate ? ` · Due ${suggestion.dueDate}` : "";
    meta.textContent = `${typeClean}${conf}${due}`;

    if (suggestion.status !== "pending_review") {
      const badge = document.createElement("span");
      badge.className = `status-badge ${suggestion.status}`;
      badge.textContent = suggestion.status;
      meta.appendChild(badge);
    }
    body.appendChild(meta);

    if (suggestion.resultUrl) {
      const link = document.createElement("a");
      link.href = suggestion.resultUrl;
      link.target = "_blank";
      link.className = "suggestion-meta";
      link.textContent = "Open workplace record ↗";
      body.appendChild(link);
    }

    if (suggestion.error) {
      const err = document.createElement("span");
      err.className = "meta alert";
      err.textContent = suggestion.error;
      body.appendChild(err);
    }

    item.appendChild(checkbox);
    item.appendChild(body);
    suggestionsList.appendChild(item);
  });
}

function updateSelectedCount() {
  selectedCountEl.textContent = String(selectedIds.size);
  approveBtn.disabled =
    executing || selectedIds.size === 0 || activeSession?.status === "executed";
}

function handleToggleSelectAll() {
  if (!activeSession) return;
  const pending = activeSession.suggestions.filter((s) => s.status === "pending_review");
  if (selectedIds.size === pending.length) {
    selectedIds.clear();
  } else {
    selectedIds = new Set(pending.map((s) => s.id));
  }
  updateSelectedCount();
  renderSuggestions();
}

async function handleRestoreAll() {
  if (!activeSession || !activeSession.tabs.length) return;
  for (const tab of activeSession.tabs) {
    if (tab.url) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }
  }
}

async function handleGroupInChrome() {
  if (!activeSession || !activeSession.tabs.length) return;
  const tabIds = activeSession.tabs.map((t) => t.id).filter((id) => typeof id === "number");
  if (chrome.tabs?.group && tabIds.length > 0) {
    try {
      const groupId = await chrome.tabs.group({ tabIds });
      if (chrome.tabGroups?.update) {
        await chrome.tabGroups.update(groupId, {
          title: activeSession.title.slice(0, 20),
          color: "orange",
        });
      }
    } catch (e) {
      console.warn(e);
    }
  }
}

async function handleDeleteCurrentSession() {
  if (!activeSession) return;
  savedSessions = savedSessions.filter((s) => s.id !== activeSession.id);
  activeSession = savedSessions.length > 0 ? savedSessions[0] : null;
  await saveStoredSessions();
  if (activeSession) {
    selectSession(activeSession);
  } else {
    window.location.reload();
  }
}

async function handleRegenerateSuggestions() {
  if (!activeSession) return;
  regenerateBtn.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/generate-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs: activeSession.tabs }),
    });
    const data = await response.json();
    if (data.reviewId) {
      activeSession.reviewId = data.reviewId;
      const res = await fetch(`${API_BASE}/api/suggestions/${data.reviewId}`);
      const reviewData = await res.json();
      if (reviewData.success) {
        activeSession.suggestions = reviewData.suggestions;
        selectedIds = new Set(
          activeSession.suggestions
            .filter((s) => s.status === "pending_review")
            .map((s) => s.id),
        );
        renderSuggestions();
        updateSelectedCount();
        await saveStoredSessions();
      }
    }
  } catch (err) {
    console.error("Re-generate failed:", err);
  } finally {
    regenerateBtn.disabled = false;
  }
}

async function handleApprove() {
  if (!activeSession || selectedIds.size === 0) return;

  executing = true;
  approveBtn.disabled = true;
  executionBanner.hidden = false;
  executionBanner.className = "result-banner";
  executionBanner.textContent = "Executing approved suggestions…";

  try {
    const approvedList = Array.from(selectedIds);
    const response = await fetch(`${API_BASE}/api/execute-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: activeSession.reviewId,
        approvedIds: approvedList,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Execution failed.");
    }

    const completed = (data.results ?? []).filter((r) => r.status === "completed").length;
    const failed = (data.results ?? []).filter((r) => r.status === "failed").length;

    executionBanner.className = failed ? "result-banner error" : "result-banner success";
    executionBanner.textContent = failed
      ? `Completed ${completed} actions. ${failed} failed.`
      : `Completed ${completed} actions successfully in workspace.`;

    // Close triaged tabs in browser if option selected
    if (closeTabsCheckbox.checked && chrome.tabs?.remove) {
      await closeTriagedBrowserTabs(approvedList);
    }

    // Refresh review state from backend
    if (activeSession.reviewId) {
      const refreshRes = await fetch(`${API_BASE}/api/suggestions/${activeSession.reviewId}`);
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.success) {
        activeSession.suggestions = refreshData.suggestions;
        activeSession.status = refreshData.status;
        renderSuggestions();
        await saveStoredSessions();
      }
    }
  } catch (err) {
    console.error(err);
    executionBanner.className = "result-banner error";
    executionBanner.textContent = err instanceof Error ? err.message : "Execution failed.";
  } finally {
    executing = false;
    updateSelectedCount();
  }
}

async function closeTriagedBrowserTabs(approvedIds) {
  try {
    const approvedSuggestions = activeSession.suggestions.filter((s) =>
      approvedIds.includes(s.id),
    );
    const urlsToClose = new Set();
    for (const sug of approvedSuggestions) {
      if (sug.data?.url) urlsToClose.add(sug.data.url);
      if (Array.isArray(sug.data?.urls)) sug.data.urls.forEach((u) => urlsToClose.add(u));
    }

    const chromeTabs = await chrome.tabs.query({});
    const tabsToRemove = chromeTabs
      .filter((t) => urlsToClose.has(t.url) && !t.url.includes("dashboard.html"))
      .map((t) => t.id)
      .filter((id) => typeof id === "number");

    if (tabsToRemove.length > 0) {
      await chrome.tabs.remove(tabsToRemove);
    }
  } catch (e) {
    console.warn("Could not close browser tabs:", e);
  }
}

// Assistant
async function sendAssistantMessage(messageText) {
  appendChatBubble(messageText, "user");
  const thinkingBubble = appendChatBubble("Thinking…", "assistant");

  try {
    const response = await fetch(`${API_BASE}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: activeSession?.reviewId,
        message: messageText,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Assistant unavailable.");
    }
    thinkingBubble.textContent = data.reply;
  } catch (err) {
    console.error("Chat error:", err);
    thinkingBubble.textContent =
      "Could not reach the Tabme assistant. Make sure http://127.0.0.1:3100 is running.";
  }
}

function appendChatBubble(text, role) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-${role}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function renderHistory() {
  historyCountEl.textContent = String(savedSessions.length);
  historyList.innerHTML = "";

  if (savedSessions.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "No saved tab groups yet.";
    historyList.appendChild(p);
    return;
  }

  savedSessions.forEach((sess) => {
    const item = document.createElement("div");
    item.className = "history-item";
    if (activeSession && activeSession.id === sess.id) {
      item.style.borderLeft = "3px solid var(--brass)";
    }

    const info = document.createElement("div");
    info.className = "history-item-info";

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = sess.title || "Tab Group";
    info.appendChild(title);

    const date = document.createElement("span");
    date.className = "history-item-date";
    date.textContent = `${sess.tabs.length} tabs · ${new Date(sess.createdAt).toLocaleDateString()}`;
    info.appendChild(date);

    item.appendChild(info);

    item.addEventListener("click", () => {
      selectSession(sess);
    });

    historyList.appendChild(item);
  });
}
