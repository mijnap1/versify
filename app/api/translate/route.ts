export async function POST(request: Request) {
  let lines: unknown;
  try { ({ lines } = await request.json()); }
  catch { return Response.json({ error: "Invalid lyrics." }, { status: 400 }); }
  if (!Array.isArray(lines) || lines.length > 400 || !lines.every((line) => typeof line === "string" && line.length <= 2000) || lines.join("").length > 30000) {
    return Response.json({ error: "Invalid lyrics." }, { status: 400 });
  }
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) return Response.json({ error: "Korean translation isn't connected yet." }, { status: 503 });
  const unique = [...new Set((lines as string[]).filter((line) => line.trim()))];
  const translated = new Map<string, string>();
  try {
    for (let start = 0; start < unique.length; start += 50) {
      const batch = unique.slice(start, start + 50);
      const response = await fetch("https://translation.googleapis.com/language/translate/v2", {
        method: "POST", headers: { "X-Goog-Api-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: batch, target: "ko", format: "text" }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok) throw new Error("Translation service unavailable");
      const data = await response.json();
      const results = data.data?.translations;
      if (!Array.isArray(results) || results.length !== batch.length || !results.every((item: { translatedText?: unknown }) => typeof item?.translatedText === "string")) throw new Error("Invalid translation");
      batch.forEach((line, index) => translated.set(line, results[index].translatedText));
    }
    return Response.json({ lines: (lines as string[]).map((line) => translated.get(line) ?? "") });
  } catch {
    return Response.json({ error: "Translation couldn't be loaded. Toggle translation off and on to try again." }, { status: 502 });
  }
}
