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
}

export interface ReviewSession {
  reviewId: string;
  tabs: Tab[];
  suggestions: Suggestion[];
  createdAt: string;
  status: "pending" | "reviewed" | "executed";
}

export interface ExecutionResult {
  id: string;
  status: "completed" | "failed";
  actionId?: string;
  error?: string;
  resultUrl?: string | null;
}
