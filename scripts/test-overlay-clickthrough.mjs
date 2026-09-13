/**
 * 오버레이 클릭 삼킴 회귀 검사.
 *
 * 2026-09-13 사고: InterpreterDrawer 의 `.itp-sheet` 가 닫힌 상태에서도
 * `position: fixed; inset: 3vh 4vw` 로 화면을 덮은 채 `opacity: 0` 만 걸려
 * 있었다. 눈에는 안 보이지만 판은 그대로 있어서 860px 이상 화면에서 그 아래
 * 홈 허브·동화·소통창의 **모든 클릭을 삼켰다**. InterpreterFab 이
 * app/[roomCode]/page.tsx 에 공통 마운트라 앱 전체가 먹통이 됐다.
 *
 * 계약: 클래스 토글(.on/.open 등)로 여닫는 position:fixed 오버레이는
 *       닫힌 상태에서 pointer-events:none · visibility:hidden · display:none
 *       중 하나를 반드시 가져야 한다. transform/opacity 만으로 숨기면 안 된다.
 *
 *   실행: node scripts/test-overlay-clickthrough.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 줄 주석을 먼저 지운다 — 블록 주석부터 지우면 줄 주석 속 "/*" 가 블록 시작으로
 *  오인되어 뒤 수십 줄이 통째로 사라진다(레포 공통 함정). */
const stripComments = (src) =>
  src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const files = globSync("{components,app}/**/*.tsx", { cwd: root });

/** 닫힘을 실제로 성립시키는 선언들. */
const HIDES = [/pointer-events\s*:\s*none/, /visibility\s*:\s*hidden/, /display\s*:\s*none/];
/** 열림 토글로 인정하는 접미 선택자. */
const OPEN_SUFFIX = /^(\.on|\.open|\.is-open|\.show|\.visible|\[data-open(=("|')?true\2?)?\])$/;

const problems = [];
let overlays = 0;

for (const rel of files) {
  const css = stripComments(readFileSync(resolve(root, rel), "utf8"));

  /** 셀렉터별 선언 모음. `.a`, `.a.on` 을 서로 다른 키로 쌓는다. */
  const decls = new Map();
  for (const m of css.matchAll(/(^|[{};\n])\s*(\.[A-Za-z0-9_.\-[\]="']+)\s*\{([^{}]*)\}/g)) {
    const sel = m[2], body = m[3];
    decls.set(sel, (decls.get(sel) || "") + ";" + body);
  }

  for (const [sel, body] of decls) {
    // 토글 접미가 붙은 쪽(.x.on)은 '열린 상태' 규칙이니 건너뛴다.
    if (/\.[A-Za-z0-9_-]+(\.|\[)/.test(sel.slice(1))) continue;
    if (!/position\s*:\s*fixed/.test(body)) continue;

    // 같은 파일에 `.x.on` 같은 열림 규칙이 있어야 '토글 오버레이'다.
    const openRule = [...decls.keys()].find(
      (k) => k.startsWith(sel) && k.length > sel.length && OPEN_SUFFIX.test(k.slice(sel.length)),
    );
    if (!openRule) continue;

    overlays++;
    if (!HIDES.some((re) => re.test(body))) {
      problems.push(
        `${rel}  ${sel} — 닫힌 상태에 pointer-events:none / visibility:hidden / ` +
          `display:none 이 없다. transform·opacity 만으로 숨기면 투명한 판이 ` +
          `그 아래 화면의 클릭을 전부 삼킨다.`,
      );
    }
    // 열린 상태가 닫힘 선언을 되돌리는지도 본다.
    const openBody = decls.get(openRule) || "";
    if (/pointer-events\s*:\s*none/.test(body) && !/pointer-events\s*:\s*auto/.test(openBody)) {
      problems.push(`${rel}  ${openRule} — 열렸는데 pointer-events:auto 로 되돌리지 않는다.`);
    }
    if (/visibility\s*:\s*hidden/.test(body) && !/visibility\s*:\s*visible/.test(openBody)) {
      problems.push(`${rel}  ${openRule} — 열렸는데 visibility:visible 로 되돌리지 않는다.`);
    }
  }
}

console.log(`토글 오버레이 ${overlays}개 검사`);
if (problems.length) {
  console.log("\n문제:");
  for (const m of problems) console.log("  -", m);
  console.log(`\n${problems.length}건 실패`);
  process.exitCode = 1;
} else {
  console.log("모두 닫힌 상태에서 클릭을 통과시킨다");
}
