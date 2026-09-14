/**
 * 기기 5종 × 글자 크기 2종 실측 감사기 (품질 하네스, 2026-09-14).
 *
 * 하는 일 (화면 1개 × 칸 1개마다):
 *   1. before 를 3402(601a8f0) 에서, after 를 3300(HEAD 4dca8c5) 에서 실제로 캡처한다.
 *   2. after 에서 실측한다 — 가로 넘침, 첫 화면 콘텐츠 비율, 최소 조작 크기,
 *      본문 글자 크기, 에러 오버레이, 콘솔 오류, Firebase//api 누수.
 *   3. 키보드 Tab 과 실제 탭(클릭)을 넣어 조작이 먹는지 확인한다.
 *   4. 측정값과 조작 결과를 칸별 마크다운으로 남긴다 (= interactionEvidence).
 *   5. 문제를 issues[] 로 모은다. issues 가 비어야만 그 칸이 passed 가 된다.
 *
 * 글자 크기: localStorage 'childUx.settings' 의 textSize 를 페이지 로드 전에 심는다
 * (lib/childUx/settings.ts 의 단일 경로). 화면을 강제로 확대하지 않는다.
 *
 * 실행: 저장소 루트에서 `node scripts/audit/capture.mjs [화면id ...]`
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";
import { SCREENS, BEFORE_ROUTES, FLOW_BEFORE } from "./screens.mjs";

/** 지금 3300 이 서빙하는 커밋. 증거에 적는 값은 손으로 박지 않고 실제로 읽는다. */
const HEAD = (() => {
  try { return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); }
  catch { return "(unknown)"; }
})();

const AFTER = "http://localhost:3300";
const BEFORE = "http://localhost:3402";
const OUT = path.resolve("reports/audit-20260914");
const ALL_DEVICES = [
  { id: "tablet-portrait", width: 820, height: 1180, touch: true },
  { id: "tablet-landscape", width: 1180, height: 820, touch: true },
  { id: "chromebook", width: 1366, height: 768, touch: true },
  { id: "laptop", width: 1440, height: 900, touch: false },
  { id: "split-view", width: 800, height: 768, touch: true },
];
const ALL_SIZES = ["basic", "large"];
// 다시 찍을 칸만 고르는 선택 스위치. 안 주면 예전과 똑같이 10칸 전부 돈다.
//   AUDIT_DEVICES=tablet-landscape AUDIT_SIZES=large node scripts/audit/capture.mjs <화면id>
// (이미 통과한 칸을 건드리지 않고 실패한 한 칸만 다시 찍을 때 쓴다.
//  capture.json 의 그 화면 기록은 이번에 찍은 칸만 담게 되므로,
//  기록 단계에서 어떤 칸을 갱신할지 그대로 드러난다.)
const pickList = (env, all, key) => {
  const raw = (process.env[env] || "").trim();
  if (!raw) return all;
  const want = raw.split(/[,\s]+/).filter(Boolean);
  const got = all.filter((x) => want.includes(key ? x[key] : x));
  if (!got.length) throw new Error(`${env}=${raw} 에 맞는 값이 없다`);
  return got;
};
const DEVICES = pickList("AUDIT_DEVICES", ALL_DEVICES, "id");
const SIZES = pickList("AUDIT_SIZES", ALL_SIZES, null);

/** 아이 손가락 기준 최소 조작 크기(04 문서 U02). 노트북 포인터는 44px 로 완화된다. */
const MIN_TAP = { touch: 48, mouse: 44 };

const bareUrl = (u) => u.split("?")[0];

