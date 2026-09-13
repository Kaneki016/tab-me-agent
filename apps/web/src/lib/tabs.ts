import { z } from "zod";
import type { Tab } from "./types";

const tabSchema = z.object({
  id: z.number().int().positive(),
  url: z
    .string()
    .min(1)
    .max(2_048)
    .refine((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, "Invalid tab URL"),
  title: z.string().max(500).default(""),
  content: z.string().max(5_000).optional(),
  status: z.enum(["captured", "scraped", "unsupported"]).default("captured"),
});

export function parseTabs(input: unknown): Tab[] {
  if (!Array.isArray(input)) {
    throw new Error("No tabs provided");
  }
  return z.array(tabSchema).min(1).max(20).parse(input);
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
