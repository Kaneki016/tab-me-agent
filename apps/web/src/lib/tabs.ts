import { z } from "zod";
import type { Tab } from "./types";

const tabSchema = z.object({
  id: z.number(),
  url: z.string(),
  title: z.string().default(""),
  content: z.string().optional(),
  status: z.enum(["captured", "scraped", "unsupported"]).default("captured"),
});

export function parseTabs(input: unknown): Tab[] {
  if (!Array.isArray(input)) {
    throw new Error("No tabs provided");
  }
  const tabs = z.array(tabSchema).min(1).parse(input);
  return tabs.map((tab) => ({
    ...tab,
    content: tab.content?.slice(0, 5000),
  }));
}

export const SAMPLE_TABS: Tab[] = [
  {
    id: 1,
    url: "https://nextjs.org/docs",
    title: "Next.js Documentation",
    status: "captured",
  },
  {
    id: 2,
    url: "https://react.dev/learn",
    title: "Learn React",
    status: "scraped",
    content: "Learn React with interactive examples and official guides.",
  },
  {
    id: 3,
    url: "https://linear.app",
    title: "Linear — issue tracking",
    status: "captured",
  },
  {
    id: 4,
    url: "chrome://extensions",
    title: "Extensions",
    status: "unsupported",
  },
  {
    id: 5,
    url: "https://docs.copilotkit.ai/",
    title: "CopilotKit Docs",
    status: "captured",
  },
];