/** 조작으로만 도달하는 화면들. 도달에 실패하면 그 칸은 통과시키지 않는다. */
const STEPS = {
  async entryToAnimal(page) {
    // SetupScreen 은 1/3 언어 → 2/3 이름 → 3/3 동물 3단계다. 각 단계마다
    // "다음 →" 를 눌러야 넘어간다 (조사로 확인).
    await page.getByRole("button", { name: /한국어/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(700);
    for (let step = 0; step < 3; step++) {
      const txt = await page.evaluate("document.body.innerText || ''");
      if (/3\/3|동물|여우|곰|토끼|고양이/.test(txt)) return;
      // 이름 단계면 명렬표에서 한 명 고르거나 직접 입력한다.
      const input = page.locator('input[type="text"], input:not([type]):not([type=checkbox])').first();
      if (await input.count()) {
        await input.fill("학생 02").catch(() => {});
        await page.waitForTimeout(250);
      } else {
        const roster = page.getByRole("button", { name: /^학생 02$/ }).first();
        if (await roster.count()) { await roster.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); }
      }
      const next = page.getByRole("button", { name: /다음/ }).first();
      if (!(await next.count())) break;
      await next.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
    const txt = await page.evaluate("document.body.innerText || ''");
    if (!/3\/3|동물|여우|곰|토끼|고양이/.test(txt)) {
      throw new Error("동물 선택 단계에 도달하지 못함 (현재: " + txt.replace(/\s+/g, " ").slice(0, 80) + ")");
    }
  },
  async boardReaction(page) {
    await page.getByRole("button", { name: /React|마음|반응/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(800);
  },
  async halligalliStart(page) {
    await page.getByRole("button", { name: /시작하기/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
  },
  async globeExplore(page) {
    await page.getByRole("button", { name: /공부하기/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
  },

  // ── 마블 (2차 라운드) ────────────────────────────────────────────────────
  // 캐릭터 설정에서 "게임 시작"만 누르면 기본 2인으로 판이 열린다.
  // /ux-fixture/marble 은 Math.random 을 시드로 고정하므로 같은 시드 + 같은
  // 클릭 순서면 항상 같은 주사위·같은 칸이 나온다(= 10칸 재현 가능).
  async marbleStart(page) {
    await page.getByRole("button", { name: "게임 시작" }).first().click({ timeout: 10000 });
    await page.waitForTimeout(900);
    const board = await page.evaluate("!!document.querySelector('.mb-actcard, [class*=\"mb-\"]')");
    if (!board) throw new Error("마블 판에 진입하지 못함");
  },
  async marbleRoll(page) {
    await STEPS.marbleStart(page);
    await page.getByRole("button", { name: "주사위 굴리기" }).first().click({ timeout: 10000 });
    // 움직임 줄이기가 꺼진 칸에서는 굴림 0.7초 + 이동 최대 1.5초 연출이 끝나야
    // 화면이 멈춘다. 넉넉히 기다렸다가 "멈춘 화면"을 잰다.
    await page.waitForTimeout(3200);
    const settled = await page.evaluate(
      "!!document.querySelector('.mb-actcard, .mb-chance, [class*=\"mb-quiz\"]')",
    );
    if (!settled) throw new Error("굴린 뒤 결과 카드가 나타나지 않음");
  },
  // ── 공용 "놀이 방법" 준비판 (2b256e4 로 21개 게임에 들어온 GameGuidePanel) ──
  // 처음 들어온 아이에게만 펼쳐진다(localStorage guideSeen). Playwright 컨텍스트는
  // 매번 새 프로필이라 항상 펼쳐진 상태로 시작한다 = 준비 화면이 재현된다.
  // 이 스텝은 그 준비판을 닫고 **놀이판**으로 넘어간다.
  async guideStart(page) {
    const b = page.getByRole("button", { name: /알겠어요, 시작할래요/ });
    if (await b.count()) {
      await b.first().click({ timeout: 8000 });
      await page.waitForTimeout(900);
    } else {
      throw new Error("준비판의 '알겠어요, 시작할래요' 를 찾지 못함");
    }
  },

  // ── 문화 퍼즐 완성 ────────────────────────────────────────────────────────
  // 드래그가 아니라 제품이 이미 지원하는 "고르고 놓기"(handleClick 두 번 = 자리 교환)
  // 로 맞춘다. 각 칸의 inline backgroundPosition 이 그 칸이 지금 들고 있는 조각
  // 번호를 그대로 담고 있어(CulturePuzzle.tsx:171-188), 화면만 읽고 선택 정렬로
  // 최대 8번 교환하면 3x3 이 맞는다 — 기기별 드래그 좌표에 의존하지 않는다.
  async puzzleSolve(page) {
    await STEPS.guideStart(page);
    const PLAN = `(() => {
      const cells = [...document.querySelectorAll('.cp-cell')];
      if (cells.length !== 9) return { error: '조각 9개를 찾지 못함 (' + cells.length + ')' };
      const cur = cells.map((el) => {
        const m = (el.style.backgroundPosition || '').match(/([\\d.]+)%\\s+([\\d.]+)%/);
        if (!m) return -1;
        return Math.round(parseFloat(m[2]) / 50) * 3 + Math.round(parseFloat(m[1]) / 50);
      });
      if (cur.some((v) => v < 0)) return { error: 'backgroundPosition 을 읽지 못함' };
      for (let i = 0; i < 9; i++) {
        if (cur[i] === i) continue;
        const j = cur.indexOf(i);
        return { swap: [i, j] };
      }
      return { done: true };
    })()`;
    for (let pass = 0; pass < 12; pass++) {
      const plan = await page.evaluate(PLAN);
      if (plan.error) throw new Error(plan.error);
      if (plan.done) break;
      const [i, j] = plan.swap;
      await page.locator(`[aria-label="조각 ${i + 1}"]`).click({ timeout: 6000 });
      await page.waitForTimeout(120);
      await page.locator(`[aria-label="조각 ${j + 1}"]`).click({ timeout: 6000 });
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(600);
    const solved = await page.evaluate("!!document.querySelector('.cp-done')");
    if (!solved) throw new Error("퍼즐을 완성 상태로 만들지 못함");
  },

  // ── 할리갈리 한 판 완주 ───────────────────────────────────────────────────
  // 정식 룰대로 56장을 모두 넘기면 phase 가 result 가 된다(HalliGalli.tsx:138-144).
  // 종은 누르지 않으므로 점수는 항상 0:0 무승부 — 덱 순서와 무관하게 결과 화면이
  // 같다. flipLock 이 250ms 라 그보다 넉넉히 두고 누른다.
  async halligalliFinish(page) {
    await page.getByRole("button", { name: /시작하기/ }).first().click({ timeout: 8000 });
    await page.waitForTimeout(800);
    // 넘기기 버튼은 disabled 가 아니라 aria-disabled 로 잠긴다(HalliGalli.tsx:426).
    // 잠긴 쪽을 누르면 Playwright 가 actionability 대기로 5초씩 잡아먹으므로
    // **지금 차례인 버튼만** 고른다.
    for (let n = 0; n < 64; n++) {
      const flip = page.locator('[aria-label*="카드 넘기기"][aria-disabled="false"]');
      if (!(await flip.count())) break;
      await flip.first().click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(270);
      if (await page.evaluate("/무승부|승!/.test(document.body.innerText||'')")) break;
    }
    await page.waitForTimeout(600);
    const done = await page.evaluate("/무승부|승!/.test(document.body.innerText||'')");
    if (!done) throw new Error("카드를 다 넘겼는데도 결과 화면이 되지 않음");
  },

  // ── 평면 세계지도 나라 찾기 ───────────────────────────────────────────────
  // 지도 번들(public/maps/world-quiz.v1.json, 0.73MB)은 마운트 뒤에 fetch 한다.
  // 그 전에 재면 "🗺️ 지도를 가져오는 중…" 한 줄만 잡혀 본문 길이·조작 개수가
  // 전부 거짓으로 나온다. 지도 <svg class="wmq-map"> 가 실제로 그려질 때까지
  // 기다린 뒤에야 잰다 — 조작을 하는 스텝이 아니라 "다 그려졌음"을 확인하는 스텝이다.
  async worldMapReady(page) {
    await page.locator(".wmq-map").waitFor({ timeout: 25000 });
    await page.locator(".wmq-target").waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
  },

  // ── 단어 시험 완주 → 시험 결과 화면 (vocab-result) ─────────────────────────
  // VocabTest 는 큐를 다 풀면 allDone 이 되어 SessionResultScreen 을 그린다
  // (VocabTest.tsx:109, 379). 거기까지 가려면 10문제를 실제로 풀어야 한다.
  //
  // 재현성: /ux-fixture/vocab?open=quiz&seed=N 이 Math.random 을 시드로 고정하므로
  // 문제 10개와 보기 순서가 항상 같다. 그 위에서 이 스텝은 늘 같은 순서로 누른다 —
  //   1) 보기 중 첫 번째를 고른다.
  //   2) 틀리면 피드백이 정답 보기에 "✓ 정답" 을 붙여 알려준다(VocabTest.tsx:800).
  //      그 라벨을 기억해 "↻ 다시 시도" 를 누르고 두 번째 시도에 그걸 고른다.
  //   3) 맞으면 "다음 →" 으로 넘어간다.
  // 그래서 같은 시드면 항상 정답 10/10 · 최고 콤보 10 · 획득 XP +180 인 같은
  // 결과 화면이 나온다(실측으로 2회 확인). 보기 버튼은 inline minHeight
  // (72px 일반 / 110px 그림)로 식별한다 — ChoiceBody 가 그 값을 직접 쓴다.
  // fixture 는 offline 이라 하트가 깎이지 않으므로(VocabTest.tsx:218) 하트 소진
  // 분기로 새지 않는다. 즉 여기서 도달하는 것은 언제나 "완주" 쪽 결과 화면이다.
  async vocabQuizFinish(page) {
    const PLAN = `(() => {
      document.querySelectorAll('[data-audit-pick]').forEach(e => e.removeAttribute('data-audit-pick'));
      const txt = document.body.innerText || '';
      if (/정답률/.test(txt) && /다시 풀기/.test(txt)) return { done: true };
      const label = (b) => { const s = b.querySelector('span'); return (s ? s.textContent : b.textContent || '').trim(); };
      const all = [...document.querySelectorAll('button')].filter(b => !b.closest('[data-fixture-chrome]'));
      const proceed = all.find(b => /다음 →|다시 시도/.test(b.textContent || ''));
      if (proceed) {
        const retry = /다시 시도/.test(proceed.textContent || '');
        const revealed = all.find(b => /✓ 정답/.test(b.textContent || ''));
        window.__uxAnswer = retry && revealed ? label(revealed) : null;
        proceed.setAttribute('data-audit-pick', '1');
        return { kind: 'proceed' };
      }
      const choices = all.filter(b => b.style.minHeight === '72px' || b.style.minHeight === '110px');
      if (!choices.length) return { error: '보기 버튼을 찾지 못함 (' + txt.slice(0, 60) + ')' };
      const want = window.__uxAnswer;
      const hit = want ? choices.find(b => label(b) === want) : null;
      const target = hit || choices[0];
      window.__uxAnswer = null;
      target.setAttribute('data-audit-pick', '1');
      return { kind: 'pick' };
    })()`;
    let reached = false;
    for (let n = 0; n < 90; n++) {
      const plan = await page.evaluate(PLAN);
      if (plan.error) throw new Error(plan.error);
      if (plan.done) { reached = true; break; }
      await page.locator("[data-audit-pick]").click({ timeout: 6000 });
      await page.waitForTimeout(220);
    }
    if (!reached) throw new Error("10문제를 다 풀었는데도 시험 결과 화면이 되지 않음");
    await page.waitForTimeout(600);
  },

  // ── 🪵 윷놀이 한 판 완주 (승리 오버레이까지) ─────────────────────────────
  //
  // 왜 이렇게 하나: 이 화면은 제품 경로 그대로 끝까지 두어서 연다 — 컴포넌트에
  // 아무것도 달지 않았다. 종전 기록은 "시드를 고정해도 재현되지 않는다,
  // YutSticks 가 연출 도중 Math.random 을 계속 뽑아 실제 던진 값이 난수열의
  // 몇 번째인지가 벽시계에 달린다" 고 적었지만, 코드를 다시 읽어보니 그렇지
  // 않다: throwSticks() 는 handleThrow 첫 줄에서 **먼저** 뽑고
  // (YutSticks.tsx:41), 깜빡임용 Math.random 은 130~650ms 타이머에서 뽑히며
  // (같은 파일 46-50), 다음 던지기는 780ms 결과 타이머 뒤에야 열린다(52-57).
  // 즉 한 번의 던지기마다 "값 4개 → 깜빡임 20개" 순서가 항상 같다. 조작
  // 순서만 정하면 같은 시드에서 판 전체가 같아진다.
  //
  // 조작 규칙(= 그 정한 순서): 문화카드가 떠 있으면 닫는다 → 던질 수 있으면
  // 던진다 → 움직일 수 있는 말 중 **보드 위 말**을 DOM 순서로 먼저, 없으면
  // 대기 말을 고른다. 고를 수 있는 말은 제품이 점선 원으로 표시한 것만이다
  // (YutBoard.tsx:120·192) — 스크립트가 판 내부 상태를 읽지 않는다.
  async yutFinish(page) {
    // 다음에 누를 것 하나에 표식을 달고 그 표식으로만 잡는다. 좌표로 직접 누르면
    // 세로 화면(820x1180)처럼 판·조작이 첫 화면 밖으로 밀리는 칸에서 손가락이
    // 닿지 않는 자리를 누르게 된다 — locator 로 눌러야 화면을 굴려 맞춘다.
    const MARK = `(() => {
      document.querySelectorAll('[data-audit-yut]').forEach((e) => e.removeAttribute('data-audit-yut'));
      const body = document.body.innerText || '';
      if (/팀 승리!/.test(body)) return { win: true };
      // 문화카드(CultureCard)가 뜨면 화면 전체를 덮는다. 닫기 버튼은 '계속 하기 →'.
      const close = document.querySelector('.yc-close');
      if (close) { close.setAttribute('data-audit-yut', '1'); return { kind: 'culture' }; }
      const th = [...document.querySelectorAll('button')].find(
        (b) => /윷 던지기/.test(b.innerText || '') && b.getAttribute('aria-disabled') === 'false');
      if (th) { th.setAttribute('data-audit-yut', '1'); return { kind: 'throw' }; }
      const svg = document.querySelector('svg[aria-label="윷놀이 판"]');
      if (!svg) return { kind: 'none', why: '판을 찾지 못함' };
      const movable = [...svg.querySelectorAll('g')].filter((g) => g.querySelector(':scope > circle[stroke-dasharray]'));
      if (!movable.length) return { kind: 'none', why: (document.querySelector('.hy-log') || {}).innerText || '' };
      const onBoard = movable.filter((g) => g.querySelector(':scope > circle[stroke-dasharray="10 7"]'));
      const g = (onBoard.length ? onBoard : movable)[0];
      // 고를 수 있는 말에는 제품이 끝없이 도는 점선 원을 얹는다(animateTransform
      // repeatCount="indefinite"). 그 원을 품은 <g> 는 경계 상자가 계속 흔들려
      // "element is not stable" 로 클릭이 영원히 대기한다. 그래서 흔들리지 않는
      // 꿀벌 그림(<image>)을 누른다 — onClick 은 부모 <g> 라 그대로 전달된다.
      const img = g.querySelector(':scope > image') || g;
      img.setAttribute('data-audit-yut', '1');
      return { kind: 'piece' };
    })()`;
    await STEPS.guideStart(page);
    const target = page.locator("[data-audit-yut]");
    let throws = 0, moves = 0, idle = 0, won = false;
    // 시드 5 실측이 던지기 58 · 말 옮기기 57 · 문화카드 11 이다. 400 이면 넉넉하면서도
    // 멈춘 판에서 무한히 도는 것을 막는다.
    for (let i = 0; i < 400; i++) {
      const r = await page.evaluate(MARK);
      if (r.win) { won = true; break; }
      if (r.kind === "none") {
        if (++idle > 40) throw new Error("윷판이 멈췄다: " + (r.why || "").slice(0, 60));
        await page.waitForTimeout(300);
        continue;
      }
      idle = 0;
      await target.click({ timeout: 8000 });
      if (r.kind === "throw") { throws++; await page.waitForTimeout(950); }
      else if (r.kind === "piece") { moves++; await page.waitForTimeout(260); }
      else await page.waitForTimeout(220);
    }
    if (!won) throw new Error(`한 판을 끝내지 못함 (던지기 ${throws}, 말 옮기기 ${moves})`);
    await page.waitForTimeout(500);
  },

  // ── 🌍 지구본 "게임하기" 8라운드 완주 ────────────────────────────────────
  //
  // 왜 이렇게 하나: 이 퀴즈의 유일한 입력은 3D 핀(THREE.Sprite) 레이캐스트다.
  // 지구본은 계속 돌고 핀 15개는 동아시아에서 서로 겹친다 — 컴포넌트 밖에서는
  // "그 나라를 누르려면 화면 어디인가"를 알 수 없었다. 좌표를 찍어 맞을 때까지
  // 누르면 오답이 기록되어 점수·시간이 매번 달라진다(= 재현 불가).
  //
  // 그래서 GlobeQuest 에 **fixture 전용 조준 훅**(auditPins → window.__globeAuditPins)
  // 을 달았다. 훅이 돌려주는 것은 조준점 하나뿐이고, 정답 판정·점수·시간·화면은
  // 전부 제품 코드가 그대로 정한다. 누르는 것도 실제 pointerdown/up 이다
  // (page.mouse.click). 아이 화면(GameRoom)은 이 prop 을 넘기지 않으므로
  // 훅 자체가 존재하지 않는다.
  //
  // 나라 이름 → 코드 표: 화면이 보여주는 것은 이름이고 훅이 받는 것은 코드라
  // 그 사이를 잇는다. 값은 lib/gameData.ts 의 COUNTRIES(ko) 와
  // lib/globeData.ts 의 GLOBE_COUNTRIES 15개에서 그대로 옮겼다.
  // 화면에 표 밖의 이름이 나오면 추측하지 않고 그 칸을 실패시킨다.
  async globeQuizFinish(page) {
    const KO_TO_CODE = {
      "대한민국": "KR", "미국": "US", "베트남": "VN", "중국": "CN", "필리핀": "PH",
      "일본": "JP", "태국": "TH", "캄보디아": "KH", "몽골": "MN", "러시아": "RU",
      "우즈베키스탄": "UZ", "인도": "IN", "인도네시아": "ID", "사우디아라비아": "SA", "미얀마": "MM",
    };
    // 게임 fixture(/ux-fixture/game?game=globe)는 모드 고르기부터 시작한다.
    const start = page.getByRole("button", { name: /게임하기/ });
    if (await start.count()) { await start.first().click({ timeout: 8000 }); await page.waitForTimeout(1200); }
    await page.waitForFunction("typeof window.__globeAuditPins === 'function'", { timeout: 25000 });
    // 첫 문제(pickN)는 마운트 뒤 effect 에서 정해진다.
    await page.waitForFunction(
      "!!document.querySelector('.gq-quizask [data-ux-role=\"body-emphasis\"]')?.textContent?.trim()",
      { timeout: 15000 },
    );
    await page.waitForTimeout(1200);
    let picks = 0, drags = 0;
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate("!!document.querySelector('.gq-result')")) break;
      const name = await page.evaluate(
        `(() => { const el = document.querySelector('.gq-quizask [data-ux-role="body-emphasis"]');
          return el ? (el.childNodes[0]?.textContent || '').trim() : ''; })()`,
      );
      if (!name) { await page.waitForTimeout(300); continue; }
      const code = KO_TO_CODE[name];
      if (!code) throw new Error("이름→코드 표에 없는 나라: " + name);
      const a = await page.evaluate(`window.__globeAuditPins(${JSON.stringify(code)})`);
      if (!a) throw new Error("핀을 찾지 못함: " + code);
      if (a.blocked) {
        // 겹친 핀을 떼어놓으려면 아이가 하듯 지구를 돌린다(OrbitControls 드래그).
        const box = await page.locator("canvas").first().boundingBox();
        if (!box) throw new Error("지구본 캔버스를 찾지 못함");
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx - Math.round(box.height / 4), cy, { steps: 8 });
        await page.mouse.up();
        if (++drags > 12) throw new Error("핀을 누를 수 있는 각도를 찾지 못함: " + code);
        await page.waitForTimeout(600);
        continue;
      }
      await page.mouse.click(Math.round(a.x), Math.round(a.y));
      picks++;
      await page.waitForTimeout(1400);
    }
    const done = await page.evaluate("!!document.querySelector('.gq-result')");
    if (!done) throw new Error(`8라운드를 끝내지 못함 (누른 횟수 ${picks}, 돌린 횟수 ${drags})`);
  },

  async none() {},
};

/** 페이지 안에서 도는 실측기. 반환값이 그대로 증거 수치가 된다. */
const MEASURE = `
  (() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const de = document.documentElement;
    const isChrome = (el) => !!el.closest('[data-fixture-chrome]') || !!el.closest('nextjs-portal');

    // 가로 넘침 — 아이 화면에서 좌우 스크롤은 그 자체로 결함이다.
    const overflowX = Math.max(0, de.scrollWidth - vw);
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      if (isChrome(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 2) {
        wide.push({ tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 40), right: Math.round(r.right) });
        if (wide.length >= 5) break;
      }
    }

    // 첫 화면(fold) 안의 조작/콘텐츠 밀도.
    const controls = [];
    for (const el of document.querySelectorAll('button, [role="button"], a[href], input, textarea, select')) {
      if (isChrome(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      const inFold = r.top < vh && r.bottom > 0;
      controls.push({
        label: (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height), inFold,
        min: Math.round(Math.min(r.width, r.height)),
      });
    }
    const foldControls = controls.filter(c => c.inFold);

    // 본문 글자 크기 — large 에서 실제로 커지는지 확인할 근거.
    const fontOf = (sel) => { const e = document.querySelector(sel); return e ? Math.round(parseFloat(getComputedStyle(e).fontSize) * 10) / 10 : null; };
    const bodyFonts = [];
    for (const el of document.querySelectorAll('p, li, span, div')) {
      if (isChrome(el)) continue;
      if (!el.textContent || !el.textContent.trim()) continue;
      if (el.children.length) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= vh || r.bottom <= 0 || r.width < 8) continue;
      bodyFonts.push(parseFloat(getComputedStyle(el).fontSize));
      if (bodyFonts.length >= 120) break;
    }
    bodyFonts.sort((a, b) => a - b);
    const median = bodyFonts.length ? bodyFonts[Math.floor(bodyFonts.length / 2)] : null;

    return {
      viewport: { w: vw, h: vh },
      docScroll: { w: de.scrollWidth, h: de.scrollHeight },
      overflowX, wideOffenders: wide,
      uxText: de.dataset.uxText || '(unset)',
      controlCount: controls.length,
      foldControlCount: foldControls.length,
      minTapInFold: foldControls.length ? Math.min(...foldControls.map(c => c.min)) : null,
      smallTaps: foldControls.filter(c => c.min < 48).map(c => ({ label: c.label, w: c.w, h: c.h })).slice(0, 8),
      bodyFontMedian: median === null ? null : Math.round(median * 10) / 10,
      bodyFontMin: bodyFonts.length ? Math.round(bodyFonts[0] * 10) / 10 : null,
      titleFont: fontOf('h1') ?? fontOf('h2'),
      textLen: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().length,
      errorOverlay: !!document.querySelector('nextjs-portal'),
    };
  })()
`;

/**
 * motion 인자:
 *   "reduce"        기본. 캡처가 애니메이션 프레임마다 달라지지 않게 한다.
 *   "no-preference" 움직임을 켠 채로 재는 칸(마블 2.5D 보드처럼 "연출이 있는
 *                   쪽"이 감사 대상인 화면). 브라우저 미디어 쿼리와 앱 설정을
 *                   **같이** 맞춘다 — 둘이 어긋나면 무엇을 잰 것인지 알 수 없다.
 */
async function makeContext(browser, dev, size, motion = "reduce") {
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    hasTouch: dev.touch,
    isMobile: false,
    deviceScaleFactor: 1,
    reducedMotion: motion,
  });
  const appMotion = motion === "reduce" ? "reduced" : "full";
  await ctx.addInitScript(`
    try {
      localStorage.setItem('childUx.settings', JSON.stringify({
        textSize: ${JSON.stringify(size)}, motion: ${JSON.stringify(appMotion)}, tone: 'playful', sound: 'off', focus: false
      }));
    } catch (e) {}
  `);
  return ctx;
}

async function shoot(browser, origin, url, dev, size, file, steps, motion) {
  const ctx = await makeContext(browser, dev, size, motion);
  const page = await ctx.newPage();
  const leaks = [];
  const consoleErrors = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/firestore|firebaseio|firebaseinstallations|identitytoolkit|firebaseapp\.com/i.test(u)) {
      leaks.push({ kind: "firebase", method: req.method(), url: u.slice(0, 120) });
    } else if (/localhost:\d+\/api\//.test(u)) {
      leaks.push({ kind: "api", method: req.method(), url: new URL(u).pathname });
    }
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/FIREBASE|firebase/i.test(t)) leaks.push({ kind: "firebase-console", url: t.slice(0, 120) });
    consoleErrors.push(t.slice(0, 180));
  });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).split("\n")[0].slice(0, 180)));

  let stepError = null;
  let measured = null;
  try {
    await page.goto(origin + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    // applyChildUx 가 <html data-ux-text> 를 다는 것은 마운트 후 effect 다.
    // 그 전에 재면 "글자 크기 미적용"이라는 거짓 결함이 나온다.
    await page.waitForFunction("!!document.documentElement.dataset.uxText", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1800);
    if (steps && STEPS[steps]) {
      try { await STEPS[steps](page); } catch (e) { stepError = String(e).split("\n")[0].slice(0, 160); }
    }
    await page.waitForTimeout(900);
    measured = await page.evaluate(MEASURE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
  } catch (e) {
    stepError = stepError || String(e).split("\n")[0].slice(0, 160);
  }
  await ctx.close();
  return { measured, leaks, consoleErrors: [...new Set(consoleErrors)].slice(0, 6), stepError, file };
}

/** 키보드 Tab 과 실제 탭이 먹는지 — 조작 증거의 실체. */
async function interact(browser, url, dev, size, steps, motion) {
  const ctx = await makeContext(browser, dev, size, motion);
  const page = await ctx.newPage();
  const log = [];
  try {
    await page.goto(AFTER + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1800);
    if (steps && STEPS[steps]) { try { await STEPS[steps](page); } catch (e) { log.push("사전 조작 실패: " + e); } }
    await page.waitForTimeout(700);

    await page.keyboard.press("Tab");
    await page.waitForTimeout(250);
    const focus = await page.evaluate(`(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      return { tag: a.tagName.toLowerCase(),
        label: (a.getAttribute('aria-label') || a.innerText || '').trim().replace(/\\s+/g,' ').slice(0,40),
        w: Math.round(r.width), h: Math.round(r.height),
        outline: cs.outlineStyle + ' ' + cs.outlineWidth, ring: cs.boxShadow.slice(0, 60),
        inChrome: !!a.closest('[data-fixture-chrome]') };
    })()`);
    log.push(`Tab 1회 → 포커스: ${focus ? `${focus.tag} "${focus.label}" ${focus.w}x${focus.h} outline=${focus.outline}${focus.inChrome ? " (fixture 껍데기)" : ""}` : "포커스 없음"}`);

    // 제품 버튼 하나를 실제로 눌러 화면이 반응하는지 본다.
    //
    // 주의: DOM 순서 첫 버튼을 그냥 누르면 안 된다. 단어 상세/쓰기처럼 모달
    // 오버레이가 덮인 화면에서는 첫 버튼이 "밑에 깔린 화면"의 버튼이라 클릭이
    // 타임아웃 나고, 그걸 제품 결함으로 잘못 적게 된다. 실제로 손가락이 닿는
    // (hit-test 로 자기 자신이 잡히는) 버튼만 고른다.
    const before = await page.evaluate("(document.body.innerText||'').length");
    // 고른 버튼에 표식을 달아 그 표식으로만 잡는다. 인덱스로 다시 찾으면
    // 선택자 집합이 달라져 엉뚱한 버튼을 누를 수 있다.
    const picked = await page.evaluate(`(() => {
      document.querySelectorAll('[data-audit-target]').forEach(e => e.removeAttribute('data-audit-target'));
      const btns = [...document.querySelectorAll('button, [role="button"]')]
        .filter(e => !e.closest('[data-fixture-chrome]') && !e.closest('nextjs-portal'));
      for (const el of btns) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top && (top === el || el.contains(top))) {
          el.setAttribute('data-audit-target', '1');
          return (el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 30);
        }
      }
      return null;
    })()`);
    let clicked = "손가락이 닿는 제품 버튼이 첫 화면에 없음";
    if (picked !== null) {
      const target = page.locator("[data-audit-target]");
      const name = picked;
      try {
        await target.click({ timeout: 6000 });
        await page.waitForTimeout(900);
        const after = await page.evaluate("(document.body.innerText||'').length");
        clicked = `"${name}" 탭 → 본문 길이 ${before}→${after} (${before === after ? "변화 없음" : "화면 반응함"})`;
      } catch (e) { clicked = `"${name}" 탭 실패: ${String(e).split("\n")[0].slice(0, 90)}`; }
    }
    log.push(clicked);
  } catch (e) {
    log.push("조작 검사 실패: " + String(e).split("\n")[0].slice(0, 140));
  }
  await ctx.close();
  return log;
}

function judge(screen, dev, size, after, before, interactLog) {
  const issues = [];
  const m = after.measured;
  if (!m) { issues.push("after 캡처/측정 실패: " + (after.stepError || "알 수 없음")); return issues; }
  if (after.stepError) issues.push("조작 도달 실패: " + after.stepError);
  if (m.errorOverlay) issues.push("Next.js 에러 오버레이가 화면을 덮음");
  if (m.overflowX > 2) {
    issues.push(`가로 넘침 ${m.overflowX}px (문서 ${m.docScroll.w} > 뷰포트 ${m.viewport.w})` +
      (m.wideOffenders.length ? ` — ${m.wideOffenders.map(o => `${o.tag}.${o.cls}@${o.right}`).join(", ")}` : ""));
  }
  if (m.uxText !== size) issues.push(`글자 크기 설정이 적용되지 않음: data-ux-text=${m.uxText} (기대 ${size})`);
  if (m.textLen < 20) issues.push(`화면에 읽을 내용이 거의 없음 (본문 ${m.textLen}자) — 렌더 실패 의심`);
  const limit = dev.touch ? MIN_TAP.touch : MIN_TAP.mouse;
  if (m.minTapInFold !== null && m.minTapInFold < limit) {
    issues.push(`첫 화면 최소 조작 ${m.minTapInFold}px < ${limit}px — ${m.smallTaps.map(t => `"${t.label}"(${t.w}x${t.h})`).slice(0, 4).join(", ")}`);
  }
  const fb = after.leaks.filter(l => l.kind !== "api");
  if (fb.length) issues.push(`fixture 가 Firebase 로 나감: ${fb.slice(0, 2).map(l => l.url).join(" | ")}`);
  const api = after.leaks.filter(l => l.kind === "api");
  if (api.length) issues.push(`fixture 가 /api 로 나감: ${[...new Set(api.map(l => l.url))].join(", ")}`);
  if (!before || !before.measured) issues.push("before 캡처 실패 — 전후 비교 불가");
  // 측정은 됐는데 스크린샷 저장이 실패하는 경우가 실제로 있었다
  // (featured-halligalli-result/tablet-landscape/large). 파일이 없으면 gate 는
  // 그 칸을 거부하는데 여기서 통과로 보고하면 record-state 단계까지 가서야 드러난다.
  if (before && before.measured && !fs.existsSync(before.file)) {
    issues.push("before 캡처 파일이 만들어지지 않음: " + before.file);
  }
  if (interactLog.some(l => /실패/.test(l))) issues.push("조작 검사 실패: " + interactLog.find(l => /실패/.test(l)));
  return issues;
}

async function main() {
  const only = process.argv.slice(2);
  const targets = SCREENS.filter(s => s.status !== "none" && (!only.length || only.includes(s.id)));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  // 이미 찍어둔 화면 결과는 보존하고 이번에 찍은 것만 갈아끼운다.
  // (중간에 끊겨도 앞선 화면의 실측을 잃지 않게 한다.)
  // 여러 사람이 동시에 감사할 때 서로의 기록을 덮어쓰지 않도록 파일을 나눈다.
  // 안 주면 예전과 똑같이 capture.json 이다.
  const jsonPath = path.join(OUT, process.env.AUDIT_JSON || "capture.json");
  let out = [];
  if (fs.existsSync(jsonPath)) {
    try { out = JSON.parse(fs.readFileSync(jsonPath, "utf8")); } catch { out = []; }
  }
  const put = (rec) => {
    const i = out.findIndex((x) => x.id === rec.id);
    if (i >= 0) out[i] = rec; else out.push(rec);
  };

  for (const s of targets) {
    // beforeUrl: 이번 라운드에 새로 만든 fixture 라우트(예: /ux-fixture/marble)는
    // 601a8f0 에 없다. 그래도 그 화면의 **제품상 이전 상태**는 그 시점의 다른
    // 라우트(/ux-fixture/game?game=marble)에 실제로 존재한다 — 그럴 때만
    // beforeUrl 로 그 경로를 지정한다. 없으면 종전 규칙(같은 URL / 홈 허브)이다.
    const beforeUrl = s.beforeUrl || (s.before === "same" ? s.url : FLOW_BEFORE);
    const beforeSteps = s.beforeSteps ?? (s.before === "same" ? s.steps : null);
    const motion = s.motion || "reduce";
    const beforeAvailable = s.before !== "none" && BEFORE_ROUTES.has(bareUrl(beforeUrl));
    const screenRec = { id: s.id, url: s.url, beforeUrl, beforeKind: s.before, motion, childGoal: s.childGoal, checks: [] };

    for (const dev of DEVICES) {
      for (const size of SIZES) {
        const tag = `${s.id}__${dev.id}__${size}`;
        const afterFile = path.join(OUT, "after", `${tag}.png`);
        const beforeFile = path.join(OUT, "before", `${tag}.png`);

        const after = await shoot(browser, AFTER, s.url, dev, size, afterFile, s.steps, motion);
        // before 는 그 시점에 실제로 있던 라우트만 찍는다. 없는 것을 만들어내지 않는다.
        // 신규 화면(before:"flow")의 before 는 601a8f0 당시 아이가 실제로 거치던 홈 허브다.
        const before = beforeAvailable
          ? await shoot(browser, BEFORE, beforeUrl, dev, size, beforeFile, beforeSteps, motion)
          : null;
        const ilog = await interact(browser, s.url, dev, size, s.steps, motion);
        const issues = judge(s, dev, size, after, before, ilog);

        // 칸별 조작·측정 기록 = interactionEvidence 실체.
        const md = path.join(OUT, "interaction", `${tag}.md`);
        fs.mkdirSync(path.dirname(md), { recursive: true });
        const m = after.measured || {};
        fs.writeFileSync(md, [
          `# ${s.id} · ${dev.id} · 글자 ${size}`,
          ``,
          `- 측정 시각: ${new Date().toISOString()}`,
          `- after: ${AFTER}${s.url} (multicultural-board HEAD ${HEAD})`,
          `- before: ${beforeAvailable ? BEFORE + beforeUrl + (s.beforeUrl ? "  ← 601a8f0 당시 같은 게임의 진입 경로(이 fixture 라우트는 이번 라운드 신규)" : s.before === "flow" ? "  ← 601a8f0 당시 실제 진입 흐름(이 화면은 이번 라운드 신규)" : "  ← 같은 라우트의 이전 상태") : "없음 (601a8f0 에 해당 라우트 없음)"}`,
          `- 입력 방식: ${dev.touch ? "터치 + 키보드" : "마우스 + 키보드"} (hasTouch=${dev.touch})`,
          `- 움직임: prefers-reduced-motion=${motion} / childUx.motion=${motion === "reduce" ? "reduced" : "full"}`,
          ``,
          `## 실측`,
          `- 뷰포트 ${m.viewport ? `${m.viewport.w}x${m.viewport.h}` : "-"} / 문서 ${m.docScroll ? `${m.docScroll.w}x${m.docScroll.h}` : "-"}`,
          `- data-ux-text: \`${m.uxText}\``,
          `- 가로 넘침: ${m.overflowX ?? "-"}px`,
          `- 첫 화면 조작 ${m.foldControlCount ?? "-"}개 / 전체 ${m.controlCount ?? "-"}개`,
          `- 첫 화면 최소 조작 크기: ${m.minTapInFold ?? "-"}px (기준 ${dev.touch ? 48 : 44}px)`,
          `- 본문 글자 중앙값 ${m.bodyFontMedian ?? "-"}px / 최소 ${m.bodyFontMin ?? "-"}px / 제목 ${m.titleFont ?? "-"}px`,
          `- 본문 길이 ${m.textLen ?? "-"}자`,
          ``,
          `## 조작 검사`,
          ...ilog.map(l => `- ${l}`),
          ``,
          `## 콘솔 오류`,
          after.consoleErrors.length ? after.consoleErrors.map(e => `- ${e}`).join("\n") : "- 없음",
          ``,
          `## 네트워크 누수 (fixture 는 Firebase//api 로 나가면 안 된다)`,
          after.leaks.length ? after.leaks.map(l => `- ${l.kind} ${l.url}`).join("\n") : "- 없음",
          ``,
          `## 판정`,
          issues.length ? issues.map(i => `- FAIL ${i}`).join("\n") : "- 이 칸에서 발견한 문제 없음",
          ``,
        ].join("\n"), "utf8");

        screenRec.checks.push({
          device: dev.id, textSize: size,
          before: beforeAvailable ? beforeFile : "",
          after: fs.existsSync(afterFile) ? afterFile : "",
          interactionEvidence: md,
          inputMethod: dev.touch ? "터치(hasTouch) + 키보드 Tab 이동" : "마우스 포인터 + 키보드 Tab 이동",
          measured: m, leaks: after.leaks, consoleErrors: after.consoleErrors,
          interactLog: ilog, issues,
        });
        console.log(`${issues.length ? "FAIL" : "pass"} ${tag}${issues.length ? "  :: " + issues[0].slice(0, 90) : ""}`);
      }
    }
    put(screenRec);
    fs.writeFileSync(jsonPath, JSON.stringify(out, null, 1));
  }

  await browser.close();
  const all = out.flatMap(s => s.checks);
  console.log(`\n화면 ${out.length}개 / 칸 ${all.length}개 — 문제 없음 ${all.filter(c => !c.issues.length).length}, 문제 있음 ${all.filter(c => c.issues.length).length}`);
  console.log(`→ ${jsonPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
