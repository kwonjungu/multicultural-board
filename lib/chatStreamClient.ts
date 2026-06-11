// SSE 챗 스트림을 읽는 클라이언트 헬퍼.
// lib/groq-stream.ts 가 만드는 이벤트(delta/final)를 파싱한다.
// StorybookRoom 챗과 TutorChat 위젯이 함께 사용.

export interface ChatStreamFinal {
  reply: string;
  kind: "normal" | "block" | "distress" | "error";
  model?: string;
}

/**
 * fetch 응답(SSE)을 읽으며 delta 마다 onDelta(누적 텍스트)를 호출하고,
 * final 이벤트를 반환한다. JSON 응답(에러 등)이 오면 그대로 final 로 변환.
 */
export async function readChatStream(
  res: Response,
  onDelta: (accumulated: string) => void,
): Promise<ChatStreamFinal> {
  const contentType = res.headers.get("content-type") || "";

  // 비스트리밍 JSON (400 에러 등) — 옛 형식 호환
  if (contentType.includes("application/json")) {
    const data = await res.json() as Partial<ChatStreamFinal>;
    return {
      reply: data.reply || "",
      kind: (data.kind as ChatStreamFinal["kind"]) || "error",
      model: data.model,
    };
  }

  if (!res.body) return { reply: "", kind: "error" };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let acc = "";
  let final: ChatStreamFinal | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE 이벤트는 빈 줄(\n\n)로 구분
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const rawEvent = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const evt = JSON.parse(dataLine.slice(6)) as
          | { type: "delta"; text: string }
          | ({ type: "final" } & ChatStreamFinal);
        if (evt.type === "delta") {
          acc += evt.text;
          onDelta(acc);
        } else if (evt.type === "final") {
          final = { reply: evt.reply, kind: evt.kind, model: evt.model };
        }
      } catch { /* 깨진 이벤트는 무시 */ }
    }
  }

  if (final) return final;
  // final 없이 끊겼다면 누적분이라도 살린다
  if (acc.trim()) return { reply: acc.trim(), kind: "normal" };
  return { reply: "", kind: "error" };
}
