"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { TABOO_CARDS, TabooCategory, TabooCard, pickN } from "@/lib/gameData";
import {
  TABOO_MODES, TABOO_MODE_ORDER, TabooMode, currentCardId,
  initialTabooState, isExpired, remainingMs, tabooReducer,
} from "@/lib/tabooState";
import { GameText } from "@/lib/gameI18n";
import { ChildButton, ChildCard, ChildText } from "../ui/child";
import ScopedStyle from "../ui/child/ScopedStyle";
import BeeMascot from "../BeeMascot";
import GameHeader, { GameStat } from "../ui/game/GameHeader";

const DECK_SIZE = 12;
const MAX_PASSES = 3;
/** HUD 갱신 주기. 남은 시간의 근거는 언제나 deadlineAt 이고 이 간격은 표시용일 뿐이다. */
const HUD_MS = 250;

const CAT_META: Record<TabooCategory, { emoji: string; label: string }> = {
  school: { emoji: "🏫", label: "학교" },
  food: { emoji: "🍎", label: "음식" },
  animal: { emoji: "🐶", label: "동물" },
  daily: { emoji: "🏠", label: "일상" },
};

const LANG_EMOJI: Record<string, string> = {
  ko: "🇰🇷", en: "🇺🇸", vi: "🇻🇳", zh: "🇨🇳", ja: "🇯🇵", th: "🇹🇭",
  id: "🇮🇩", hi: "🇮🇳", ru: "🇷🇺", ar: "🇸🇦", fil: "🇵🇭", km: "🇰🇭",
  mn: "🇲🇳", uz: "🇺🇿", my: "🇲🇲",
};

/**
 * 시간 정책은 아이에게 보이는 말로 화면에 그대로 쓴다. 어떤 규칙으로 시계가
 * 흐르는지 모른 채 점수가 끝나는 일이 없어야 한다 (HARNESS TABOO-02).
 */
const MODE_TEXT: Record<TabooMode, { icon: string; name: string; rule: string; hud: string }> = {
  free: {
    icon: "🌱", name: "천천히 연습",
    rule: "시간 제한이 없어요. 카드를 다 쓰면 끝나요.",
    hud: "시간 제한 없음",
  },
  paced: {
    icon: "⏳", name: "함께 연습",
    rule: "90초예요. 다른 화면에 갔다 오면 시계가 멈춰 있어요.",
    hud: "잠깐 나가면 시계가 멈춰요",
  },
  race: {
    icon: "🏁", name: "시간 대결",
    rule: "90초예요. 다른 화면에 가 있어도 시간이 계속 흘러요.",
    hud: "나가 있어도 시간이 흘러요",
  },
};

