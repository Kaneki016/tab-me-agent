const ALLOWED_HEADERS = "Content-Type";
const ALLOWED_METHODS = "GET, POST, OPTIONS";

const LOOPBACK_ORIGINS = new Set([
  "http://127.0.0.1:3100",
  "http://localhost:3100",
]);

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (LOOPBACK_ORIGINS.has(origin)) return true;
  if (origin.startsWith("chrome-extension://")) return true;
  const extra = process.env.CHROME_EXTENSION_ORIGIN?.trim();
  if (extra && origin === extra) return true;
  return false;
}

export function corsHeaders(request?: Request): HeadersInit {
  const loose = process.env.CORS_ALLOW_ALL === "true";
  const origin = request?.headers.get("Origin");

  if (loose || !origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Max-Age": "86400",
    };
  }

  if (isAllowedOrigin(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Max-Age": "86400",
    };
  }

  return {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonWithCors(body: unknown, status = 200, request?: Request): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

export function optionsWithCors(request?: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
