import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/translate/route.ts";

test("translation preserves blank and repeated lines, and handles provider failure", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  process.env.GOOGLE_TRANSLATE_API_KEY = "test-key";
  const request = (lines: unknown) => new Request("http://localhost/api/translate", { method: "POST", body: JSON.stringify({ lines }) });
  try {
    globalThis.fetch = async (_url, options) => {
      assert.deepEqual(JSON.parse(String(options?.body)), { q: ["Hello", "Goodbye"], target: "ko", format: "text" });
      return Response.json({ data: { translations: [{ translatedText: "안녕" }, { translatedText: "잘 가" }] } });
    };
    const response = await POST(request(["Hello", "", "Hello", "Goodbye"]));
    assert.deepEqual(await response.json(), { lines: ["안녕", "", "안녕", "잘 가"] });
    assert.equal((await POST(request([42]))).status, 400);
    globalThis.fetch = async () => new Response(null, { status: 429 });
    assert.equal((await POST(request(["Hello"]))).status, 502);
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
    assert.equal((await POST(request(["Hello"]))).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = originalKey;
  }
});