export default function HoneyTaboo({ langA, langB }: { langA: string; langB: string }) {
  const [state, dispatch] = useReducer(tabooReducer, "free" as TabooMode, initialTabooState);
  const [cats, setCats] = useState<Record<TabooCategory, boolean>>({
    school: true, food: true, animal: true, daily: true,
  });
  const [mode, setMode] = useState<TabooMode>("free");
  const [giverLang, setGiverLang] = useState<string>(langA);
  const [now, setNow] = useState<number>(() => Date.now());
  /** 이번 라운드에 뽑힌 카드. reducer 는 id 만 다루고 내용은 여기서 찾는다. */
  const [roundCards, setRoundCards] = useState<TabooCard[]>([]);
  const roundIdRef = useRef(0);

  const selected = useMemo(
    () => (Object.keys(cats) as TabooCategory[]).filter((k) => cats[k]),
    [cats],
  );

  const byId = useMemo(() => {
    const map = new Map<string, TabooCard>();
    for (const c of roundCards) map.set(c.id, c);
    return map;
  }, [roundCards]);

  const playing = state.phase === "play";

  // HUD 시계. interval 이 몇 번 돌았는지는 시간이 아니다 — 매번 Date.now() 를 다시 읽고,
  // 만료 판정은 reducer 의 tick 이 deadlineAt 으로만 한다.
  useEffect(() => {
    if (!playing || state.paused || state.deadlineAt === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: "tick", now: t });
    }, HUD_MS);
    return () => window.clearInterval(id);
  }, [playing, state.paused, state.deadlineAt]);

  // 탭 백그라운드 전환. 정책은 reducer 안에 있고 여기서는 사실만 전달한다.
  useEffect(() => {
    if (!playing) return;
    const onVis = () => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: "visibility", hidden: document.visibilityState === "hidden", now: t });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing]);

  const startGame = useCallback(() => {
    if (selected.length === 0) return;
    const pool = TABOO_CARDS.filter((c) => selected.includes(c.category));
    const picked = pickN(pool, Math.min(DECK_SIZE, pool.length));
    if (picked.length === 0) return;
    roundIdRef.current += 1;
    const t = Date.now();
    setRoundCards(picked);
    setNow(t);
    dispatch({
      type: "start", roundId: roundIdRef.current, mode, passes: MAX_PASSES,
      deck: picked.map((c) => c.id), now: t,
    });
  }, [selected, mode]);

  // 버튼이 들고 있는 cardId 로만 답한다. 화면에 없는 카드/지난 라운드/만료 뒤의
  // 탭은 reducer 가 전부 버린다 — 연타 방어를 버튼 disabled 에만 맡기지 않는다.
  const answer = useCallback((cardId: string, result: "correct" | "pass") => {
    const t = Date.now();
    setNow(t);
    dispatch({ type: "answer", roundId: roundIdRef.current, cardId, result, now: t });
  }, []);

  const left = remainingMs(state, now);
  const seconds = left === null ? null : Math.ceil(left / 1000);
  const curId = currentCardId(state);
  const cur = curId ? byId.get(curId) ?? null : null;
  const expiredNow = isExpired(state, now);

  return (
    <div data-ux-root className="taboo-root">
      <ScopedStyle css={TABOO_CSS} />

      {state.phase === "setup" && (
        <SetupView
          cats={cats}
          toggleCat={(k) => setCats((c) => ({ ...c, [k]: !c[k] }))}
          mode={mode} setMode={setMode}
          giverLang={giverLang} setGiverLang={setGiverLang}
          langA={langA} langB={langB}
          canStart={selected.length > 0}
          onStart={startGame}
        />
      )}

      {state.phase === "play" && (
        <div className="taboo-play">
          {/* U01 공용 헤더 — 시간·점수·패스를 3칸 HUD 대신 다른 게임과 같은
              오른쪽 상태 칩으로. 뒤로는 이 게임의 준비 화면으로 돌아간다. */}
          <GameHeader
            gameId="taboo"
            title="꿀벌 금칙어"
            icon="🚫"
            onBack={() => dispatch({ type: "reset", mode })}
            backLabel="준비"
            progress={{ value: state.idx, max: state.deck.length }}
            status={
              <>
                <GameStat
                  icon="⏱"
                  label="남은 시간"
                  value={seconds === null ? "∞" : `${seconds}초`}
                  tone={seconds !== null && seconds <= 10 ? "warn" : "plain"}
                />
                <GameStat icon="⭐" label="맞힌 카드" value={state.score} tone="key" />
                <GameStat icon="⏭" label="남은 패스" value={state.passesLeft} />
              </>
            }
          />
          <ChildText role="secondary" as="p" className="taboo-policy">
            {MODE_TEXT[state.mode].icon} {MODE_TEXT[state.mode].name} · {MODE_TEXT[state.mode].hud}
          </ChildText>

          {state.paused && (
            <ChildCard className="taboo-pause" role="status">
              <ChildText role="body-emphasis">⏸ 시계를 멈춰 두었어요. 돌아왔으니 이어서 해요.</ChildText>
            </ChildCard>
          )}

          {cur && (
            <ChildCard panel className="taboo-card">
              <div className="taboo-cardtop">
                <ChildText role="label">
                  {CAT_META[cur.category].emoji} {CAT_META[cur.category].label}
                </ChildText>
                <ChildText role="secondary">
                  {state.idx + 1} / {state.deck.length}
                </ChildText>
              </div>
              <ChildText role="secondary" as="p" className="taboo-center">
                🎤 설명하는 사람 {LANG_EMOJI[giverLang] ?? "🌐"} {giverLang.toUpperCase()}
              </ChildText>
              {/* U01: 화면의 title 은 헤더의 게임 이름 하나뿐. 설명할 낱말은
                  'learn-word'(집중 학습 단어) — 크기는 그대로 크다. */}
              <p data-ux-role="learn-word" className="taboo-answer">
                <GameText map={cur.answer} lang={giverLang} />
              </p>

              <div className="taboo-taboos">
                <ChildText role="label" as="p" className="taboo-tabooshead">
                  🚫 이 말은 쓰지 않기
                </ChildText>
                <ul className="taboo-chiplist">
                  {cur.taboos.map((t, i) => (
                    <li key={i} className="taboo-chip">
                      <ChildText role="body">
                        <GameText map={t} lang={giverLang} />
                      </ChildText>
                    </li>
                  ))}
                </ul>
              </div>
            </ChildCard>
          )}

          <div className="taboo-actions">
            <ChildButton
              variant="primary"
              disabled={!cur || expiredNow}
              onClick={() => cur && answer(cur.id, "correct")}
            >✅ 맞혔어요</ChildButton>
            <ChildButton
              variant="secondary"
              disabled={!cur || expiredNow || state.passesLeft <= 0}
              onClick={() => cur && answer(cur.id, "pass")}
            >⏭ 다음 카드 ({state.passesLeft})</ChildButton>
          </div>
          {state.passesLeft <= 0 && (
            <ChildText role="secondary" as="p" className="taboo-center">
              다음 카드는 다 썼어요. 한 번 더 다르게 설명해 볼까요?
            </ChildText>
          )}

          <div className="taboo-actions">
            <ChildButton
              variant="secondary"
              onClick={() => setGiverLang((g) => (g === langA ? langB : langA))}
            >🔄 역할 바꾸기 · 지금 {giverLang.toUpperCase()}</ChildButton>
            <ChildButton variant="quiet" onClick={() => dispatch({ type: "quit" })}>
              🏁 여기까지 할래요
            </ChildButton>
          </div>
        </div>
      )}

      {state.phase === "result" && (
        <ResultView
          score={state.score}
          endedBy={state.endedBy}
          mode={state.mode}
          outcomes={state.outcomes.map((o) => ({ ...o, card: byId.get(o.cardId) ?? null }))}
          giverLang={giverLang}
          onRestart={startGame}
          onExit={() => dispatch({ type: "reset", mode })}
        />
      )}
    </div>
  );
}

