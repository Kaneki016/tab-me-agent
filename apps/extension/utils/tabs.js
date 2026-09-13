import { browserApi } from "./browser-runtime.js";

export async function captureTabs() {
  const capturedTabs = await browserApi.tabs.query({ currentWindow: true });

  const tabs = capturedTabs.map((tab) => {
    const base = {
      id: tab.id,
      url: tab.url || "",
      title: tab.title || "",
      favIconUrl: tab.favIconUrl || "",
      status: "captured",
    };

    if (
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("moz-extension://") ||
      tab.url.startsWith("about:") ||
      tab.url.startsWith("edge://")
    ) {
      return { ...base, status: "unsupported" };
    }

    return base;
  });

  const scrapable = tabs.filter((tab) => tab.status === "captured").slice(0, 3);
  await Promise.all(
    scrapable.map(async (tab) => {
      try {
        tab.content = await Promise.race([
          scrapeTab(tab.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 400)),
        ]);
        tab.status = "scraped";
      } catch {
        tab.status = "captured";
      }
    })
  );

  return tabs;
}

async function scrapeTab(tabId) {
  const results = await browserApi.scripting.executeScript({
    target: { tabId },
    func: () => document.body?.innerText ?? "",
  });
  return String(results[0]?.result || "").slice(0, 5000);
}
