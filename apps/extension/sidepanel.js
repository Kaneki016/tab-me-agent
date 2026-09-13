import { captureTabs } from "./utils/tabs.js";
import { formatGroupTitle } from "./utils/group-title.js";

const API_BASE = "http://127.0.0.1:3100";

// State
let session = null;
let selectedIds = new Set();
let executing = false;

// DOM Elements
const initialStateEl = document.getElementById("initialState");
const reviewStateEl = document.getElementById("reviewState");
const captureBtn = document.getElementById("captureBtn");
const recaptureBtn = document.getElementById("recaptureBtn");
const sessionPill = document.getElementById("sessionPill");
const initialStatusEl = document.getElementById("initialStatus");

const tabCountLabel = document.getElementById("tabCountLabel");
const tabRail = document.getElementById("tabRail");

const suggestionsList = document.getElementById("suggestionsList");
const selectAllBtn = document.getElementById("selectAllBtn");
const approveBtn = document.getElementById("approveBtn");
const selectedCountEl = document.getElementById("selectedCount");
const groupTabsCheckbox = document.getElementById("groupTabsCheckbox");
const executionResultEl = document.getElementById("executionResult");

const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const openWebReviewLink = document.getElementById("openWebReviewLink");
const openDashboardBtn = document.getElementById("openDashboardBtn");

// Event Listeners
if (openDashboardBtn) {
  openDashboardBtn.addEventListener("click", () => {
    const url = chrome.runtime.getURL(
      "dashboard.html" + (session?.reviewId ? `?reviewId=${session.reviewId}` : "")
    );
    chrome.tabs.create({ url });
  });
}
captureBtn.addEventListener("click", () => handleCapture());
recaptureBtn.addEventListener("click", () => handleCapture());

selectAllBtn.addEventListener("click", () => {
  if (!session) return;
  const pending = session.suggestions.filter((s) => s.status === "pending_review");
  if (selectedIds.size === pending.length) {
    selectedIds.clear();
  } else {
    selectedIds = new Set(pending.map((s) => s.id));
  }
  updateSelectedCount();
  renderSuggestions();
});

approveBtn.addEventListener("click", () => handleApprove());

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    chatInput.value = "";
    sendChatMessage(text);
  }
});

document.querySelectorAll(".chip-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const prompt = btn.getAttribute("data-prompt");
    if (prompt) sendChatMessage(prompt);
  });
});