function SetupView({
  cats, toggleCat, mode, setMode, giverLang, setGiverLang, langA, langB, canStart, onStart,
}: {
  cats: Record<TabooCategory, boolean>;
  toggleCat: (k: TabooCategory) => void;
  mode: TabooMode; setMode: (m: TabooMode) => void;
  giverLang: string; setGiverLang: (l: string) => void;
  langA: string; langB: string;
  canStart: boolean; onStart: () => void;
}) {
  const keys: TabooCategory[] = ["school", "food", "animal", "daily"];
  // 연습 1문제 — 시작 전에 규칙을 한 장으로 보여준다. 점수와 무관하다.
  const sample = TABOO_CARDS[0];
  return (
    <div className="taboo-setup">
      <div className="taboo-center">
        <BeeMascot size={90} mood="cheer" />
        <ChildText role="title">🚫 꿀벌 금칙어</ChildText>
        <ChildText role="body" as="p">
          빨간 말은 빼고 설명해서 친구가 답을 맞히면 돼요.
        </ChildText>
      </div>

      <ChildCard panel className="taboo-section">
        <ChildText role="label" as="p">🕒 시간은 어떻게 할까요?</ChildText>
        <div className="taboo-modelist">
          {TABOO_MODE_ORDER.map((m) => (
            <ChildButton
              key={m}
              variant="choice"
              selected={mode === m}
              onClick={() => setMode(m)}
              icon={MODE_TEXT[m].icon}
            >
              <span className="taboo-modename">{MODE_TEXT[m].name}</span>
              <span className="taboo-moderule">{MODE_TEXT[m].rule}</span>
            </ChildButton>
          ))}
        </div>
      </ChildCard>

      <ChildCard panel className="taboo-section">
        <ChildText role="label" as="p">🎯 어떤 이야기로 놀까요?</ChildText>
        <div className="taboo-catgrid">
          {keys.map((k) => (
            <ChildButton
              key={k}
              variant="choice"
              selected={cats[k]}
              onClick={() => toggleCat(k)}
              icon={CAT_META[k].emoji}
            >{CAT_META[k].label}</ChildButton>
          ))}
        </div>
        {!canStart && (
          <ChildText role="body" as="p" className="taboo-warn">
            하나만 골라 주세요.
          </ChildText>
        )}
      </ChildCard>

      <ChildCard panel className="taboo-section">
        <ChildText role="label" as="p">🎤 설명하는 사람의 말</ChildText>
        <div className="taboo-catgrid">
          {[langA, langB].map((lang, i) => (
            <ChildButton
              key={`${lang}-${i}`}
              variant="choice"
              selected={giverLang === lang}
              onClick={() => setGiverLang(lang)}
              icon={LANG_EMOJI[lang] ?? "🌐"}
            >{lang.toUpperCase()}</ChildButton>
          ))}
        </div>
      </ChildCard>

      <ChildCard panel className="taboo-section">
        <ChildText role="label" as="p">👀 연습 한 장 — 이렇게 나와요</ChildText>
        <ChildText role="body-emphasis" as="p" className="taboo-center">
          <GameText map={sample.answer} lang={giverLang} />
        </ChildText>
        <ul className="taboo-chiplist">
          {sample.taboos.map((t, i) => (
            <li key={i} className="taboo-chip">
              <ChildText role="body"><GameText map={t} lang={giverLang} /></ChildText>
            </li>
          ))}
        </ul>
        <ChildText role="secondary" as="p">
          점수에 들어가지 않는 예시예요.
        </ChildText>
      </ChildCard>

      <ChildButton variant="primary" disabled={!canStart} onClick={onStart} style={{ width: "100%" }}>
        ▶ 시작하기 · {MODE_TEXT[mode].name}
      </ChildButton>
    </div>
  );
}

