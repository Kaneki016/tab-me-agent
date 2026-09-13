/**
 * Extension-side mirror of the backend triage taxonomy.
 *
 * Categories come from packages/agent-core/src/capabilities/triage.ts,
 * suggestion types from apps/web/src/lib/types.ts, and the type -> Ambiguous
 * surface routing from apps/web/src/lib/surface.ts. Suggestions carry their own
 * `surface` field; the local table is only a fallback for reviews created
 * before that field existed.
 */

/** Display order for category groups: most decision-worthy first. */
export const CATEGORY_ORDER = [
  "follow_up",
  "competitor",
  "research",
  "learning",
  "reference",
];

export const CATEGORY_LABELS = {
  follow_up: "Follow-up",
  competitor: "Competitive",
  research: "Research",
  learning: "Learning",
  reference: "Reference",
};

export const TYPE_LABELS = {
  create_task: "Task",
  save_note: "Note",
  create_doc: "Document",
  add_competitor: "Competitor row",
  add_crm: "CRM contact",
  draft_email: "Email draft",
  upload_drive: "Drive upload",
};

const SURFACE_BY_TYPE = {
  create_task: "task",
  save_note: "doc",
  create_doc: "doc",
  add_competitor: "sheet",
  add_crm: "contact",
  draft_email: "email draft",
  upload_drive: "drive upload",
};

/** What the user will see created in Ambiguous, singular and plural. */
export const SURFACE_LABELS = {
  task: { one: "Ambiguous task", many: "Ambiguous tasks" },
  doc: { one: "Ambiguous doc", many: "Ambiguous docs" },
  sheet: { one: "Ambiguous sheet", many: "Ambiguous sheets" },
  contact: { one: "Ambiguous contact", many: "Ambiguous contacts" },
  "email draft": { one: "Ambiguous email draft", many: "Ambiguous email drafts" },
  "drive upload": { one: "Drive upload", many: "Drive uploads" },
};

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] ?? "Uncategorized";
}

export function typeLabel(type) {
  return TYPE_LABELS[type] ?? String(type ?? "").replaceAll("_", " ");
}

export function surfaceOf(suggestion) {
  return suggestion?.surface ?? SURFACE_BY_TYPE[suggestion?.type] ?? "task";
}

export function surfaceLabel(surface, count = 1) {
  const entry = SURFACE_LABELS[surface];
  if (!entry) return surface;
  return count === 1 ? entry.one : entry.many;
}

/** Groups suggestions into category buckets, preserving backend order within each. */
export function groupByCategory(suggestions) {
  const buckets = new Map();
  for (const suggestion of suggestions) {
    const key = suggestion.category ?? "follow_up";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(suggestion);
  }

  const ordered = [];
  for (const category of CATEGORY_ORDER) {
    if (buckets.has(category)) {
      ordered.push({ category, items: buckets.get(category) });
      buckets.delete(category);
    }
  }
  for (const [category, items] of buckets) {
    ordered.push({ category, items });
  }
  return ordered;
}

/** "2 Ambiguous tasks and 1 Ambiguous sheet" for an execution summary. */
export function summarizeSurfaces(results) {
  const counts = new Map();
  for (const result of results) {
    const surface = result.surface ?? "task";
    counts.set(surface, (counts.get(surface) ?? 0) + 1);
  }

  const parts = [...counts].map(
    ([surface, count]) => `${count} ${surfaceLabel(surface, count)}`,
  );
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
