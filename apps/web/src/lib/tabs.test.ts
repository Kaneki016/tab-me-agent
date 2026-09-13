import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTabs } from "./tabs";

test("accepts Chrome-supported URL schemes and caps captures at twenty tabs", () => {
  const chrome = parseTabs([
    { id: 1, url: "chrome://settings", title: "Settings", status: "unsupported" },
  ]);
  assert.equal(chrome[0]?.status, "unsupported");

  const tabs = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    url: `https://example.com/${index}`,
    title: `Tab ${index}`,
    status: "captured" as const,
  }));
  assert.throws(() => parseTabs(tabs));
});