async function handleCapture() {
  captureBtn.disabled = true;
  recaptureBtn.disabled = true;
  initialStatusEl.textContent = "Scanning active window tabs…";
  initialStatusEl.className = "meta status-text";
  executionResultEl.hidden = true;

  try {
    const tabs = await captureTabs();
    if (!tabs.length) {
      throw new Error("No tabs found in this window.");
    }

    initialStatusEl.textContent = `Sending ${tabs.length} tabs to Tabme agent…`;

    const response = await fetch(`${API_BASE}/api/generate-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs }),
    });

    const data = await response.json();
    if (!response.ok || !data.reviewId) {
      throw new Error(data.error || "Backend failed to generate suggestions. Ensure web app is running.");
    }

    // Load fresh session details
    const sessionRes = await fetch(`${API_BASE}/api/suggestions/${data.reviewId}`);
    const sessionData = await sessionRes.json();
    if (!sessionRes.ok || !sessionData.success) {
      throw new Error(sessionData.error || "Could not retrieve review session.");
    }

    session = sessionData;
    selectedIds = new Set(
      session.suggestions
        .filter((s) => s.status === "pending_review")
        .map((s) => s.id),
    );

    renderSession();
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Failed to capture tabs.";
    initialStatusEl.textContent = msg;
    initialStatusEl.className = "meta status-text alert";
  } finally {
    captureBtn.disabled = false;
    recaptureBtn.disabled = false;
  }
}

function renderSession() {
  if (!session) return;

  initialStateEl.hidden = true;
  reviewStateEl.hidden = false;
  recaptureBtn.hidden = false;
  sessionPill.hidden = false;
  sessionPill.textContent = session.reviewId;

  // Web Review Link
  openWebReviewLink.href = `${API_BASE}/review/${session.reviewId}`;

  // Tabs
  tabCountLabel.textContent = `Captured tabs (${session.tabs.length})`;
  tabRail.innerHTML = "";
  session.tabs.forEach((tab) => {
    const chip = document.createElement("span");
    chip.className = "tab-chip";
    chip.dataset.status = tab.status;
    chip.title = tab.url;

    const titleSpan = document.createElement("span");
    titleSpan.textContent = tab.title || tab.url;
    chip.appendChild(titleSpan);

    const small = document.createElement("small");
    small.textContent = tab.status;
    chip.appendChild(small);

    tabRail.appendChild(chip);
  });

  // Suggestions
  renderSuggestions();
  updateSelectedCount();
}

function renderSuggestions() {
  if (!session) return;
  suggestionsList.innerHTML = "";

  if (session.suggestions.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.className = "meta";
    emptyP.textContent = "No suggestions generated for this session.";
    suggestionsList.appendChild(emptyP);
    return;
  }

  session.suggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `sug_${suggestion.id}`;
    checkbox.checked = selectedIds.has(suggestion.id);
    checkbox.disabled = session.status === "executed" || suggestion.status !== "pending_review";

    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        selectedIds.add(suggestion.id);
      } else {
        selectedIds.delete(suggestion.id);
      }
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
    const typeLabel = suggestion.type.replaceAll("_", " ");
    const statusPart = suggestion.status !== "pending_review" ? ` · ${suggestion.status}` : "";
    const actionPart = suggestion.actionId ? ` · ${suggestion.actionId}` : "";
    meta.textContent = `${typeLabel}${statusPart}${actionPart}`;

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
      link.className = "meta";
      link.textContent = "Open workplace record ↗";
      body.appendChild(link);
    }

    if (suggestion.error) {
      const err = document.createElement("span");
      err.className = "alert";
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
  approveBtn.disabled = executing || selectedIds.size === 0 || session?.status === "executed";
}

async function handleApprove() {
  if (!session || selectedIds.size === 0) return;

  executing = true;
  approveBtn.disabled = true;
  executionResultEl.hidden = false;
  executionResultEl.className = "result-banner";
  executionResultEl.textContent = "Executing approved suggestions…";

  try {
    const approvedList = Array.from(selectedIds);
    const response = await fetch(`${API_BASE}/api/execute-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: session.reviewId,
        approvedIds: approvedList,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Execution failed.");
    }

    const completed = (data.results ?? []).filter((r) => r.status === "completed").length;
    const failed = (data.results ?? []).filter((r) => r.status === "failed").length;

    executionResultEl.className = failed ? "result-banner error" : "result-banner success";
    executionResultEl.textContent = failed
      ? `Completed ${completed} actions. ${failed} failed.`
      : `Completed ${completed} actions successfully.`;

    // Direct Browser Action: Group triaged tabs in Chrome
    if (groupTabsCheckbox.checked && chrome.tabs?.group) {
      await groupApprovedTabs(approvedList);
    }

    // Refresh review session state
    const refreshRes = await fetch(`${API_BASE}/api/suggestions/${session.reviewId}`);
    const refreshData = await refreshRes.json();
    if (refreshRes.ok && refreshData.success) {
      session = refreshData;
      renderSuggestions();
    }
  } catch (err) {
    console.error(err);
    executionResultEl.className = "result-banner error";
    executionResultEl.textContent = err instanceof Error ? err.message : "Execution failed.";
  } finally {
    executing = false;
    updateSelectedCount();
  }
}

async function groupApprovedTabs(approvedSuggestionIds) {
  try {
    const approvedSuggestions = session.suggestions.filter((s) =>
      approvedSuggestionIds.includes(s.id),
    );

    // Collect URLs from approved suggestions
    const targetUrls = new Set();
    for (const sug of approvedSuggestions) {
      if (sug.data?.url) targetUrls.add(sug.data.url);
      if (Array.isArray(sug.data?.urls)) {
        sug.data.urls.forEach((u) => targetUrls.add(u));
      }
    }

    // Find matching tab IDs in the current session
    const tabIdsToGroup = session.tabs
      .filter((tab) => targetUrls.has(tab.url) && typeof tab.id === "number")
      .map((tab) => tab.id);

    if (tabIdsToGroup.length > 0) {
      const groupId = await chrome.tabs.group({ tabIds: tabIdsToGroup });
      if (chrome.tabGroups?.update) {
        await chrome.tabGroups.update(groupId, {
          title: formatGroupTitle(session.tabs),
          color: "cyan",
        });
      }
    }
  } catch (groupError) {
    console.warn("Could not group tabs in Chrome:", groupError);
  }
}

// Assistant Chat
async function sendChatMessage(promptText) {
  appendChatBubble(promptText, "user");

  const thinkingBubble = appendChatBubble("Thinking…", "assistant");

  try {
    const response = await fetch(`${API_BASE}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: session?.reviewId,
        tabs: session?.tabs,
        suggestions: session?.suggestions,
        message: promptText,
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
      "Could not reach the Tabme assistant. Make sure the web app is running at http://127.0.0.1:3100.";
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
