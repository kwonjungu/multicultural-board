"use client";

import { useMemo, useState } from "react";
import {
  TWENTYQ_ITEMS,
  HINT_CARDS,
  TwentyQCategory,
  TwentyQItem,
  HintCard,
  HintGroup,
  pickN,
  tr,
} from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";
import { gt, UI, type LangMap } from "./uiText";
import { gp } from "./plainText";

type Phase = "category" | "setup" | "play" | "asking" | "guess" | "result";

const TOTAL_QUESTIONS = 20;

// 게임 고유 UI 문구. 반복되는 짧은 동작 버튼은 gp(), 지문·제목·안내문은 gt().
const TQ: Record<string, LangMap> = {
  title: {
    ko: "스무고개", en: "Twenty Questions", vi: "Hai mươi câu hỏi", zh: "二十个问题",
    fil: "Dalawampung Tanong", ja: "にじゅうの しつもん", th: "ยี่สิบคำถาม", id: "Dua Puluh Pertanyaan",
    ru: "Двадцать вопросов", hi: "बीस सवाल", ar: "عشرون سؤالًا",
  },
  pickCategory: {
    ko: "무엇을 맞힐지 먼저 골라요",
    en: "First choose what you will guess",
    vi: "Trước tiên hãy chọn chủ đề để đoán",
    zh: "先选择要猜的主题",
    fil: "Piliin muna kung ano ang huhulaan",
    ja: "まず なにを あてるか えらぼう",
  },
  setupTitle: {
    ko: "출제자: 비밀 답을 고르세요",
    en: "Question master: pick the secret answer",
    vi: "Người ra đề: hãy chọn đáp án bí mật",
    zh: "出题者: 请选一个秘密答案",
    fil: "Taga-tanong: pumili ng lihim na sagot",
    ja: "しゅつだいしゃ: ひみつの こたえを えらんでね",
  },
  setupHowto: {
    ko: "친구가 보기 전에 하나만 고르세요. 고르면 바로 시작해요.",
    en: "Pick one before your friend looks. The game starts right away.",
    vi: "Chọn một cái trước khi bạn nhìn thấy. Chọn xong là bắt đầu ngay.",
    zh: "在同伴看到之前选一个，选好就马上开始。",
    fil: "Pumili ng isa bago tumingin ang kaibigan mo. Magsisimula agad.",
  },
  askPrompt: {
    ko: "물어볼 질문을 골라요",
    en: "Choose a question to ask",
    vi: "Chọn một câu hỏi để hỏi",
    zh: "选一个要问的问题",
    fil: "Pumili ng tanong na itatanong",
    ja: "きく しつもんを えらぼう",
  },
  recent: {
    ko: "지금까지 물어본 질문",
    en: "Questions asked so far",
    vi: "Các câu đã hỏi",
    zh: "已经问过的问题",
    fil: "Mga naitanong na",
    ja: "いままでの しつもん",
  },
  noneYet: {
    ko: "아직 물어본 질문이 없어요",
    en: "No questions asked yet",
    vi: "Chưa hỏi câu nào",
    zh: "还没有问过问题",
    fil: "Wala pang naitanong",
  },
  remain: {
    ko: "남은 질문", en: "Left", vi: "Còn lại", zh: "剩余", fil: "Natitira",
    ja: "のこり", th: "เหลือ", id: "Sisa", ru: "Осталось", hi: "बाकी", ar: "المتبقي",
  },
  used: {
    ko: "이미 물어봤어요", en: "Already asked", vi: "Đã hỏi rồi", zh: "已经问过了",
    fil: "Naitanong na", ja: "きいたよ",
  },
  outOfQuestions: {
    ko: "질문을 다 썼어요. 이제 정답을 말해 볼까요?",
    en: "No questions left. Shall we say the answer now?",
    vi: "Hết câu hỏi rồi. Mình nói đáp án nhé?",
    zh: "问题用完了，现在说出答案吧?",
    fil: "Ubos na ang tanong. Sabihin na natin ang sagot?",
  },
  sayAnswer: {
    ko: "정답 말하기", en: "Say the answer", vi: "Nói đáp án", zh: "说出答案",
    fil: "Sabihin ang sagot", ja: "こたえを いう",
  },
  toStart: {
    ko: "처음으로", en: "Start over", vi: "Về đầu", zh: "回到开始",
    fil: "Sa umpisa", ja: "はじめに",
  },
  changeCategory: {
    ko: "카테고리 바꾸기", en: "Change topic", vi: "Đổi chủ đề", zh: "换主题",
    fil: "Palitan ang paksa", ja: "テーマを かえる",
  },
  guessTitle: {
    ko: "정답은?", en: "What is the answer?", vi: "Đáp án là gì?", zh: "答案是什么?",
    fil: "Ano ang sagot?", ja: "こたえは?",
  },
  guessHowto: {
    ko: "아래에서 하나를 골라보세요",
    en: "Choose one from below",
    vi: "Hãy chọn một trong số dưới đây",
    zh: "从下面选一个",
    fil: "Pumili ng isa sa ibaba",
  },
  answerHere: {
    ko: "출제자: 이 질문에 답해주세요",
    en: "Question master: please answer this",
    vi: "Người ra đề: hãy trả lời câu này",
    zh: "出题者: 请回答这个问题",
    fil: "Taga-tanong: pakisagot ito",
  },
  suggest: {
    ko: "추천 답", en: "Suggested", vi: "Gợi ý", zh: "建议答案",
    fil: "Mungkahi", ja: "おすすめ",
  },
  yes: {
    ko: "예", en: "Yes", vi: "Có", zh: "是", fil: "Oo",
    ja: "はい", th: "ใช่", id: "Ya", ru: "Да", hi: "हाँ", ar: "نعم",
  },
  no: {
    ko: "아니오", en: "No", vi: "Không", zh: "不是", fil: "Hindi",
    ja: "いいえ", th: "ไม่", id: "Tidak", ru: "Нет", hi: "नहीं", ar: "لا",
  },
  notYet: {
    ko: "조금 달랐어요. 한 번 더 해볼까요?",
    en: "That was a little different. Shall we try once more?",
    vi: "Hơi khác một chút. Mình thử lại nhé?",
    zh: "有一点不一样，再试一次好吗?",
    fil: "Medyo iba pala. Subukan nating muli?",
    ja: "ちょっと ちがったね。もういちど やってみる?",
  },
  answerWas: {
    ko: "정답은", en: "The answer was", vi: "Đáp án là", zh: "答案是",
    fil: "Ang sagot ay", ja: "こたえは",
  },
  asked: {
    ko: "물어본 질문", en: "Asked", vi: "Đã hỏi", zh: "已问",
    fil: "Naitanong", ja: "きいた かず",
  },
};

