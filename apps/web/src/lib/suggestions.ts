import { triageTabs, type TriageSuggestion } from "agent-core";
import type { Suggestion, SuggestionSource, Tab, TaskCategory } from "./types";

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

function categoryFor(tab: Tab): TaskCategory {
  const text = `${tab.title} ${tab.url}`.toLowerCase();
  if (/react|next|learn|doc|guide|tutorial|mdn|spec/.test(text)) return "learning";
  if (/notion|linear|asana|competitor|product|pricing/.test(text)) return "competitor";
  if (/paper|report|study|research|arxiv/.test(text)) return "research";
  if (/reference|api|manual|docs/.test(text)) return "reference";
  return "follow_up";
}

function actionFor(category: TaskCategory, tab: Tab): string {
  const subject = tab.title || new URL(tab.url).hostname;
  switch (category) {
    case "learning":
      return `Study: ${subject}`;
    case "competitor":
      return `Assess competitor: ${subject}`;
    case "research":
      return `Research: ${subject}`;
    case "reference":
      return `Review reference: ${subject}`;
    default:
      return `Follow up: ${subject}`;
  }
}

function taskSuggestion(
  title: string,
  description: string,
  category: TaskCategory,
  urls: string[],
  confidence: number,
): Suggestion {
  return {
    id: nextId(),
    type: "create_task",
    category,
    status: "pending_review",
    data: { title, urls },
    editable: true,
    title,
    description,
    dueDate: nextFriday(),
    confidence,
  };
}

function triageData(item: TriageSuggestion): Record<string, unknown> {
  return {
    title: item.title,
    urls: item.sourceUrl ? [item.sourceUrl] : [],
  };
}

export function mapTriageSuggestions(items: TriageSuggestion[]): Suggestion[] {
  return items.map((item) => ({
    id: nextId(),
    type: "create_task",
    category: item.category,
    status: "pending_review",
    data: triageData(item),
    editable: true,
    title: item.title,
    description: item.description,
    dueDate: item.dueDate || nextFriday(),
    confidence: item.confidence,
  }));
}

/** Deterministic, useful fallback when the model is absent or times out. */
export function generateSuggestions(tabs: Tab[]): Suggestion[] {
  const pool = usableTabs(tabs);
  const suggestions = pool.slice(0, 4).map((tab) => {
    const category = categoryFor(tab);
    const title = actionFor(category, tab);
    return taskSuggestion(
      title,
      `Turn the captured tab into a concrete ${category.replace("_", " ")} follow-up.`,
      category,
      [tab.url],
      0.62,
    );
  });

  if (pool.length >= 3 && suggestions.length < 5) {
    suggestions.push(
      taskSuggestion(
        `Prioritize ${pool.length} captured tabs`,
        "Review the captured sources together and decide the next three actions.",
        "follow_up",
        pool.map((tab) => tab.url),
        0.55,
      ),
    );
  }

  return suggestions.slice(0, 5);
}

export async function buildReviewSuggestions(tabs: Tab[]): Promise<{
  suggestions: Suggestion[];
  source: SuggestionSource;
}> {
  const triage = await triageTabs(tabs);
  if (triage) {
    return {
      suggestions: mapTriageSuggestions(triage.suggestions),
      source: "model",
    };
  }
  return {
    suggestions: generateSuggestions(tabs),
    source: "heuristic",
  };
}
