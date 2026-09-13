import { captureTabs } from "./utils/tabs.js";
import { formatGroupTitle } from "./utils/group-title.js";
import { browserApi } from "./utils/browser-runtime.js";
import {
  MAX_APPROVALS_PER_EXECUTION,
  askAssistant,
  describeError,
  executeSuggestions,
  fetchHealth,
  fetchReview,
  generateSuggestions,
} from "./utils/api.js";
import {
  categoryLabel,
  groupByCategory,
  summarizeSurfaces,
  surfaceLabel,
  surfaceOf,
  typeLabel,
} from "./utils/taxonomy.js";

// State
let activeSession = null;
let savedSessions = [];
let selectedIds = new Set();
let executing = false;
let health = { online: false, model: false, workplace: false, search: false };
const analyzingSessionIds = new Set();

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
const triageSourceEl = document.getElementById("triageSource");
const approvalHintEl = document.getElementById("approvalHint");
const connectionStrip = document.getElementById("connectionStrip");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");

const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const historyList = document.getElementById("historyList");
const historyCountEl = document.getElementById("historyCount");

// Initialize
init();

async function init() {
  bindEvents();
  await refreshHealth();
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

async function refreshHealth() {
  health = await fetchHealth();
  renderConnection();
  return health;
}

function renderConnection() {
  let tone = "ok";
  let text = "Ambiguous connected";

  if (!health.online) {
    tone = "error";
    text = "Backend offline — run npm run dev:web";
  } else if (!health.workplace) {
    tone = "warn";
    text = "Ambiguous not configured — approvals will fail";
  } else if (!health.model) {
    tone = "warn";
    text = "Ambiguous connected · no model key, using keyword triage";
  }

  connectionStrip.dataset.tone = tone;
  connectionDot.dataset.tone = tone;
  connectionText.textContent = text;
}

async function loadStoredSessions() {
  if (!browserApi.storage?.local) return;
  const data = await browserApi.storage.local.get(["savedSessions", "activeSessionId"]);
  savedSessions = Array.isArray(data.savedSessions) ? data.savedSessions : [];
  renderHistory();
}

async function saveStoredSessions() {
  if (!browserApi.storage?.local) return;
  await browserApi.storage.local.set({
    savedSessions,
    activeSessionId: activeSession?.id,
  });
  renderHistory();
}

async function captureAndConsolidate() {
  consolidateBtn.disabled = true;

  try {
    const [currentTab] = await browserApi.tabs.query({ active: true, currentWindow: true });
    const tabs = await captureTabs();
    if (!tabs.length) {
      throw new Error("No tabs found to capture in this window.");
    }

    const isExtensionUrl = (url) =>
      !url ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("moz-extension://") ||
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:");

    // Exclude the current dashboard tab and other extension tabs
    const stashedTabs = tabs.filter(
      (t) => t.id !== currentTab?.id && !isExtensionUrl(t.url)
    );

    if (stashedTabs.length === 0) {
      alert("No external browser tabs found to group in this window.");
      return;
    }

    const tabIdsToClose = stashedTabs.map((t) => t.id).filter((id) => typeof id === "number");
    const sessionTitle = formatGroupTitle(stashedTabs);
    const now = new Date();

    const newSession = {
      id: `session_${Date.now()}`,
      reviewId: null,
      title: sessionTitle,
      createdAt: now.toISOString(),
      tabs: stashedTabs,
      suggestions: [],
      status: "analyzing",
    };

    savedSessions.unshift(newSession);
    await selectSession(newSession);
    await saveStoredSessions();

    // Close the captured tabs so only dashboard remains open
    if (tabIdsToClose.length > 0 && browserApi.tabs?.remove) {
      try {
        await browserApi.tabs.remove(tabIdsToClose);
      } catch (removeErr) {
        console.warn("Could not close captured tabs:", removeErr);
      }
    }
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : "Unable to capture tabs.");
  } finally {
    consolidateBtn.disabled = false;
  }
}

