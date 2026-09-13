/**
 * Format an intelligent, concise title for Chrome tab groups and Tabme sessions.
 * Instead of generic timestamps like "Tabme: 1:52 PM", this recognizes the primary
 * domains or activities represented by the open tabs.
 */
export function formatGroupTitle(tabs) {
  if (!tabs || tabs.length === 0) {
    return "🗂️ Tabme Stash";
  }

  // Filter out internal browser / extension pages
  const validTabs = tabs.filter(
    (t) =>
      t.url &&
      !t.url.startsWith("chrome://") &&
      !t.url.startsWith("chrome-extension://") &&
      !t.url.startsWith("edge://") &&
      !t.url.startsWith("about:")
  );

  if (validTabs.length === 0) {
    return `🗂️ Stashed (${tabs.length} tabs)`;
  }

  // Count domain frequencies
  const domainCounts = new Map();
  const domainOriginalName = new Map();

  for (const tab of validTabs) {
    try {
      const parsed = new URL(tab.url);
      const host = parsed.hostname.replace(/^www\./, "");
      const baseName = host.split(".")[0];
      const displayName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      domainCounts.set(displayName, (domainCounts.get(displayName) || 0) + 1);
      if (!domainOriginalName.has(displayName)) {
        domainOriginalName.set(displayName, displayName);
      }
    } catch {
      // ignore
    }
  }

  const sorted = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return `🗂️ Stash (${validTabs.length} tabs)`;
  }

  const [leadName, leadCount] = sorted[0];

  // If all tabs share the same domain (e.g. 4 GitHub tabs)
  if (leadCount === validTabs.length && leadCount > 1) {
    return `📑 ${leadName} (${leadCount})`;
  }

  // Single tab
  if (validTabs.length === 1) {
    const rawTitle = validTabs[0].title || leadName;
    const cleanTitle = rawTitle.length > 22 ? rawTitle.slice(0, 20).trim() + "…" : rawTitle;
    return `📑 ${cleanTitle}`;
  }

  // Exactly two domains
  if (validTabs.length === 2 && sorted.length >= 2) {
    return `📑 ${leadName} & ${sorted[1][0]}`;
  }

  // Mixed group: lead domain + remaining count
  const remaining = validTabs.length - leadCount;
  if (remaining > 0) {
    return `🗂️ ${leadName} + ${remaining} tab${remaining === 1 ? "" : "s"}`;
  }

  return `🗂️ ${leadName} (${validTabs.length})`;
}
