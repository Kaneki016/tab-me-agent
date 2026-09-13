export type WorkplaceRecordKind =
  | "task"
  | "document"
  | "sheet"
  | "contact"
  | "draft_email";

export type WorkplaceRecord = {
  kind: WorkplaceRecordKind;
  id: string;
  title: string;
  url: string | null;
};
