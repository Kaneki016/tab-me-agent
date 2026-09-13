const ALLOWED_HEADERS = "Content-Type";
const ALLOWED_METHODS = "GET, POST, OPTIONS";

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonWithCors(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders() });
}

export function optionsWithCors(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
