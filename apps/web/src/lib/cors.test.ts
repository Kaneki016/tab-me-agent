import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { corsHeaders, isAllowedOrigin } from "./cors";

const ORIGINAL = {
  CORS_ALLOW_ALL: process.env.CORS_ALLOW_ALL,
  CHROME_EXTENSION_ORIGIN: process.env.CHROME_EXTENSION_ORIGIN,
};

afterEach(() => {
  if (ORIGINAL.CORS_ALLOW_ALL === undefined) delete process.env.CORS_ALLOW_ALL;
  else process.env.CORS_ALLOW_ALL = ORIGINAL.CORS_ALLOW_ALL;
  if (ORIGINAL.CHROME_EXTENSION_ORIGIN === undefined) {
    delete process.env.CHROME_EXTENSION_ORIGIN;
  } else {
    process.env.CHROME_EXTENSION_ORIGIN = ORIGINAL.CHROME_EXTENSION_ORIGIN;
  }
});

test("allows chrome-extension and loopback 3100 origins", () => {
  assert.equal(isAllowedOrigin("chrome-extension://abcdef"), true);
  assert.equal(isAllowedOrigin("moz-extension://abcdef-1234"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3100"), true);
  assert.equal(isAllowedOrigin("http://localhost:3100"), true);
  assert.equal(isAllowedOrigin("https://evil.example"), false);
});

test("reflects allowed origins and omits disallowed ones", () => {
  delete process.env.CORS_ALLOW_ALL;
  const allowed = corsHeaders(
    new Request("http://127.0.0.1:3100/api/health", {
      headers: { Origin: "chrome-extension://abcdef" },
    }),
  ) as Record<string, string>;
  assert.equal(allowed["Access-Control-Allow-Origin"], "chrome-extension://abcdef");

  const blocked = corsHeaders(
    new Request("http://127.0.0.1:3100/api/health", {
      headers: { Origin: "https://evil.example" },
    }),
  ) as Record<string, string>;
  assert.equal(blocked["Access-Control-Allow-Origin"], undefined);
});
