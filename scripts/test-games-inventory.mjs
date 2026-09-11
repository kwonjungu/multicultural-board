/**
 * 등록된 게임 전수 정적 점검 — HARNESS GAMES-ALL 의 정적 절반.
 *
 * 게임 수를 하드코딩하지 않는다. `components/GameRoom.tsx` 의 `GAMES` 배열을
 * 읽어 id → 컴포넌트 → 파일(디렉터리 게임은 하위 파일 전부)을 해석한 뒤,
 * 각 게임 파일에 대해 다음을 검사한다.
 *
 *   px-font     고정 px 글자 크기 0개            (README §4.1)
 *   timer       setTimeout/setInterval 에 대응하는 clear 존재
 *   audio-stop  새 음성 재생 전에 이전 음성 정리
 *   audio-unmount  unmount cleanup 에서 음성 정리
 *   audioctx    new AudioContext 직접 생성 없음   (CLAUDE.md 가드레일)
 *   guide       인원·시간·한 문장 규칙·연습 1문제 메타데이터 존재 (README §9)
 *
 * 이 스크립트는 **검사를 느슨하게 만들어 통과시키지 않는다**. 통과하지 못한
 * 게임은 fail 로 남고 목록으로 출력된다. 브라우저 smoke(시작/한 행동/나가기/
 * 재시작)는 여기서 대신 주장하지 않는다 — 별도 UI 하네스의 몫이다.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMEROOM = join(ROOT, 'components/GameRoom.tsx');
const GAMES_DIR = join(ROOT, 'components/games');

const shellSrc = readFileSync(GAMEROOM, 'utf8');

/* ── 1. 등록된 게임 id 집합을 GAMES 에서 뽑는다 (개수 가정 없음) ───────── */
const arrayStart = shellSrc.indexOf('const GAMES: GameMeta[] = [');
if (arrayStart < 0) { console.error('FAIL GAMES 배열을 찾지 못했다 — GameRoom.tsx 구조가 바뀌었다'); process.exit(1); }
const arrayEnd = shellSrc.indexOf('\n];', arrayStart);
const arrayBody = shellSrc.slice(arrayStart, arrayEnd);

const registered = [];
for (const line of arrayBody.split('\n')) {
  const id = line.match(/\bid:\s*"([^"]+)"/);
  const cmp = line.match(/\bcmp:\s*([A-Za-z0-9_]+)/);
  if (id && cmp) registered.push({ id: id[1], cmp: cmp[1] });
}
if (registered.length === 0) { console.error('FAIL GAMES 항목을 하나도 읽지 못했다'); process.exit(1); }

