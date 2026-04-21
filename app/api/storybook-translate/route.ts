import { NextRequest, NextResponse } from "next/server";
import { translateBatch } from "@/lib/groq-translate";
import { LANGUAGES } from "@/lib/constants";

// Light single-text translator for storybook responses. Reuses the existing
// Groq multi-model fallback pipeline. Returns plain strings — no safety
// flagging, no Firebase writes.

interface Req {
  texts: string[];
  fromLang: string;
  toLang: string;
}

interface Resp {
  ok: boolean;
  translated?: string[];
  error?: string;
}

function langName(code: string): string {
  const entry = LANGUAGES[code as keyof typeof LANGUAGES];
  if (entry && typeof entry === "object" && "name" in entry) {
    return (entry as { name: string }).name;
  }
  return code;
}

export async function POST(req: NextRequest) {
  let body: Req;
  try { body = await req.json() as Req; } catch {
    return NextResponse.json<Resp>({ ok: false, error: "bad json" }, { status: 400 });
  }
  const texts = (body?.texts || []).filter((t) => typeof t === "string");
  const fromLang = body?.fromLang;
  const toLang = body?.toLang;
  if (texts.length === 0 || !fromLang || !toLang) {
    return NextResponse.json<Resp>({ ok: false, error: "missing texts/fromLang/toLang" }, { status: 400 });
  }
  if (fromLang === toLang) {
    return NextResponse.json<Resp>({ ok: true, translated: texts });
  }
  try {
    const translated = await translateBatch(texts, fromLang, toLang, langName(fromLang), langName(toLang));
    return NextResponse.json<Resp>({ ok: true, translated });
  } catch (err) {
    console.error("storybook-translate failed", err);
    return NextResponse.json<Resp>({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
