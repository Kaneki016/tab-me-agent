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
let session = null;
let selectedIds = new Set();
let executing = false;
let health = { online: false, model: false, workplace: false, search: false };

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
    const url = browserApi.runtime.getURL(
      "dashboard.html" + (session?.reviewId ? `?reviewId=${session.reviewId}` : "")
    );
    browserApi.tabs.create({ url });
  });
}
captureBtn.addEventListener("click", () => handleCapture());
recaptureBtn.addEventListener("click", () => handleCapture());

selectAllBtn.addEventListener("click", () => {
  if (!session) return;
  if (selectedIds.size > 0) {
    selectedIds.clear();
  } else {
    selectedIds = defaultSelection(session.suggestions);
  }
  updateSelectedCount();
  renderSuggestions();
});

/** Pre-checks everything still awaiting review, within the per-run approval cap. */
function defaultSelection(suggestions) {
  return new Set(
    (suggestions ?? [])
      .filter((suggestion) => suggestion.status === "pending_review")
      .slice(0, MAX_APPROVALS_PER_EXECUTION)
      .map((suggestion) => suggestion.id),
  );
}

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

    health = await fetchHealth();
    const { reviewId } = await generateSuggestions(tabs);
    session = await fetchReview(reviewId);
    selectedIds = defaultSelection(session.suggestions);

    renderSession();
  } catch (err) {
    console.error(err);
    initialStatusEl.textContent = describeError(err);
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

  // Full review lives in the extension dashboard, not the web app
  openWebReviewLink.href = browserApi.runtime.getURL(
    `dashboard.html?reviewId=${encodeURIComponent(session.reviewId)}`,
  );

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

  if (!health.workplace) {
    showExecutionNote(
      "Ambiguous is not configured, so approvals will fail. Set AMBIGUOUS_API_KEY in the root .env.",
      "error",
    );
  }
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

  for (const { category, items } of groupByCategory(session.suggestions)) {
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

function renderSuggestionRow(suggestion) {
  const item = document.createElement("div");
  item.className = "suggestion-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `sug_${suggestion.id}`;
  checkbox.checked = selectedIds.has(suggestion.id);
  checkbox.disabled =
    session.status === "executed" || suggestion.status !== "pending_review";

  checkbox.addEventListener("change", (event) => {
    if (event.target.checked) {
      if (selectedIds.size >= MAX_APPROVALS_PER_EXECUTION) {
        event.target.checked = false;
        showExecutionNote(
          `Approve up to ${MAX_APPROVALS_PER_EXECUTION} actions at a time.`,
          "error",
        );
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

  const facts = document.createElement("span");
  facts.textContent = typeLabel(suggestion.type);
  meta.appendChild(facts);

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
    link.className = "meta";
    link.textContent = `Open ${surfaceLabel(surface)} in Ambiguous ↗`;
    body.appendChild(link);
  } else if (suggestion.actionId) {
    // Ambiguous does not return a URL for every record kind
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

function updateSelectedCount() {
  selectedCountEl.textContent = String(selectedIds.size);
  approveBtn.disabled = executing || selectedIds.size === 0 || session?.status === "executed";
}

async function handleApprove() {
  if (!session || selectedIds.size === 0) return;

  executing = true;
  approveBtn.disabled = true;
  showExecutionNote("Writing approved actions to Ambiguous…");

  try {
    const approvedList = Array.from(selectedIds);
    const data = await executeSuggestions(session.reviewId, approvedList);
    const results = data.results ?? [];

    const written = results.filter(
      (result) => result.status === "completed" || result.status === "skipped",
    );
    const failures = results.filter((result) => result.status === "failed");

    const summary = [];
    if (written.length) summary.push(`Created ${summarizeSurfaces(written)} in Ambiguous.`);
    if (failures.length) {
      summary.push(
        `${failures.length} could not be written${failures[0].error ? `: ${failures[0].error}` : "."}`,
      );
    }
    showExecutionNote(
      summary.join(" ") || "Nothing was written.",
      failures.length ? "error" : "success",
      written.length > 0,
    );

    // Direct browser action: group triaged tabs, if this browser supports it
    if (groupTabsCheckbox.checked && browserApi.tabs?.group) {
      await groupApprovedTabs(approvedList);
    }

    // Refresh so each row shows the Ambiguous record it produced
    session = await fetchReview(session.reviewId);
    selectedIds.clear();
    renderSuggestions();
  } catch (err) {
    console.error(err);
    showExecutionNote(describeError(err), "error");
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
function showExecutionNote(text, tone = "", showWorkspaceLink = false) {
  executionResultEl.hidden = false;
  executionResultEl.className = tone ? `result-banner ${tone}` : "result-banner";
  executionResultEl.textContent = "";
  executionResultEl.appendChild(document.createTextNode(text));
  if (showWorkspaceLink) {
    executionResultEl.appendChild(document.createTextNode(" "));
    const link = document.createElement("a");
    link.href = "https://app.ambiguous.ai";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open Ambiguous workspace ↗";
    executionResultEl.appendChild(link);
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
      const groupId = await browserApi.tabs.group({ tabIds: tabIdsToGroup });
      if (browserApi.tabGroups?.update) {
        await browserApi.tabGroups.update(groupId, {
          title: formatGroupTitle(session.tabs),
          color: "cyan",
        });
      }
    }
  } catch (groupError) {
    console.warn("Could not group tabs:", groupError);
  }
}

// Assistant Chat
async function sendChatMessage(promptText) {
  appendChatBubble(promptText, "user");

  const thinkingBubble = appendChatBubble("Thinking…", "assistant");

  try {
    const data = await askAssistant({
      reviewId: session?.reviewId,
      tabs: session?.tabs,
      suggestions: session?.suggestions,
      message: promptText,
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
