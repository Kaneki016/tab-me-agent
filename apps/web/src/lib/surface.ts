import type { SuggestionType, WorkplaceSurface } from "./types";

/**
 * Single source of truth for which Ambiguous record a suggestion type writes to.
 * The extension mirrors this table in `apps/extension/utils/taxonomy.js`; keep
 * both in step so a review can name its destination before anything is written.
 */
export function surfaceFor(type: SuggestionType): WorkplaceSurface {
  switch (type) {
    case "save_note":
    case "create_doc":
      return "doc";
    case "add_competitor":
      return "sheet";
    case "add_crm":
      return "contact";
    case "draft_email":
      return "email draft";
    case "upload_drive":
      return "drive upload";
    default:
      return "task";
  }
}