function ResultView({
  score, endedBy, mode, outcomes, giverLang, onRestart, onExit,
}: {
  score: number;
  endedBy: "deck" | "time" | "quit" | null;
  mode: TabooMode;
  outcomes: { cardId: string; result: "correct" | "pass" | "missed"; card: TabooCard | null }[];
  giverLang: string;
  onRestart: () => void; onExit: () => void;
}) {
  const group = (k: "correct" | "pass" | "missed") =>
    outcomes.filter((o) => o.result === k && o.card).map((o) => o.card as TabooCard);
  const why =
    endedBy === "time" ? "시간이 다 됐어요." :
    endedBy === "quit" ? "여기까지 했어요." : "카드를 다 썼어요!";
  return (
    <div className="taboo-setup">
      <div className="taboo-center">
        <BeeMascot size={110} mood={score >= 8 ? "celebrate" : score >= 5 ? "cheer" : "think"} />
        <ChildText role="title">🐝 {score}개를 맞혔어요</ChildText>
        <ChildText role="body" as="p">
          {why} {MODE_TEXT[mode].icon} {MODE_TEXT[mode].name}로 놀았어요.
        </ChildText>
      </div>

      <ResultList title="✅ 맞힌 카드" cards={group("correct")} lang={giverLang} />
      <ResultList title="⏭ 넘긴 카드" cards={group("pass")} lang={giverLang} />
      <ResultList title="🕒 못 해 본 카드" cards={group("missed")} lang={giverLang} />

      <div className="taboo-actions">
        <ChildButton variant="primary" onClick={onRestart}>🔁 한 번 더</ChildButton>
        <ChildButton variant="secondary" onClick={onExit}>⚙ 다르게 고르기</ChildButton>
      </div>
    </div>
  );
}

function ResultList({ title, cards, lang }: { title: string; cards: TabooCard[]; lang: string }) {
  if (cards.length === 0) return null;
  return (
    <ChildCard panel className="taboo-section">
      <ChildText role="label" as="p">{title} · {cards.length}</ChildText>
      <ul className="taboo-chiplist">
        {cards.map((c, i) => (
          <li key={`${c.id}-${i}`} className="taboo-chip">
            <ChildText role="body"><GameText map={c.answer} lang={lang} /></ChildText>
          </li>
        ))}
      </ul>
    </ChildCard>
  );
}

/* 글자 크기는 전부 토큰이 정한다 — 여기에 px 글자 크기를 다시 쓰지 말 것. */
const TABOO_CSS = `
.taboo-root{
  max-width: 560px; margin: 0 auto;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  color: var(--ux-ink);
}
.taboo-setup, .taboo-play{ display: grid; gap: var(--ux-space-4); }
.taboo-center{ text-align: center; display: grid; gap: var(--ux-space-2); justify-items: center; }
.taboo-section{ display: grid; gap: var(--ux-space-3); }
.taboo-modelist{ display: grid; gap: var(--ux-space-3); }
.taboo-modename{ display: block; font-weight: 800; }
.taboo-moderule{ display: block; font-size: var(--ux-font-secondary); color: var(--ux-ink-soft); line-height: var(--ux-lh-reading); }
.taboo-catgrid{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ux-space-3); }
@media (max-width: 360px){ .taboo-catgrid{ grid-template-columns: 1fr; } }
/* U01: .taboo-hud 3칸 HUD 는 공용 GameHeader 의 상태 칩으로 옮겼다. */
.taboo-policy{ text-align: center; }
.taboo-pause{ background: var(--ux-surface-sunk); text-align: center; }
.taboo-card{ display: grid; gap: var(--ux-space-3); }
.taboo-cardtop{ display: flex; align-items: center; justify-content: space-between; gap: var(--ux-space-2); }
.taboo-answer{ margin: 0; text-align: center; word-break: keep-all; overflow-wrap: anywhere; }
.taboo-taboos{
  background: var(--ux-surface-sunk); border: 2px dashed var(--ux-error);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-3); display: grid; gap: var(--ux-space-2);
}
.taboo-tabooshead{ color: var(--ux-error); }
.taboo-chiplist{
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: var(--ux-space-2); justify-content: center;
}
.taboo-chip{
  background: var(--ux-surface); border: 2px solid var(--ux-ink-soft);
  border-radius: var(--ux-radius-pill); padding: var(--ux-space-1) var(--ux-space-3);
  max-width: 100%; overflow-wrap: anywhere;
}
.taboo-actions{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ux-space-3); }
@media (max-width: 360px){ .taboo-actions{ grid-template-columns: 1fr; } }
.taboo-warn{ color: var(--ux-error); }
.taboo-root button[disabled]{ opacity: .55; cursor: not-allowed; }
`;
