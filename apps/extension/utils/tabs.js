export async function captureTabs() {
  const chromeTabs = await chrome.tabs.query({ currentWindow: true });

  const tabs = chromeTabs.map((tab) => {
    const base = {
      id: tab.id,
      url: tab.url || "",
      title: tab.title || "",
      status: "captured",
    };

    if (
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      return { ...base, status: "unsupported" };
    }

    return base;
  });

  const scrapable = tabs.filter((tab) => tab.status === "captured").slice(0, 3);
  for (const tab of scrapable) {
    try {
      tab.content = await scrapeTab(tab.id);
      tab.status = "scraped";
    } catch {
      tab.status = "captured";
    }
  }

  return tabs;
}

async function scrapeTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.body?.innerText ?? "",
  });
  return String(results[0]?.result || "").slice(0, 5000);
}
