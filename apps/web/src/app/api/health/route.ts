import { isModelConfigured, isSearchConfigured, isWorkplaceConfigured } from "agent-core";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return optionsWithCors(request);
}

export async function GET(request: Request) {
  return jsonWithCors(
    {
      ok: true,
      model: isModelConfigured(),
      workplace: isWorkplaceConfigured(),
      search: isSearchConfigured(),
    },
    200,
    request,
  );
}
