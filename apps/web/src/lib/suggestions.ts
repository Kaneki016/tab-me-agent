import type { Suggestion, Tab } from "./types";

let counter = 0;

function nextId() {
  counter += 1;
  return `sug_${Date.now()}_${counter}`;
}

function nextFriday(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function usableTabs(tabs: Tab[]): Tab[] {
  return tabs.filter((tab) => tab.status !== "unsupported");
}

export function generateSuggestions(tabs: Tab[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const pool = usableTabs(tabs);

  const learningTabs = pool
    .filter(
      (tab) =>
        /react|next|learn|doc|guide|tutorial|mdn|spec/i.test(tab.title) ||
        /react|next|learn|doc|guide|tutorial/i.test(tab.url),
    )
    .slice(0, 2);

  for (const tab of learningTabs) {
    suggestions.push({
      id: nextId(),
      type: "create_task",
      status: "pending_review",
      data: { title: `Learn: ${tab.title || "Untitled"}`, url: tab.url },
      editable: true,
      title: `Create task: ${tab.title || "topic"}`,
      description: `From tab: ${tab.title || tab.url}`,
      dueDate: nextFriday(),
      confidence: 0.7,
    });
  }

  const competitorTabs = pool
    .filter(
      (tab) =>
        /notion|linear|asana|competitor|product|pricing/i.test(tab.title) ||
        /notion|linear|asana|competitor/i.test(tab.url),
    )
    .slice(0, 1);

  for (const tab of competitorTabs) {
    suggestions.push({
      id: nextId(),
      type: "add_competitor",
      status: "pending_review",
      data: { name: tab.title || "Competitor", url: tab.url },
      editable: true,
      title: `Add competitor: ${tab.title || "Unknown"}`,
      description: `From tab: ${tab.url}`,
      confidence: 0.6,
    });
  }

  if (suggestions.length === 0 && pool.length > 0) {
    const first = pool[0];
    suggestions.push({
      id: nextId(),
      type: "save_note",
      status: "pending_review",
      data: { title: first.title || "Untitled note", url: first.url },
      editable: true,
      title: `Save note: ${first.title || "Untitled"}`,
      description: `From tab: ${first.url}`,
      confidence: 0.5,
    });
  }

  if (pool.length >= 3 && suggestions.length < 5) {
    suggestions.push({
      id: nextId(),
      type: "create_task",
      status: "pending_review",
      data: {
        title: `Triage ${pool.length} open tabs`,
        urls: pool.map((tab) => tab.url),
      },
      editable: true,
      title: `Create task: Triage ${pool.length} captured tabs`,
      description: "Bundle the current window into one follow-up.",
      dueDate: nextFriday(),
      confidence: 0.55,
    });
  }

  return suggestions.slice(0, 5);
}
