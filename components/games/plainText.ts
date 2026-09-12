// [게임 UI i18n — 병기 없는 짧은 라벨]
//
// uiText.ts 의 gt() 는 학습을 위해 "Replay (다시 듣기)" 처럼 한국어를 괄호로
// 덧붙인다. 문제 지문·제목·안내문에는 맞지만, 카드마다 반복되는 작은 동작
// 버튼에 붙으면 라벨이 두 배가 되어 한 줄에 하나씩 쌓이고 넓은 화면에서
// 카드가 세로로 한없이 길어진다. 그런 자리에서만 gt() 대신 이 함수를 쓴다.
//
// uiText.ts 는 공유 파일이라 손대지 않는다 — 사전은 그대로 두고 호출만 바꾼다.
// (lib/i18n.ts 의 t() / tPlain() 관계와 같은 규칙이다.)
import type { LangMap } from "./uiText";

export function gp(map: LangMap, lang: string): string {
  return map[lang] ?? map.en ?? map.ko ?? Object.values(map)[0] ?? "";
}
