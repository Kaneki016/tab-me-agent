import { triageTabs, type TriageSuggestion } from "agent-core";
import { surfaceFor } from "./surface";
import type { Suggestion, SuggestionSource, SuggestionType, Tab, TaskCategory } from "./types";

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

/** Mail composers and threads: a reply draft is more useful than a generic task. */
const EMAIL_PATTERN = /mail\.google\.com|outlook\.(office|live)\.com|\bcompose\b|\bmailto:/;
/** Person or company profile pages: the model's "add_crm" heuristic equivalent. */
const CRM_PATTERN =
  /linkedin\.com\/(in|company)\/|crunchbase\.com\/(person|organization)\/|pitchbook\.com\/profiles\//;

/**
 * Type is derived from URL/title signals first (email, CRM), then category,
 * mirroring the model triage taxonomy so the heuristic fallback can still
 * produce draft_email / add_crm suggestions instead of only create_task and
 * add_competitor.
 */
function typeFor(category: TaskCategory, tab: Tab): SuggestionType {
  const text = `${tab.title} ${tab.url}`.toLowerCase();
  if (EMAIL_PATTERN.test(text)) return "draft_email";
  if (CRM_PATTERN.test(text)) return "add_crm";
  switch (category) {
    case "reference":
      return "save_note";
    case "competitor":
      return "add_competitor";
    default:
      return "create_task";
  }
}

function actionFor(type: SuggestionType, category: TaskCategory, tab: Tab): string {
  const subject = tab.title || new URL(tab.url).hostname;
  switch (type) {
    case "draft_email":
      return `Draft reply: ${subject}`;
    case "add_crm":
      return `Log contact: ${subject}`;
    case "save_note":
      return `Review reference: ${subject}`;
    case "add_competitor":
      return `Assess competitor: ${subject}`;
    default:
      switch (category) {
        case "learning":
          return `Study: ${subject}`;
        case "research":
          return `Research: ${subject}`;
        default:
          return `Follow up: ${subject}`;
      }
  }
}

function descriptionFor(type: SuggestionType, category: TaskCategory): string {
  switch (type) {
    case "draft_email":
      return "Draft a reply so this thread doesn't go stale.";
    case "add_crm":
      return "Log this contact so outreach and account context isn't lost.";
    default:
      return `Turn the captured tab into a concrete ${category.replace("_", " ")} follow-up.`;
  }
}

function routedSuggestion(
  title: string,
  description: string,
  category: TaskCategory,
  type: SuggestionType,
  urls: string[],
  confidence: number,
): Suggestion {
  return {
    id: nextId(),
    type,
    category,
    surface: surfaceFor(type),
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
    type: item.type,
    category: item.category,
    surface: surfaceFor(item.type),
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
  const perTab = pool.slice(0, 4).map((tab) => {
    const category = categoryFor(tab);
    const type = typeFor(category, tab);
    return { tab, category, type };
  });

  const suggestions = perTab.map(({ tab, category, type }) =>
    routedSuggestion(
      actionFor(type, category, tab),
      descriptionFor(type, category),
      category,
      type,
      [tab.url],
      0.62,
    ),
  );

  if (pool.length >= 3 && suggestions.length < 5) {
    // Several research/reference tabs read better as one brief than as
    // separate tasks — this is the heuristic equivalent of the model's
    // "create_doc: deeper research brief when several sources should
    // become one doc" rule, so doc-shaped fallbacks aren't model-only.
    const docWorthy = pool.filter((tab) => {
      const category = categoryFor(tab);
      return category === "research" || category === "reference";
    });

    if (docWorthy.length >= 3) {
      suggestions.push(
        routedSuggestion(
          `Draft a brief from ${docWorthy.length} research tabs`,
          "Combine these sources into one shared doc instead of leaving them as loose tabs.",
          "research",
          "create_doc",
          docWorthy.map((tab) => tab.url),
          0.6,
        ),
      );
    } else {
      suggestions.push(
        routedSuggestion(
          `Prioritize ${pool.length} captured tabs`,
          "Review the captured sources together and decide the next three actions.",
          "follow_up",
          "create_task",
          pool.map((tab) => tab.url),
          0.55,
        ),
      );
    }
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
