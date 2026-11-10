// 빌드 전 검사 — 학생이 접속하는 웹앱 코드에 Gemini API 호출이 없는지 확인한다.
//
// Gemini API 추가 약관: "You also will not use the Services as part of a website,
// application, or other service that is directed towards or is likely to be accessed by
// individuals under the age of 18." 호출하는 사람이 교사인지는 요건이 아니다.
// 그래서 app/ lib/ components/ 전체에서 Gemini 호출 흔적을 금지한다.
// 교사 PC 전용 도구(scripts/)는 검사 대상이 아니다.
//
// 실행: node scripts/check-no-gemini.mjs   (npm run build 가 먼저 실행한다)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["app", "lib", "components"];
const EXT = /\.(ts|tsx|js|jsx|mjs)$/;

// 호출이 성립하려면 반드시 필요한 것들만 본다. 주석의 'Gemini' 설명은 막지 않는다.
const RULES = [
  { name: "Gemini API 주소", re: /generativelanguage\.googleapis\.com/ },
  { name: "Gemini API 키 환경변수", re: /process\.env\.GEMINI_API_KEY/ },
  { name: "Gemini 모듈 import", re: /from\s+["'][^"']*(?:lib\/gemini|scripts\/local\/gemini)["']/ },
  { name: "Google GenAI SDK", re: /["']@google\/(?:genai|generative-ai)["']/ },
  { name: "Vertex AI 주소", re: /aiplatform\.googleapis\.com/ },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

const hits = [];
let files = 0;
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    files++;
    const lines = readFileSync(file, "utf-8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.re.test(line)) hits.push(`${relative(ROOT, file).replace(/\\/g, "/")}:${i + 1}  [${rule.name}]  ${line.trim().slice(0, 120)}`);
      }
    });
  }
}

if (hits.length > 0) {
  console.error(`✗ 웹앱 코드에서 Gemini API 호출 흔적 ${hits.length}건 발견 — 빌드를 중단합니다.`);
  for (const h of hits) console.error("  " + h);
  console.error("학생이 접속하는 웹앱에서는 Gemini API 를 쓰지 않습니다 (CLAUDE.md 가드레일).");
  process.exit(1);
}
console.log(`✓ Gemini API 호출 없음 — ${DIRS.join(", ")} 의 ${files}개 파일 검사`);