/* ── 2. 컴포넌트 이름 → 소스 파일 ─────────────────────────────────────── */
const importPath = new Map();
for (const m of shellSrc.matchAll(/import\s+([A-Za-z0-9_]+)\s+from\s+"\.\/games\/([^"]+)"/g)) importPath.set(m[1], m[2]);
for (const m of shellSrc.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*dynamic\(\s*\(\)\s*=>\s*import\("\.\/games\/([^"]+)"\)/g)) importPath.set(m[1], m[2]);

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...collect(p));
    else if (/\.(tsx?|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

function filesFor(cmp) {
  const rel = importPath.get(cmp);
  if (!rel) return null;
  const asFile = join(GAMES_DIR, `${rel}.tsx`);
  if (existsSync(asFile)) return [asFile];
  const asFileTs = join(GAMES_DIR, `${rel}.ts`);
  if (existsSync(asFileTs)) return [asFileTs];
  const asDir = join(GAMES_DIR, rel);
  if (existsSync(asDir) && statSync(asDir).isDirectory()) return collect(asDir);
  return null;
}

/* ── 3. 안내 메타데이터 (게임 수를 세지 않고 id 집합으로만 비교) ───────── */
const guideSrc = readFileSync(join(GAMES_DIR, 'gameMeta.ts'), 'utf8');
const guideIds = new Set();
{
  const start = guideSrc.indexOf('export const GAME_GUIDES');
  const body = guideSrc.slice(start);
  for (const m of body.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\{/gm)) guideIds.add(m[1]);
}
const REQUIRED_GUIDE_FIELDS = ['kind', 'players', 'minutes', 'rule', 'practice'];

/* ── 4. 파일 단위 정적 검사 ───────────────────────────────────────────── */
// 주석 안의 우연한 일치(가드레일을 설명하는 주석 등)를 코드로 세지 않는다.
// CRLF 파일에서도 동작해야 한다 — JS 의 `.` 은 \r 을 매치하지 않으므로
// `/^\s*\/\/.*$/` 만으로는 줄 주석이 지워지지 않는다 (marbleSfx/yutSfx 오탐 원인).
const stripComments = (src) => src
  .replace(/\r/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((l) => (/^\s*\/\//.test(l) ? '' : l))
  .join('\n');

function pxFontHits(src) {
  const hits = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    // JSX inline: fontSize: 13  /  fontSize: "13px"  /  fontSize: `13px`
    for (const m of line.matchAll(/fontSize:\s*(?:"|'|`)?(\d+(?:\.\d+)?)(px)?(?:"|'|`)?/g)) {
      if (m[2] || !/fontSize:\s*(?:"|'|`)/.test(m[0])) hits.push(`${i + 1}: ${m[0].trim()}`);
    }
    // CSS 문자열: font-size: 13px
    for (const m of line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) hits.push(`${i + 1}: ${m[0].trim()}`);
  });
  return hits;
}

function checkFiles(files) {
  const problems = [];
  let sawTimer = false, sawClear = false;
  let sawAudio = false, sawStop = false, sawUnmountStop = false;
  const pxAll = [];

  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    const src = stripComments(raw);
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');

    for (const h of pxFontHits(raw)) pxAll.push(`${rel}:${h}`);

    if (/\b(window\.)?setTimeout\s*\(/.test(src) || /\b(window\.)?setInterval\s*\(/.test(src)) sawTimer = true;
    if (/\b(window\.)?clearTimeout\s*\(/.test(src) || /\b(window\.)?clearInterval\s*\(/.test(src)) sawClear = true;

    // 음성: HTMLAudioElement 직접 생성 또는 Web Speech / ttsMulti 경유
    if (/new Audio\s*\(/.test(src) || /speechSynthesis/.test(src) || /from "@\/lib\/tts/.test(src)) sawAudio = true;
    if (/\.pause\s*\(/.test(src) || /speechSynthesis\.cancel/.test(src) || /\bstopSpeak\s*\(/.test(src)) sawStop = true;
    // unmount cleanup 안에서 정리하는가: `return () => ...` 뒤 가까이에 pause/cancel/stop
    if (/return\s*\(\s*\)\s*=>[\s\S]{0,400}?(\.pause\s*\(|speechSynthesis\.cancel|\bstop(?:Audio|Speak|Tts|Sound|Voice)\w*\s*\()/.test(src)) sawUnmountStop = true;

    if (/new\s+AudioContext\s*\(/.test(src) || /new\s+\(?\s*window\s*(as[^)]*)?\)?\.(webkit)?AudioContext/.test(src)
        || /\(window as any\)\.AudioContext/.test(src)) {
      problems.push(`audioctx: ${rel} 에서 AudioContext 를 직접 만든다 (lib/gameSfx.ts 싱글턴을 쓸 것)`);
    }
  }

  if (pxAll.length) problems.push(`px-font: 고정 px 글자 크기 ${pxAll.length}곳 — ${pxAll.slice(0, 4).join(' | ')}${pxAll.length > 4 ? ` …외 ${pxAll.length - 4}곳` : ''}`);
  if (sawTimer && !sawClear) problems.push('timer: setTimeout/setInterval 은 있는데 clearTimeout/clearInterval 이 없다');
  if (sawAudio && !sawStop) problems.push('audio-stop: 음성을 재생하는데 이전 음성을 멈추는 코드가 없다');
  if (sawAudio && !sawUnmountStop) problems.push('audio-unmount: unmount cleanup 에서 음성을 정리하지 않는다');
  return problems;
}

/* ── 5. 실행 ──────────────────────────────────────────────────────────── */
const rows = [];
const failed = [];
for (const g of registered) {
  const files = filesFor(g.cmp);
  if (!files) {
    failed.push({ id: g.id, problems: [`resolve: ${g.cmp} 의 소스 파일을 찾지 못했다`] });
    rows.push({ id: g.id, files: 0, status: 'FAIL' });
    continue;
  }
  const problems = checkFiles(files);
  if (!guideIds.has(g.id)) {
    problems.push(`guide: components/games/gameMeta.ts 의 GAME_GUIDES 에 "${g.id}" 안내(인원·시간·규칙·연습문제)가 없다`);
  }
  if (problems.length) failed.push({ id: g.id, problems });
  rows.push({ id: g.id, files: files.length, status: problems.length ? 'FAIL' : 'PASS' });
}

// 안내만 남고 게임은 사라진 경우
const orphans = [...guideIds].filter((id) => !registered.some((g) => g.id === id));

// 안내 항목 자체가 필수 필드를 갖췄는지
const guideFieldProblems = [];
for (const id of guideIds) {
  const start = guideSrc.indexOf(`\n  ${id}: {`);
  const body = guideSrc.slice(start, guideSrc.indexOf('\n  },', start));
  for (const field of REQUIRED_GUIDE_FIELDS) {
    if (!new RegExp(`\\b${field}:`).test(body)) guideFieldProblems.push(`${id}.${field} 없음`);
  }
}

console.log(`등록된 게임 ${registered.length}개 (GameRoom.tsx GAMES 에서 추출 — 개수는 하드코딩하지 않음)`);
console.log(`검사한 게임 id: ${registered.map((g) => g.id).join(', ')}\n`);
console.table(rows);

if (failed.length) {
  console.log(`\n실패 ${failed.length}/${registered.length}:`);
  for (const f of failed) {
    console.log(`\n  [FAIL] ${f.id}`);
    for (const p of f.problems) console.log(`    - ${p}`);
  }
}
if (orphans.length) console.log(`\n등록되지 않은 안내 항목: ${orphans.join(', ')}`);
if (guideFieldProblems.length) console.log(`\n안내 필수 항목 누락: ${guideFieldProblems.join(', ')}`);

const pass = rows.filter((r) => r.status === 'PASS').map((r) => r.id);
console.log(`\nPASS ${pass.length}/${registered.length}: ${pass.join(', ') || '(없음)'}`);

const bad = failed.length + orphans.length + guideFieldProblems.length;
process.exit(bad ? 1 : 0);
