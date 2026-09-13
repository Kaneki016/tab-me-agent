import { captureTabs } from "./utils/tabs.js";

const API_BASE = "http://127.0.0.1:3100";

const captureBtn = document.getElementById("captureBtn");
const statusEl = document.getElementById("status");

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = type;
}

captureBtn.addEventListener("click", async () => {
  setStatus("Capturing tabs…");
  captureBtn.disabled = true;

  try {
    const tabs = await captureTabs();
    if (!tabs.length) {
      throw new Error("No tabs found in this window.");
    }

    setStatus(`Sending ${tabs.length} tabs to Tabme…`);

    const response = await fetch(`${API_BASE}/api/generate-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs }),
    });

    const data = await response.json();
    if (!response.ok || !data.reviewId) {
      throw new Error(data.error || "Backend error");
    }

    const reviewUrl = `${API_BASE}/review/${data.reviewId}`;
    setStatus(`Captured ${tabs.length} tabs.`, "success");

    const link = document.createElement("a");
    link.href = reviewUrl;
    link.target = "_blank";
    link.textContent = "Open review page";
    statusEl.appendChild(document.createTextNode(" "));
    statusEl.appendChild(link);
  } catch (error) {
    console.error(error);
    setStatus(
      error instanceof Error ? error.message : "Failed to capture tabs.",
      "error",
    );
  } finally {
    captureBtn.disabled = false;
  }
});