const CATEGORY_META: Record<TwentyQCategory, { emoji: string; label: LangMap }> = {
  country: {
    emoji: "🌏",
    label: {
      ko: "나라", en: "Country", vi: "Quốc gia", zh: "国家", fil: "Bansa",
      ja: "くに", th: "ประเทศ", id: "Negara", ru: "Страна", hi: "देश", ar: "دولة",
    },
  },
  food: {
    emoji: "🍜",
    label: {
      ko: "음식", en: "Food", vi: "Món ăn", zh: "食物", fil: "Pagkain",
      ja: "たべもの", th: "อาหาร", id: "Makanan", ru: "Еда", hi: "खाना", ar: "طعام",
    },
  },
  person: {
    emoji: "👤",
    label: {
      ko: "직업", en: "Job", vi: "Nghề nghiệp", zh: "职业", fil: "Trabaho",
      ja: "しごと", th: "อาชีพ", id: "Pekerjaan", ru: "Профессия", hi: "काम", ar: "مهنة",
    },
  },
};

const GROUP_LABEL: Record<HintGroup, { emoji: string; label: LangMap }> = {
  region: {
    emoji: "🗺️",
    label: { ko: "지역", en: "Region", vi: "Vùng", zh: "地区", fil: "Rehiyon", ja: "ちいき" },
  },
  taste: {
    emoji: "👅",
    label: { ko: "맛과 느낌", en: "Taste", vi: "Mùi vị", zh: "味道", fil: "Lasa", ja: "あじ" },
  },
  use: {
    emoji: "🛠️",
    label: { ko: "쓰임", en: "Use", vi: "Công dụng", zh: "用途", fil: "Gamit", ja: "つかいかた" },
  },
  form: {
    emoji: "🔍",
    label: { ko: "생김새", en: "Form", vi: "Hình dáng", zh: "外形", fil: "Hugis", ja: "かたち" },
  },
  misc: {
    emoji: "✨",
    label: { ko: "그 밖에", en: "Other", vi: "Khác", zh: "其他", fil: "Iba pa", ja: "そのほか" },
  },
};

