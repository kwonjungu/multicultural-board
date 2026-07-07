"use client";

// [항목 5] 일본어 후리가나 — 서버(/api/furigana, LLM)가 만든 세그먼트를
// 원문 복원 검증 후 <ruby> 로 렌더. 변환 결과는 RTDB furigana_cache/{hash} 에
// 영구 캐시 (책 텍스트는 불변). 검증 실패·API 실패 시 평문 폴백.

import React, { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { getClientDb } from "./firebase-client";

// 순수 함수는 furiganaCore.ts 에서 — node --test 가 JSX 파싱을 못 하므로 분리
export { validateRuby, hashText, type RubySeg } from "./furiganaCore";
import { validateRuby, hashText, type RubySeg } from "./furiganaCore";

async function fetchFurigana(text: string): Promise<RubySeg[] | null> {
  const db = getClientDb();
  const key = hashText(text);
  const cacheRef = ref(db, `furigana_cache/${key}`);
  try {
    const snap = await get(cacheRef);
    const cached = snap.val() as RubySeg[] | null;
    if (cached && validateRuby(text, cached)) return cached;
  } catch { /* 캐시 실패는 무시 */ }
  try {
    const res = await fetch("/api/furigana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text] }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; ruby?: (RubySeg[] | null)[] };
    const segs = data.ok ? data.ruby?.[0] ?? null : null;
    if (segs && validateRuby(text, segs)) {
      set(cacheRef, segs).catch(() => {}); // 표시용 부가 쓰기 — fire-and-forget
      return segs;
    }
  } catch { /* 폴백 */ }
  return null;
}

/** ja 텍스트의 후리가나 세그먼트. 로딩 중/실패/비활성은 null (평문 표시). */
export function useFurigana(text: string | null, enabled: boolean): RubySeg[] | null {
  const [segs, setSegs] = useState<RubySeg[] | null>(null);
  useEffect(() => {
    setSegs(null);
    if (!enabled || !text || !/[一-鿿]/.test(text)) return; // 한자 없으면 불필요
    let cancel = false;
    fetchFurigana(text).then((r) => { if (!cancel) setSegs(r); });
    return () => { cancel = true; };
  }, [text, enabled]);
  return segs;
}

/** ruby 렌더 — segs 없으면 fallback 평문. */
export function RubyText({ segs, fallback }: { segs: RubySeg[] | null; fallback: string }) {
  if (!segs) return <>{fallback}</>;
  return (
    <>
      {segs.map((s, i) =>
        s.r ? (
          <ruby key={i}>
            {s.t}
            <rt style={{ fontSize: "0.5em", fontWeight: 600 }}>{s.r}</rt>
          </ruby>
        ) : (
          <React.Fragment key={i}>{s.t}</React.Fragment>
        ),
      )}
    </>
  );
}
