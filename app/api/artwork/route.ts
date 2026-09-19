import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");
  let url: URL;
  try {
    url = new URL(source ?? "");
    if (url.protocol !== "https:" || !/^is\d+-ssl\.mzstatic\.com$/.test(url.hostname) ||
      url.port || url.username || url.password || !url.pathname.startsWith("/image/thumb/")) throw new Error("Invalid artwork");
  } catch { return NextResponse.json({ error: "Invalid artwork URL." }, { status: 400 }); }
  try {
    const response = await fetch(url, { redirect: "error", next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000) });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(jpeg|png|webp)(;|$)/.test(contentType)) throw new Error("Invalid image response");
    return new Response(response.body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "Artwork is unavailable." }, { status: 502 }); }
}