async function triggerTabAnalysis(session) {
  if (!session || analyzingSessionIds.has(session.id)) return;
  if (session.suggestions && session.suggestions.length > 0) return;
  if (session.status === "executed") return;

  analyzingSessionIds.add(session.id);
  session.status = "analyzing";
  session.error = null;
  if (activeSession?.id === session.id) {
    renderSuggestions();
  }

  try {
    const { reviewId } = await generateSuggestions(session.tabs);
    const review = await fetchReview(reviewId);

    session.reviewId = reviewId;
    session.suggestions = review.suggestions ?? [];
    session.source = review.source;
    session.status = review.status ?? "pending";
  } catch (err) {
    console.warn("Background tab triage failed:", err);
    session.status = "pending";
    session.error = describeError(err);
  } finally {
    analyzingSessionIds.delete(session.id);
    if (activeSession?.id === session.id) {
      selectedIds = defaultSelection(activeSession.suggestions);
      renderSuggestions();
      updateSelectedCount();
    }
    await saveStoredSessions();
  }
}

async function loadFromBackend(reviewId) {
  try {
    const data = await fetchReview(reviewId);

    const session = {
      id: `session_${Date.now()}`,
      reviewId: data.reviewId,
      title: formatGroupTitle(data.tabs || []),
      createdAt: data.createdAt || new Date().toISOString(),
      tabs: data.tabs || [],
      suggestions: data.suggestions || [],
      source: data.source,
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
  selectedIds = defaultSelection(session.suggestions);

  renderSession();
  renderHistory();

  // If this session has no suggestions yet, trigger background analysis!
  if (
    (!session.suggestions || session.suggestions.length === 0) &&
    session.status !== "executed"
  ) {
    triggerTabAnalysis(session);
  }
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

  const displayTitle = activeSession.title || formatGroupTitle(activeSession.tabs);
  sessionTitleEl.textContent = displayTitle;
  document.title = `${displayTitle} — Tabme`;
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
      browserApi.tabs.create({ url: tab.url });
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

function renderTriageSource() {
  const source = activeSession?.source;
  const hasSuggestions = (activeSession?.suggestions ?? []).length > 0;

  if (!source || !hasSuggestions) {
    triageSourceEl.hidden = true;
    return;
  }

  triageSourceEl.hidden = false;
  triageSourceEl.dataset.source = source;
  triageSourceEl.textContent =
    source === "model"
      ? "Categorized by the Tabme model."
      : "Categorized by keyword fallback — the model was unavailable.";
}

function renderSuggestionRow(suggestion) {
  const item = document.createElement("div");
  item.className = "suggestion-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `dash_sug_${suggestion.id}`;
  checkbox.checked = selectedIds.has(suggestion.id);
  checkbox.disabled =
    activeSession.status === "executed" || suggestion.status !== "pending_review";

  checkbox.addEventListener("change", (event) => {
    if (event.target.checked) {
      if (selectedIds.size >= MAX_APPROVALS_PER_EXECUTION) {
        event.target.checked = false;
        flashApprovalLimit();
        return;
      }
      selectedIds.add(suggestion.id);
    } else {
      selectedIds.delete(suggestion.id);
    }
    updateSelectedCount();
  });

  const body = document.createElement("div");
  body.className = "suggestion-body";

  const title = document.createElement("label");
  title.className = "suggestion-title";
  title.setAttribute("for", checkbox.id);
  title.textContent = suggestion.title;
  body.appendChild(title);

  if (suggestion.description) {
    const desc = document.createElement("span");
    desc.className = "suggestion-meta";
    desc.textContent = suggestion.description;
    body.appendChild(desc);
  }

  const meta = document.createElement("span");
  meta.className = "suggestion-meta suggestion-routing";

  const surface = surfaceOf(suggestion);
  const destination = document.createElement("span");
  destination.className = "destination-badge";
  destination.dataset.surface = surface;
  destination.textContent = surfaceLabel(surface);
  destination.title = `Approving writes this as an ${surfaceLabel(surface)}.`;
  meta.appendChild(destination);

  const facts = [typeLabel(suggestion.type)];
  if (typeof suggestion.confidence === "number") {
    facts.push(`${Math.round(suggestion.confidence * 100)}% confidence`);
  }
  if (suggestion.dueDate) facts.push(`due ${suggestion.dueDate}`);

  const factsEl = document.createElement("span");
  factsEl.textContent = facts.join(" · ");
  meta.appendChild(factsEl);

  if (suggestion.status !== "pending_review") {
    const badge = document.createElement("span");
    badge.className = `status-badge ${suggestion.status}`;
    badge.textContent = suggestion.status.replaceAll("_", " ");
    meta.appendChild(badge);
  }
  body.appendChild(meta);

  if (suggestion.resultUrl) {
    const link = document.createElement("a");
    link.href = suggestion.resultUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "suggestion-meta";
    link.textContent = `Open ${surfaceLabel(surface)} in Ambiguous ↗`;
    body.appendChild(link);
  } else if (suggestion.actionId) {
    const ref = document.createElement("code");
    ref.className = "suggestion-meta";
    ref.textContent = suggestion.actionId;
    body.appendChild(ref);
  }

  if (suggestion.error) {
    const err = document.createElement("span");
    err.className = "suggestion-meta alert";
    err.textContent = suggestion.error;
    body.appendChild(err);
  }

  item.appendChild(checkbox);
  item.appendChild(body);
  return item;
}

function renderSuggestions() {
  if (!activeSession) return;
  suggestionsList.innerHTML = "";
  renderTriageSource();

  if (activeSession.status === "analyzing") {
    const stateEl = document.createElement("div");
    stateEl.className = "analyzing-state";
    stateEl.innerHTML = `
      <div class="analyzing-spinner"></div>
      <div class="analyzing-content">
        <span class="analyzing-title">Analyzing captured tabs…</span>
        <span class="analyzing-desc">Tabme agent is identifying topics and proposing high-confidence actions.</span>
      </div>
    `;
    suggestionsList.appendChild(stateEl);
    return;
  }

  if (activeSession.error) {
    const failure = document.createElement("div");
    failure.className = "triage-error";

    const message = document.createElement("p");
    message.className = "meta alert";
    message.textContent = activeSession.error;
    failure.appendChild(message);

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-sm";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => handleRegenerateSuggestions());
    failure.appendChild(retry);

    suggestionsList.appendChild(failure);
    return;
  }

  if (!activeSession.suggestions || activeSession.suggestions.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent =
      "No actions proposed for this tab group. Re-generate to ask the agent again.";
    suggestionsList.appendChild(p);
    return;
  }

  for (const { category, items } of groupByCategory(activeSession.suggestions)) {
    const group = document.createElement("section");
    group.className = "category-group";

    const heading = document.createElement("h3");
    heading.className = "category-heading";
    heading.textContent = categoryLabel(category);

    const count = document.createElement("span");
    count.className = "category-count";
    count.textContent = String(items.length);
    heading.appendChild(count);
    group.appendChild(heading);

    for (const suggestion of items) {
      group.appendChild(renderSuggestionRow(suggestion));
    }
    suggestionsList.appendChild(group);
  }
}

function updateSelectedCount() {
  selectedCountEl.textContent = String(selectedIds.size);
  approveBtn.disabled =
    executing || selectedIds.size === 0 || activeSession?.status === "executed";
  renderApprovalHint();
}

/** Pre-checks everything still awaiting review, within the per-run approval cap. */
function defaultSelection(suggestions) {
  return new Set(
    (suggestions ?? [])
      .filter((suggestion) => suggestion.status === "pending_review")
      .slice(0, MAX_APPROVALS_PER_EXECUTION)
      .map((suggestion) => suggestion.id),
  );
}

function renderApprovalHint() {
  if (selectedIds.size > 0 && !health.workplace) {
    approvalHintEl.hidden = false;
    approvalHintEl.dataset.tone = "warn";
    approvalHintEl.textContent = health.online
      ? "Ambiguous is not configured, so these approvals will fail. Set AMBIGUOUS_API_KEY in the root .env."
      : "The Tabme backend is offline, so approvals cannot be written.";
    return;
  }

  if (selectedIds.size === 0) {
    approvalHintEl.hidden = true;
    return;
  }

  const pending = (activeSession?.suggestions ?? []).filter(
    (suggestion) => suggestion.status === "pending_review",
  );
  const surfaces = summarizeSurfaces(
    pending
      .filter((suggestion) => selectedIds.has(suggestion.id))
      .map((suggestion) => ({ surface: surfaceOf(suggestion) })),
  );
  const dismissed = pending.length - selectedIds.size;

  approvalHintEl.hidden = false;
  approvalHintEl.dataset.tone = "info";
  approvalHintEl.textContent =
    dismissed > 0
      ? `Approving writes ${surfaces}. The ${dismissed} unselected action${dismissed === 1 ? "" : "s"} will be dismissed.`
      : `Approving writes ${surfaces}.`;
}

function flashApprovalLimit() {
  approvalHintEl.hidden = false;
  approvalHintEl.dataset.tone = "warn";
  approvalHintEl.textContent = `Approve up to ${MAX_APPROVALS_PER_EXECUTION} actions at a time. Run a second round for the rest.`;
}

function handleToggleSelectAll() {
  if (!activeSession) return;
  const pending = activeSession.suggestions.filter((s) => s.status === "pending_review");
  if (selectedIds.size > 0) {
    selectedIds.clear();
  } else {
    selectedIds = new Set(
      pending.slice(0, MAX_APPROVALS_PER_EXECUTION).map((s) => s.id),
    );
  }
  updateSelectedCount();
  renderSuggestions();
}

async function handleRestoreAll() {
  if (!activeSession || !activeSession.tabs.length) return;
  for (const tab of activeSession.tabs) {
    if (tab.url && !isOwnExtensionUrl(tab.url)) {
      await browserApi.tabs.create({ url: tab.url, active: false });
    }
  }
}

function isOwnExtensionUrl(url) {
  return url.startsWith("chrome-extension://") || url.startsWith("moz-extension://");
}

async function handleGroupInChrome() {
  if (!activeSession || !activeSession.tabs.length) return;
  const urlsToOpen = activeSession.tabs.filter((t) => t.url && !isOwnExtensionUrl(t.url));
  if (urlsToOpen.length === 0) return;

  try {
    const createdTabs = [];
    for (const tab of urlsToOpen) {
      const created = await browserApi.tabs.create({ url: tab.url, active: false });
      createdTabs.push(created);
    }

    const newTabIds = createdTabs.map((t) => t.id).filter((id) => typeof id === "number");
    if (browserApi.tabs?.group && newTabIds.length > 0) {
      const groupId = await browserApi.tabs.group({ tabIds: newTabIds });
      if (browserApi.tabGroups?.update) {
        await browserApi.tabGroups.update(groupId, {
          title: formatGroupTitle(activeSession.tabs),
          color: "cyan",
        });
      }
    }
  } catch (err) {
    console.warn("Could not group tabs:", err);
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
  const originalText = regenerateBtn.textContent;
  regenerateBtn.textContent = "⟳ Generating…";

  // Reset status to analyzing and clear execution banner
  activeSession.status = "analyzing";
  activeSession.error = null;
  if (executionBanner) {
    executionBanner.hidden = true;
    executionBanner.textContent = "";
  }
  renderSuggestions();

  try {
    await refreshHealth();
    const { reviewId } = await generateSuggestions(activeSession.tabs);
    const review = await fetchReview(reviewId);

    activeSession.reviewId = reviewId;
    activeSession.suggestions = review.suggestions ?? [];
    activeSession.source = review.source;
    activeSession.status = review.status ?? "pending";
    selectedIds = defaultSelection(activeSession.suggestions);
    await saveStoredSessions();
  } catch (err) {
    console.error("Re-generate failed:", err);
    activeSession.status = "pending";
    activeSession.error = describeError(err);
  } finally {
    regenerateBtn.disabled = false;
    regenerateBtn.textContent = originalText;
    renderSuggestions();
    updateSelectedCount();
  }
}

async function handleApprove() {
  if (!activeSession || selectedIds.size === 0) return;

  if (!activeSession.reviewId) {
    setExecutionBanner(
      "This tab group has no review yet. Re-generate suggestions before approving.",
      "error",
    );
    return;
  }

  executing = true;
  approveBtn.disabled = true;
  setExecutionBanner("Writing approved actions to Ambiguous…");

  try {
    const approvedList = Array.from(selectedIds);
    const data = await executeSuggestions(activeSession.reviewId, approvedList);
    const results = data.results ?? [];

    const written = results.filter(
      (result) => result.status === "completed" || result.status === "skipped",
    );
    const failures = results.filter((result) => result.status === "failed");

    setExecutionBanner(
      describeExecution(written, failures),
      failures.length ? "error" : "success",
      written.length > 0,
    );

    // Close triaged tabs in browser if option selected
    if (closeTabsCheckbox.checked && browserApi.tabs?.remove) {
      await closeTriagedBrowserTabs(approvedList);
    }

    // Refresh review state from backend so each row shows its Ambiguous record
    const refreshed = await fetchReview(activeSession.reviewId);
    activeSession.suggestions = refreshed.suggestions ?? activeSession.suggestions;
    activeSession.status = refreshed.status;
    selectedIds.clear();
    renderSuggestions();
    await saveStoredSessions();
  } catch (err) {
    console.error(err);
    setExecutionBanner(describeError(err), "error");
  } finally {
    executing = false;
    updateSelectedCount();
  }
}

/**
 * Ambiguous doesn't return a web URL for every record kind (see the actionId
 * fallback in renderSuggestionRow), so the reliable way to see what just got
 * created is the workspace itself, not a per-record deep link.
 */
function setExecutionBanner(text, tone = "", showWorkspaceLink = false) {
  executionBanner.hidden = false;
  executionBanner.className = tone ? `result-banner ${tone}` : "result-banner";
  executionBanner.textContent = "";
  executionBanner.appendChild(document.createTextNode(text));
  if (showWorkspaceLink) {
    executionBanner.appendChild(document.createTextNode(" "));
    const link = document.createElement("a");
    link.href = "https://app.ambiguous.ai";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open Ambiguous workspace ↗";
    executionBanner.appendChild(link);
  }
}

function describeExecution(written, failures) {
  const parts = [];
  if (written.length) parts.push(`Created ${summarizeSurfaces(written)} in Ambiguous.`);
  if (failures.length) {
    const reason = failures[0].error;
    parts.push(
      `${failures.length} action${failures.length === 1 ? "" : "s"} could not be written${reason ? `: ${reason}` : "."}`,
    );
  }
  return parts.join(" ") || "Nothing was written.";
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

    const openTabs = await browserApi.tabs.query({});
    const tabsToRemove = openTabs
      .filter((t) => urlsToClose.has(t.url) && !t.url.includes("dashboard.html"))
      .map((t) => t.id)
      .filter((id) => typeof id === "number");

    if (tabsToRemove.length > 0) {
      await browserApi.tabs.remove(tabsToRemove);
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
    const data = await askAssistant({
      reviewId: activeSession?.reviewId,
      tabs: activeSession?.tabs,
      suggestions: activeSession?.suggestions,
      message: messageText,
    });
    thinkingBubble.textContent = data.reply;
  } catch (err) {
    console.error("Chat error:", err);
    thinkingBubble.textContent = describeError(err);
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
