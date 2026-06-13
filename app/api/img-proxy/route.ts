import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// 브라우저에서 Firebase Storage 이미지를 직접 fetch 하면 버킷 CORS 설정이 없으면
// 막힌다(그림책 PPT 내보내기에서 사진이 빠지는 원인). 서버에서 대신 받아 그대로
// 흘려보내 같은-오리진으로 만들어 준다. SSRF 방지를 위해 호스트 화이트리스트.
const ALLOWED_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString(), { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "image/png";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("img-proxy 오류:", err);
    return NextResponse.json({ error: "fetch 실패" }, { status: 502 });
  }
}
