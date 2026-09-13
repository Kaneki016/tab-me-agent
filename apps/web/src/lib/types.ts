export type TabStatus = "captured" | "scraped" | "unsupported";

export type SuggestionType =
  | "create_task"
  | "save_note"
  | "add_competitor"
  | "draft_email"
  | "create_doc"
  | "add_crm"
  | "upload_drive";

export type SuggestionStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type TaskCategory =
  | "learning"
  | "research"
  | "competitor"
  | "reference"
  | "follow_up";

export type ExecutionMode = "real" | "mock";

export type SuggestionSource = "model" | "heuristic";

export interface Tab {
  id: number;
  url: string;
  title: string;
  content?: string;
  status: TabStatus;
}

export interface Suggestion {
  id: string;
  type: SuggestionType;
  category: TaskCategory;
  status: SuggestionStatus;
  data: Record<string, unknown>;
  editable: boolean;
  title: string;
  description?: string;
  dueDate?: string;
  confidence?: number;
  error?: string;
  actionId?: string;
  resultUrl?: string | null;
  mode?: ExecutionMode;
  modeReason?: string;
}

export interface ReviewSession {
  reviewId: string;
  tabs: Tab[];
  suggestions: Suggestion[];
  createdAt: string;
  status: "pending" | "reviewed" | "executed";
  source?: SuggestionSource;
}

export interface ExecutionResult {
  id: string;
  status: "completed" | "failed" | "skipped";
  actionId?: string;
  error?: string;
  resultUrl?: string | null;
  mode?: ExecutionMode;
  modeReason?: string;
}