// 아이템별 PNG (있는 것만). 없거나 로드 실패 시 이모지 폴백 (ItemArt).
const ITEM_IMAGES: Record<string, string> = {
  // country → landmarks
  "c-kr": "/landmarks/korea.png", "c-vn": "/landmarks/vietnam.png",
  "c-cn": "/landmarks/china.png", "c-jp": "/landmarks/japan.png",
  "c-th": "/landmarks/thailand.png", "c-ph": "/landmarks/philippines.png",
  "c-us": "/landmarks/usa.png", "c-ru": "/landmarks/russia.png",
  "c-id": "/landmarks/indonesia.png", "c-in": "/landmarks/india.png",
  // food → 기존 에셋 재사용
  "f-rice": "/spotit/rice.png",
  "f-tea": "/spotit/tea.png",
  "f-banana": "/halligalli/banana.png",
  "f-pho": "/game-assets/puzzle/pho.png",
  // 배치 생성분 (scripts/gen-batch-assets.mjs → public/game-assets/twentyq/)
  "f-ramen": "/game-assets/twentyq/f-ramen.png",
  "f-kimchi": "/game-assets/twentyq/f-kimchi.png",
  "f-pizza": "/game-assets/twentyq/f-pizza.png",
  "f-sushi": "/game-assets/twentyq/f-sushi.png",
  "f-curry": "/game-assets/twentyq/f-curry.png",
  "f-ice": "/game-assets/twentyq/f-ice.png",
  "p-teacher": "/game-assets/twentyq/p-teacher.png",
  "p-doctor": "/game-assets/twentyq/p-doctor.png",
  "p-chef": "/game-assets/twentyq/p-chef.png",
  "p-police": "/game-assets/twentyq/p-police.png",
  "p-firefighter": "/game-assets/twentyq/p-firefighter.png",
  "p-farmer": "/game-assets/twentyq/p-farmer.png",
  "p-driver": "/game-assets/twentyq/p-driver.png",
  "p-nurse": "/game-assets/twentyq/p-nurse.png",
  "p-artist": "/game-assets/twentyq/p-artist.png",
  "p-singer": "/game-assets/twentyq/p-singer.png",
};

type ArtSize = "md" | "lg";

