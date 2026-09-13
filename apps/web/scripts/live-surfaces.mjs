/** One-off live smoke test for each routed Ambiguous surface. */
import { executeAction } from "../src/lib/actions.ts";

const reviewId = "rev_live_smoke_test";

const cases = [
  {
    id: "sug_live_doc",
    type: "save_note",
    category: "reference",
    status: "pending_review",
    data: { title: "Tabme live test: reference note", urls: ["https://example.com/docs"] },
    editable: true,
    title: "Tabme live test: reference note",
    description: "Smoke test for save_note → create_document",
  },
  {
    id: "sug_live_crm",
    type: "add_crm",
    category: "follow_up",
    status: "pending_review",
    data: { title: "Tabme Live Test Co", urls: ["https://tabme-live-test.example"] },
    editable: true,
    title: "Tabme Live Test Co",
    description: "Smoke test for add_crm → create_contact",
  },
  {
    id: "sug_live_mail",
    type: "draft_email",
    category: "follow_up",
    status: "pending_review",
    data: {
      title: "Follow up: Tabme live test",
      subject: "Tabme live test draft",
      urls: ["https://example.com/partnership"],
    },
    editable: true,
    title: "Draft: Tabme live test",
    description: "Smoke test for draft_email → create_draft_email",
  },
];

for (const suggestion of cases) {
  const result = await executeAction(suggestion, reviewId);
  console.log(suggestion.type, "→", result.status, result.surface, result.actionId ?? "", result.error ?? "");
}