// PNG 우선 + 이모지 폴백 아이템 그림 (404 시 게임이 깨지지 않게).
// 크기는 px 이 아니라 CSS 클래스 + 토큰 배수로만 정한다.
function ItemArt({ item, size = "md" }: { item: TwentyQItem; size?: ArtSize }) {
  const [failed, setFailed] = useState(false);
  const src = ITEM_IMAGES[item.id];
  if (!src || failed) {
    return <span className="tq-art-emoji" data-size={size} aria-hidden="true">{item.emoji}</span>;
  }
  return (
    <img
      className="tq-art-img"
      data-size={size}
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

/** 진행 막대 폭만 인라인으로 준다 (상태에 따라 변하므로 CSS 클래스로 표현 불가). */
function barWidth(ratio: number): React.CSSProperties {
  return { width: `${Math.max(0, Math.min(1, ratio)) * 100}%` };
}

export default function TwentyQuestions({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("category");
  const [category, setCategory] = useState<TwentyQCategory | null>(null);
  const [secret, setSecret] = useState<TwentyQItem | null>(null);
  const [remaining, setRemaining] = useState(TOTAL_QUESTIONS);
  const [usedFlags, setUsedFlags] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<{ cardEmoji: string; labelA: string; yes: boolean }[]>([]);
  const [pendingCard, setPendingCard] = useState<HintCard | null>(null);
  const [guessChoices, setGuessChoices] = useState<TwentyQItem[]>([]);
  const [finalPick, setFinalPick] = useState<TwentyQItem | null>(null);
  const [sessionKey, setSessionKey] = useState(0); // bump to reshuffle

  const setupCandidates = useMemo<TwentyQItem[]>(() => {
    if (!category) return [];
    const pool = TWENTYQ_ITEMS.filter((i) => i.category === category);
    return pickN(pool, Math.min(8, pool.length));
  }, [category, sessionKey]);

  function chooseCategory(cat: TwentyQCategory) {
    setCategory(cat);
    setPhase("setup");
  }

  function pickSecret(item: TwentyQItem) {
    setSecret(item);
    setRemaining(TOTAL_QUESTIONS);
    setUsedFlags(new Set());
    setLog([]);
    setPhase("play");
  }

  function tapCard(card: HintCard) {
    if (remaining <= 0) return;
    if (usedFlags.has(card.flag as string)) return;
    setPendingCard(card);
    setPhase("asking");
  }

  function answerCard(yes: boolean) {
    if (!pendingCard) return;
    const labelA = tr(pendingCard.label, langA);
    setLog((l) => [{ cardEmoji: pendingCard.emoji, labelA, yes }, ...l].slice(0, 3));
    setUsedFlags((s) => new Set(s).add(pendingCard.flag as string));
    setRemaining((r) => r - 1);
    setPendingCard(null);
    setPhase("play");
  }

  function startGuess() {
    if (!category || !secret) return;
    const pool = TWENTYQ_ITEMS.filter((i) => i.category === category && i.id !== secret.id);
    const others = pickN(pool, Math.min(7, pool.length));
    const mix = [...others, secret].sort(() => Math.random() - 0.5);
    setGuessChoices(mix);
    setPhase("guess");
  }

  function submitGuess(item: TwentyQItem) {
    setFinalPick(item);
    setPhase("result");
  }

  function resetAll() {
    setPhase("category");
    setCategory(null);
    setSecret(null);
    setRemaining(TOTAL_QUESTIONS);
    setUsedFlags(new Set());
    setLog([]);
    setPendingCard(null);
    setGuessChoices([]);
    setFinalPick(null);
    setSessionKey((k) => k + 1);
  }

  // ---- render ----
  if (phase === "category") {
    return (
      <div data-ux-root className="tq-root tq-page">
        <ScopedStyle css={TQ_CSS} />
        <h2 data-ux-role="title" className="tq-title">🔎 {gt(TQ.title, langA)}</h2>
        <p data-ux-role="body" className="tq-lede">{gt(TQ.pickCategory, langA)}</p>
        <div className="tq-cards">
          {(Object.keys(CATEGORY_META) as TwentyQCategory[]).map((cat) => {
            const m = CATEGORY_META[cat];
            return (
              <button
                key={cat}
                type="button"
                data-ux-role="action"
                className="tq-catbtn"
                data-cat={cat}
                onClick={() => chooseCategory(cat)}
                aria-label={gp(m.label, langA)}
              >
                <span className="tq-art-emoji" data-size="lg" aria-hidden="true">{m.emoji}</span>
                <span>{gt(m.label, langA)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div data-ux-root className="tq-root tq-page">
        <ScopedStyle css={TQ_CSS} />
        <SetupPanel
          candidates={setupCandidates}
          category={category!}
          langB={langB}
          onPick={pickSecret}
          onBack={resetAll}
        />
      </div>
    );
  }

  if (phase === "play" || phase === "asking") {
    const noneLeft = remaining <= 0;
    return (
      // AskModal 도 이 루트 안에 둔다 — 화면 분기마다 data-ux-root 는 하나뿐이어야 한다.
      <div data-ux-root className="tq-root tq-play">
        <ScopedStyle css={TQ_CSS} />
        <PlayHeader category={category!} remaining={remaining} langA={langA} onBack={resetAll} />

        <div className="tq-cols">
          <section className="tq-logcol" data-ux-surface="panel" aria-live="polite">
            <h3 data-ux-role="label" className="tq-colhead">🗒 {gt(TQ.recent, langA)}</h3>
            {log.length === 0 ? (
              <p data-ux-role="secondary" className="tq-empty">{gt(TQ.noneYet, langA)}</p>
            ) : (
              <ul className="tq-loglist">
                {log.map((e, i) => (
                  <li key={i} className="tq-logrow">
                    <span className="tq-logemoji" aria-hidden="true">{e.cardEmoji}</span>
                    <span data-ux-role="body" className="tq-logtext">{e.labelA}</span>
                    <span data-ux-role="label" className="tq-yn" data-yes={e.yes ? "" : undefined}>
                      {e.yes ? gp(TQ.yes, langA) : gp(TQ.no, langA)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tq-askcol">
            <h3 data-ux-role="label" className="tq-colhead">❓ {gt(TQ.askPrompt, langA)}</h3>
            {noneLeft && (
              <p data-ux-role="body" className="tq-notice" role="status">
                🐝 {gt(TQ.outOfQuestions, langA)}
              </p>
            )}
            <HintGrid usedFlags={usedFlags} onTap={tapCard} langA={langA} noneLeft={noneLeft} />

            <div className="tq-actions">
              <button type="button" data-ux-role="action" className="tq-primary" onClick={startGuess}>
                🎯 {gp(TQ.sayAnswer, langA)}
              </button>
              <button type="button" data-ux-role="control" className="tq-secondary" onClick={resetAll}>
                ↩ {gp(TQ.toStart, langA)}
              </button>
            </div>
          </section>
        </div>

        {phase === "asking" && pendingCard && secret && (
          <AskModal card={pendingCard} secret={secret} langB={langB} onAnswer={answerCard} />
        )}
      </div>
    );
  }

  if (phase === "guess") {
    return (
      <div data-ux-root className="tq-root tq-page">
        <ScopedStyle css={TQ_CSS} />
        <h2 data-ux-role="title" className="tq-title">🎯 {gt(TQ.guessTitle, langA)}</h2>
        <p data-ux-role="body" className="tq-lede">{gt(TQ.guessHowto, langA)}</p>
        <div className="tq-cards">
          {guessChoices.map((it) => (
            <button
              key={it.id}
              type="button"
              data-ux-role="control"
              className="tq-pick"
              onClick={() => submitGuess(it)}
              aria-label={tr(it.names, langA)}
            >
              <ItemArt item={it} />
              <span><GameText map={it.names} lang={langA} /></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // result
  const correct = finalPick && secret && finalPick.id === secret.id;
  const asked = TOTAL_QUESTIONS - remaining;
  return (
    <div data-ux-root className="tq-root tq-page tq-result">
      <ScopedStyle css={TQ_CSS} />
      <BeeMascot size={120} mood={correct ? "cheer" : "think"} />
      <h2 data-ux-role="title" className="tq-title">
        {correct ? gt(UI.correct, langA) : gt(TQ.notYet, langA)}
      </h2>
      {secret && (
        <p data-ux-role="body-emphasis" className="tq-answer">
          <span>{gt(TQ.answerWas, langA)}</span>
          <ItemArt item={secret} size="lg" />
          <b><GameText map={secret.names} lang={langA} /></b>
          <span className="tq-answerb">/ <GameText map={secret.names} lang={langB} /></span>
        </p>
      )}
      <div className="tq-progress">
        <div className="tq-progresstop">
          <span data-ux-role="secondary">{gt(TQ.asked, langA)} {asked} / {TOTAL_QUESTIONS}</span>
          <span data-ux-role="secondary">⭐ {correct ? 1 : 0}</span>
        </div>
        <div className="tq-track"><div className="tq-fill" style={barWidth(asked / TOTAL_QUESTIONS)} /></div>
      </div>
      <button type="button" data-ux-role="action" className="tq-primary" onClick={resetAll}>
        🔄 {gp(UI.playAgain, langA)}
      </button>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

/**
 * U01: 예전에는 카테고리 이름이 가운데 오는 자체 머리(.tq-head)였다. 이제
 * 가운데는 어느 게임에서나 게임 이름이고, 카테고리는 오른쪽 상태 칩이 된다.
 */
function PlayHeader({
  category, remaining, langA, onBack,
}: { category: TwentyQCategory; remaining: number; langA: string; onBack: () => void }) {
  const m = CATEGORY_META[category];
  return (
    <GameHeader
      gameId="twentyq"
      title="스무고개"
      icon="🔎"
      onBack={onBack}
      backLabel="처음"
      progress={{ value: TOTAL_QUESTIONS - remaining, max: TOTAL_QUESTIONS }}
      status={
        <>
          <GameStat icon={m.emoji} label={gp(TQ.pickCategory, langA)} value={gp(m.label, langA)} />
          <GameStat
            icon="❓"
            label={gp(TQ.remain, langA)}
            value={`${remaining} / ${TOTAL_QUESTIONS}`}
            tone={remaining <= 3 ? "warn" : "key"}
          />
        </>
      }
    />
  );
}

function HintGrid({
  usedFlags, onTap, langA, noneLeft,
}: {
  usedFlags: Set<string>;
  onTap: (c: HintCard) => void;
  langA: string;
  noneLeft: boolean;
}) {
  const groups: HintGroup[] = ["region", "taste", "use", "form", "misc"];
  return (
    <div className="tq-groups">
      {groups.map((g) => {
        const cards = HINT_CARDS.filter((c) => c.group === g);
        if (cards.length === 0) return null;
        const meta = GROUP_LABEL[g];
        return (
          <div key={g}>
            <h4 data-ux-role="secondary" className="tq-grouphead">
              {meta.emoji} {gt(meta.label, langA)}
            </h4>
            <div className="tq-cards">
              {cards.map((c) => {
                const used = usedFlags.has(c.flag as string);
                const blocked = used || noneLeft;
                return (
                  <button
                    key={c.flag as string}
                    type="button"
                    data-ux-role="control"
                    className="tq-hint"
                    data-used={used ? "" : undefined}
                    aria-disabled={blocked || undefined}
                    onClick={() => { if (blocked) return; onTap(c); }}
                    aria-label={tr(c.label, langA)}
                  >
                    <span className="tq-hintemoji" aria-hidden="true">{c.emoji}</span>
                    <span className="tq-hinttext"><GameText map={c.label} lang={langA} /></span>
                    {used && (
                      <span data-ux-role="secondary" className="tq-usedtag">✔ {gp(TQ.used, langA)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SetupPanel({
  candidates, category, langB, onPick, onBack,
}: {
  candidates: TwentyQItem[];
  category: TwentyQCategory;
  langB: string;
  onPick: (it: TwentyQItem) => void;
  onBack: () => void;
}) {
  const m = CATEGORY_META[category];
  return (
    <>
      <h2 data-ux-role="title" className="tq-title">{m.emoji} {gt(TQ.setupTitle, langB)}</h2>
      <p data-ux-role="body" className="tq-lede">{gt(TQ.setupHowto, langB)}</p>
      <div className="tq-cards">
        {candidates.map((it) => (
          <button
            key={it.id}
            type="button"
            data-ux-role="control"
            className="tq-pick tq-pick-cat"
            data-cat={category}
            onClick={() => onPick(it)}
            aria-label={tr(it.names, langB)}
          >
            <ItemArt item={it} />
            <span><GameText map={it.names} lang={langB} /></span>
          </button>
        ))}
      </div>
      <div className="tq-actions">
        <button type="button" data-ux-role="control" className="tq-secondary" onClick={onBack}>
          ↩ {gp(TQ.changeCategory, langB)}
        </button>
      </div>
    </>
  );
}

function AskModal({
  card, secret, langB, onAnswer,
}: {
  card: HintCard;
  secret: TwentyQItem;
  langB: string;
  onAnswer: (yes: boolean) => void;
}) {
  // auto-recommend based on secret.hints
  const flagVal = secret.hints[card.flag];
  const recommended: boolean = flagVal === true;
  return (
    <div role="dialog" aria-modal="true" className="tq-scrim">
      <div className="tq-modal" data-ux-surface="panel">
        <p data-ux-role="secondary" className="tq-modallede">{gt(TQ.answerHere, langB)}</p>
        <p data-ux-role="body-emphasis" className="tq-modalq">
          <span className="tq-art-emoji" aria-hidden="true">{card.emoji}</span>
          <span><GameText map={card.label} lang={langB} /></span>
        </p>
        <p data-ux-role="secondary" className="tq-suggest">
          {gt(TQ.suggest, langB)}: {recommended ? gp(TQ.yes, langB) : gp(TQ.no, langB)}
        </p>
        <div className="tq-yesno">
          <button
            type="button"
            data-ux-role="action"
            className="tq-yes"
            onClick={() => onAnswer(true)}
            aria-label={gp(TQ.yes, langB)}
          >⭕ {gp(TQ.yes, langB)}</button>
          <button
            type="button"
            data-ux-role="action"
            className="tq-no"
            onClick={() => onAnswer(false)}
            aria-label={gp(TQ.no, langB)}
          >✖ {gp(TQ.no, langB)}</button>
        </div>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것.
   넓은 화면에서는 좌우 2단 + 보기 격자로 펼친다 (좁은 고정폭 금지). */
const TQ_CSS = `
.tq-root{
  color: var(--ux-ink);
  max-width: 1180px; margin: 0 auto;
  padding: var(--ux-space-6) var(--ux-space-4) var(--ux-space-12);
  word-break: keep-all; overflow-wrap: anywhere;
}
.tq-root button{ font-family: inherit; }
.tq-title{ margin: 0 0 var(--ux-space-2); }
.tq-lede{ margin: 0 0 var(--ux-space-4); color: var(--ux-ink-soft); }

.tq-cards{
  display: grid; gap: var(--ux-space-3);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: stretch;
}

.tq-catbtn{
  display: flex; align-items: center; gap: var(--ux-space-3);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 3px solid var(--ux-primary-border);
  font-weight: 800; text-align: left;
}
.tq-catbtn[data-cat="country"]{ background: var(--ux-hint-apricot); }
.tq-catbtn[data-cat="food"]{ background: var(--ux-hint-mint); }
.tq-catbtn[data-cat="person"]{ background: var(--ux-hint-lavender); }

.tq-pick{
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-weight: 800; text-align: center;
}
.tq-pick-cat[data-cat="country"]{ background: var(--ux-hint-apricot); }
.tq-pick-cat[data-cat="food"]{ background: var(--ux-hint-mint); }
.tq-pick-cat[data-cat="person"]{ background: var(--ux-hint-lavender); }

.tq-art-img{ width: 3.25rem; height: 3.25rem; object-fit: contain; }
.tq-art-img[data-size="lg"]{ width: 4.5rem; height: 4.5rem; }
.tq-art-emoji{ font-size: calc(var(--ux-font-title) * 1.2); line-height: 1; }
.tq-art-emoji[data-size="lg"]{ font-size: calc(var(--ux-font-title) * 1.8); }

.tq-play{ min-height: 100svh; background: var(--ux-bg); }
/* U01: .tq-head(카테고리 머리)는 공용 GameHeader 로 대체됐다. */

.tq-cols{ display: grid; gap: var(--ux-space-4); }
.tq-logcol{ order: 2; padding: var(--ux-space-4); border: 2px solid var(--ux-primary-border); }
.tq-askcol{ order: 1; display: grid; gap: var(--ux-space-3); align-content: start; }
@media (min-width: 1024px){
  .tq-cols{ grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); align-items: start; }
  .tq-logcol, .tq-askcol{ order: 0; }
  .tq-logcol{ position: sticky; top: var(--ux-space-4); }
}

.tq-colhead{ margin: 0 0 var(--ux-space-2); font-weight: 900; }
.tq-empty{ margin: 0; }
.tq-loglist{ list-style: none; margin: 0; padding: 0; display: grid; gap: var(--ux-space-2); }
.tq-logrow{
  display: flex; align-items: center; gap: var(--ux-space-2);
  padding: var(--ux-space-2) 0;
  border-bottom: 1px solid var(--ux-surface-sunk);
}
.tq-logrow:last-child{ border-bottom: none; }
.tq-logemoji{ font-size: calc(var(--ux-font-body) * 1.2); line-height: 1; }
.tq-logtext{ flex: 1; min-width: 0; }
.tq-yn{
  font-weight: 900; white-space: nowrap;
  padding: var(--ux-space-1) var(--ux-space-3);
  border-radius: var(--ux-radius-pill);
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
}
.tq-yn[data-yes]{
  background: color-mix(in srgb, var(--ux-success) 16%, var(--ux-surface));
  color: var(--ux-success);
}

.tq-groups{ display: grid; gap: var(--ux-space-4); }
.tq-grouphead{ margin: 0 0 var(--ux-space-2); font-weight: 900; }
.tq-hint{
  display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-weight: 800; text-align: left;
  transition: background var(--ux-motion-state) var(--ux-motion-ease);
}
.tq-hint[data-used]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border-color: var(--ux-surface-sunk);
}
.tq-hint[aria-disabled="true"]{ cursor: default; }
.tq-hintemoji{ font-size: calc(var(--ux-font-label) * 1.3); line-height: 1; }
.tq-hinttext{ flex: 1; min-width: 0; }
.tq-usedtag{ white-space: nowrap; }

.tq-notice{
  margin: 0; padding: var(--ux-space-3) var(--ux-space-4);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
}
.tq-actions{ display: flex; gap: var(--ux-space-3); flex-wrap: wrap; margin-top: var(--ux-space-4); }
.tq-primary{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-weight: 900;
}
.tq-secondary{
  background: var(--ux-surface); color: var(--ux-ink-soft);
  border: 2px solid var(--ux-primary-border); font-weight: 800;
}

.tq-scrim{
  position: fixed; inset: 0; z-index: 600;
  background: color-mix(in srgb, var(--ux-ink) 60%, transparent);
  display: flex; align-items: center; justify-content: center;
  padding: var(--ux-space-4);
}
.tq-modal{
  width: 100%; max-width: 34rem;
  background: var(--ux-surface);
  padding: var(--ux-space-6);
  display: grid; gap: var(--ux-space-3);
  box-shadow: 0 30px 60px rgba(0,0,0,0.25);
}
.tq-modallede, .tq-suggest{ margin: 0; }
.tq-modalq{
  margin: 0; display: flex; align-items: center; gap: var(--ux-space-3);
  font-weight: 900;
}
.tq-yesno{
  display: grid; gap: var(--ux-space-3);
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}
.tq-yes{ background: var(--ux-success); color: var(--ux-surface); border: 2px solid var(--ux-success); font-weight: 900; }
.tq-no{ background: var(--ux-surface); color: var(--ux-ink); border: 3px solid var(--ux-primary-border); font-weight: 900; }

.tq-result{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; }
.tq-answer{
  margin: 0; display: flex; align-items: center; justify-content: center;
  gap: var(--ux-space-2); flex-wrap: wrap; font-weight: 800;
}
.tq-answerb{ color: var(--ux-ink-soft); }
.tq-progress{ width: 100%; max-width: 32rem; }
.tq-progresstop{ display: flex; justify-content: space-between; margin-bottom: var(--ux-space-1); }
.tq-track{ height: 10px; background: var(--ux-surface-sunk); border-radius: var(--ux-radius-pill); overflow: hidden; }
.tq-fill{ height: 100%; background: var(--ux-primary-fill); transition: width var(--ux-motion-state) var(--ux-motion-ease); }
`;
