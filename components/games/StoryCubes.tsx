"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { LangMap, STORY_SYMBOLS, StorySymbol, pickN, tr } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import { LANGUAGES } from "@/lib/constants";
import { cancelSpeak } from "@/lib/ttsMulti";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import { gt, UI } from "./uiText";
import { gp } from "./plainText";

// ============================================================
// Types & state
// ============================================================

type StoryMode = "free" | "theme";
type Player = "A" | "B";
type Phase = "INTRO" | "SELECT" | "COMPOSE" | "GALLERY";

interface PickedEntry {
  order: number; by: Player; symbolId: number;
  sentence: string; sentenceLang: string;
  translation?: string; translationLang?: string;
  createdAt: number;
}

interface GameState {
  mode: StoryMode; theme?: LangMap;
  tiles: StorySymbol[]; available: number[]; entries: PickedEntry[];
  turn: Player; selectedTileIndex: number | null;
  draftSentence: string; draftTranslation: string;
  skipsLeft: Record<Player, number>; rerollsLeft: Record<Player, number>;
  phase: Phase;
}

type Action =
  | { type: "START"; mode: StoryMode; theme?: LangMap }
  | { type: "SELECT_TILE"; tileIndex: number }
  | { type: "CANCEL_SELECT" }
  | { type: "EDIT_SENTENCE"; value: string }
  | { type: "EDIT_TRANSLATION"; value: string }
  | { type: "COMMIT"; langA: string; langB: string }
  | { type: "SKIP" }
  | { type: "REROLL" }
  | { type: "RESTART" };

const THEMES: Array<{ key: string; label: LangMap }> = [
  { key: "adventure",  label: { ko: "모험 이야기",    en: "Adventure",  vi: "Cuộc phiêu lưu", zh: "冒险故事", ja: "冒険物語" } },
  { key: "friendship", label: { ko: "우정 이야기",    en: "Friendship", vi: "Tình bạn",       zh: "友情故事", ja: "友情物語" } },
  { key: "dream",      label: { ko: "꿈 이야기",       en: "A Dream",    vi: "Giấc mơ",        zh: "梦的故事", ja: "夢の物語" } },
  { key: "home",       label: { ko: "우리 집 이야기", en: "Home",       vi: "Ngôi nhà",       zh: "家的故事", ja: "家の物語" } },
];

function initialState(): GameState {
  return {
    mode: "free", theme: undefined, tiles: [], available: [], entries: [],
    turn: "A", selectedTileIndex: null, draftSentence: "", draftTranslation: "",
    skipsLeft: { A: 1, B: 1 }, rerollsLeft: { A: 1, B: 1 }, phase: "INTRO",
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START": {
      const tiles = pickN(STORY_SYMBOLS, 9);
      return { ...initialState(), mode: action.mode, theme: action.theme, tiles, available: tiles.map((_, i) => i), phase: "SELECT" };
    }
    case "SELECT_TILE": {
      if (state.phase !== "SELECT" || !state.available.includes(action.tileIndex)) return state;
      return { ...state, selectedTileIndex: action.tileIndex, draftSentence: "", draftTranslation: "", phase: "COMPOSE" };
    }
    case "CANCEL_SELECT": {
      if (state.phase !== "COMPOSE") return state;
      return { ...state, selectedTileIndex: null, draftSentence: "", draftTranslation: "", phase: "SELECT" };
    }
    case "EDIT_SENTENCE":
      return state.phase === "COMPOSE" ? { ...state, draftSentence: action.value.slice(0, 120) } : state;
    case "EDIT_TRANSLATION":
      return state.phase === "COMPOSE" ? { ...state, draftTranslation: action.value.slice(0, 120) } : state;
    case "COMMIT": {
      if (state.phase !== "COMPOSE" || state.selectedTileIndex === null || !state.draftSentence.trim()) return state;
      const tile = state.tiles[state.selectedTileIndex];
      const sentenceLang = state.turn === "A" ? action.langA : action.langB;
      const translationLang = state.turn === "A" ? action.langB : action.langA;
      const tTrim = state.draftTranslation.trim();
      const entry: PickedEntry = {
        order: state.entries.length + 1, by: state.turn, symbolId: tile.id,
        sentence: state.draftSentence.trim(), sentenceLang,
        translation: tTrim || undefined, translationLang: tTrim ? translationLang : undefined,
        createdAt: Date.now(),
      };
      const nextAvail = state.available.filter((i) => i !== state.selectedTileIndex);
      return {
        ...state, entries: [...state.entries, entry], available: nextAvail,
        turn: state.turn === "A" ? "B" : "A", selectedTileIndex: null,
        draftSentence: "", draftTranslation: "",
        phase: nextAvail.length === 0 ? "GALLERY" : "SELECT",
      };
    }
    case "SKIP": {
      if ((state.phase !== "SELECT" && state.phase !== "COMPOSE") || state.skipsLeft[state.turn] <= 0) return state;
      return {
        ...state, skipsLeft: { ...state.skipsLeft, [state.turn]: state.skipsLeft[state.turn] - 1 },
        turn: state.turn === "A" ? "B" : "A", selectedTileIndex: null,
        draftSentence: "", draftTranslation: "", phase: "SELECT",
      };
    }
    case "REROLL": {
      if (state.phase !== "SELECT" || state.rerollsLeft[state.turn] <= 0) return state;
      const usedIds = new Set(state.tiles.filter((_, i) => !state.available.includes(i)).map((s) => s.id));
      const pool = STORY_SYMBOLS.filter((s) => !usedIds.has(s.id));
      const fresh = pickN(pool, state.available.length);
      const newTiles = state.tiles.slice();
      state.available.forEach((tileIdx, j) => { if (fresh[j]) newTiles[tileIdx] = fresh[j]; });
      return { ...state, tiles: newTiles, rerollsLeft: { ...state.rerollsLeft, [state.turn]: state.rerollsLeft[state.turn] - 1 } };
    }
    case "RESTART":
      return initialState();
    default:
      return state;
  }
}

// ============================================================
// 게임 고유 UI 문구 — 짧은 동작 버튼은 gp(), 제목·안내문은 gt()
// ============================================================

const SC: Record<string, LangMap> = {
  title: {
    ko: "이야기 주사위", en: "Story Cubes", vi: "Xúc xắc kể chuyện", zh: "故事骰子",
    fil: "Story Cubes", ja: "おはなし サイコロ",
  },
  howto: {
    ko: "둘이 한 문장씩 번갈아가며 그림 이야기를 만들어요",
    en: "Take turns adding one sentence to the picture story",
    vi: "Hai bạn thay phiên thêm một câu cho câu chuyện tranh",
    zh: "两人轮流各说一句，一起编图画故事",
    fil: "Salitan kayong magdagdag ng isang pangungusap sa kuwento",
  },
  modePick: {
    ko: "모드 고르기", en: "Choose a mode", vi: "Chọn chế độ", zh: "选择模式",
    fil: "Pumili ng mode", ja: "モードを えらぶ",
  },
  freeMode: {
    ko: "자유 모드", en: "Free mode", vi: "Tự do", zh: "自由模式", fil: "Malayang mode",
  },
  freeDesc: {
    ko: "주제 없이 상상한 대로", en: "No topic, just imagine", vi: "Không chủ đề, thoải mái tưởng tượng",
    zh: "没有主题，尽情想象", fil: "Walang paksa, mag-imagine lang",
  },
  themeMode: {
    ko: "테마 모드", en: "Theme mode", vi: "Chế độ chủ đề", zh: "主题模式", fil: "Theme mode",
  },
  themeDesc: {
    ko: "주제 하나를 정해요", en: "Pick one topic", vi: "Chọn một chủ đề",
    zh: "定一个主题", fil: "Pumili ng isang paksa",
  },
  pickTheme: {
    ko: "주제 고르기", en: "Choose a topic", vi: "Chọn chủ đề", zh: "选主题", fil: "Pumili ng paksa",
  },
  howtoTitle: {
    ko: "놀이 방법", en: "How to play", vi: "Cách chơi", zh: "玩法", fil: "Paano laruin",
  },
  step1: {
    ko: "타일 9개 중 하나를 고르고 내 언어로 한 문장 쓰기",
    en: "Pick one of the 9 tiles and write one sentence in your language",
    vi: "Chọn một trong 9 ô và viết một câu bằng tiếng của mình",
    zh: "从9个图块里选一个，用自己的语言写一句话",
    fil: "Pumili ng isa sa 9 na tile at sumulat ng isang pangungusap",
  },
  step2: {
    ko: "친구와 번갈아가며 9번 채우기",
    en: "Take turns with your friend until all 9 are filled",
    vi: "Thay phiên với bạn cho đến khi đủ 9 ô",
    zh: "和同伴轮流，把9个都填满",
    fil: "Salitan kayo hanggang mapuno ang lahat ng 9",
  },
  step3: {
    ko: "건너뛰기와 다시 뽑기는 각각 한 번씩 쓸 수 있어요",
    en: "Skip and reroll can be used once each",
    vi: "Bỏ lượt và tráo lại mỗi thứ dùng được một lần",
    zh: "跳过和重抽各能用一次",
    fil: "Isang beses lang ang skip at reroll",
  },
  startBtn: {
    ko: "이야기 시작하기", en: "Start the story", vi: "Bắt đầu câu chuyện",
    zh: "开始故事", fil: "Simulan ang kuwento",
  },
  player: {
    ko: "플레이어", en: "Player", vi: "Người chơi", zh: "玩家", fil: "Manlalaro",
    ja: "プレイヤー", th: "ผู้เล่น", id: "Pemain", ru: "Игрок", hi: "खिलाड़ी", ar: "لاعب",
  },
  myTurn: {
    ko: "내 차례", en: "Your turn", vi: "Lượt của bạn", zh: "轮到你", fil: "Turn mo",
  },
  skip: {
    ko: "건너뛰기", en: "Skip", vi: "Bỏ lượt", zh: "跳过", fil: "Laktawan",
    ja: "パス", th: "ข้าม", id: "Lewati", ru: "Пропуск", hi: "छोड़ें", ar: "تخطٍ",
  },
  reroll: {
    ko: "다시 뽑기", en: "Reroll", vi: "Tráo lại", zh: "重抽", fil: "Ulitin ang tiles",
    ja: "ふりなおし", th: "สุ่มใหม่", id: "Acak ulang", ru: "Заново", hi: "फिर निकालो", ar: "سحب جديد",
  },
  left: {
    ko: "남음", en: "left", vi: "còn", zh: "剩", fil: "natitira",
    ja: "のこり", th: "เหลือ", id: "sisa", ru: "осталось", hi: "बाकी", ar: "متبقٍ",
  },
  usedUp: {
    ko: "이번 놀이에서는 다 썼어요", en: "All used for this game",
    vi: "Đã dùng hết trong ván này", zh: "这局已经用完了", fil: "Ubos na sa laro na ito",
  },
  usedTile: {
    ko: "이미 쓴 그림", en: "Already used", vi: "Đã dùng rồi", zh: "已经用过",
    fil: "Nagamit na", ja: "つかった",
  },
};

const SC2: Record<string, LangMap> = {
  pickTile: {
    ko: "그림 하나를 골라요", en: "Choose one picture", vi: "Hãy chọn một bức tranh",
    zh: "选一张图", fil: "Pumili ng isang larawan", ja: "えを ひとつ えらぼう",
  },
  sentenceLabel: {
    ko: "한 문장 쓰기", en: "Write one sentence", vi: "Viết một câu",
    zh: "写一句话", fil: "Sumulat ng isang pangungusap",
  },
  transLabel: {
    ko: "번역 (없어도 괜찮아요)", en: "Translation (optional)", vi: "Bản dịch (không bắt buộc)",
    zh: "翻译 (可以不写)", fil: "Salin (opsyonal)",
  },
  phSentence: {
    ko: "한 문장으로 이야기를 이어가 보세요",
    en: "Continue the story in one sentence",
    vi: "Hãy tiếp tục câu chuyện bằng một câu",
    zh: "用一句话把故事接下去",
    fil: "Ituloy ang kuwento sa isang pangungusap",
  },
  phTrans: {
    ko: "친구에게 뜻을 알려주세요", en: "Tell your friend what it means",
    vi: "Cho bạn mình biết nghĩa của câu", zh: "告诉同伴这句话的意思",
    fil: "Sabihin sa kaibigan ang ibig sabihin",
  },
  otherTile: {
    ko: "다른 그림", en: "Other picture", vi: "Tranh khác", zh: "换一张图",
    fil: "Ibang larawan", ja: "べつの え",
  },
  addStory: {
    ko: "이야기에 더하기", en: "Add to story", vi: "Thêm vào chuyện",
    zh: "加进故事", fil: "Idagdag sa kuwento", ja: "おはなしに いれる",
  },
  needSentence: {
    ko: "한 문장을 쓰면 이야기에 더할 수 있어요",
    en: "Write one sentence to add it to the story",
    vi: "Viết một câu rồi mới thêm vào chuyện được",
    zh: "写一句话就可以加进故事了",
    fil: "Sumulat ng isang pangungusap para maidagdag",
  },
  soFar: {
    ko: "지금까지의 이야기", en: "The story so far", vi: "Câu chuyện đến giờ",
    zh: "到目前为止的故事", fil: "Ang kuwento hanggang ngayon",
  },
  nothingYet: {
    ko: "아직 문장이 없어요. 첫 문장을 써 볼까요?",
    en: "No sentences yet. Shall we write the first one?",
    vi: "Chưa có câu nào. Mình viết câu đầu nhé?",
    zh: "还没有句子，来写第一句吧?",
    fil: "Wala pang pangungusap. Sulatin natin ang una?",
  },
  galleryTitle: {
    ko: "우리의 이야기", en: "Our story", vi: "Câu chuyện của chúng mình",
    zh: "我们的故事", fil: "Ang kuwento namin", ja: "わたしたちの おはなし",
  },
  collected: {
    ko: "문장이 모였어요", en: "sentences collected", vi: "câu đã góp",
    zh: "句话完成了", fil: "na pangungusap ang naipon",
  },
  save: {
    ko: "저장", en: "Save", vi: "Lưu", zh: "保存", fil: "I-save",
    ja: "ほぞん", th: "บันทึก", id: "Simpan", ru: "Сохранить", hi: "सेव", ar: "حفظ",
  },
  saved: {
    ko: "이야기를 저장했어요 (연습용)", en: "Story saved (practice only)",
    vi: "Đã lưu câu chuyện (bản thử)", zh: "故事已保存 (练习用)",
    fil: "Na-save ang kuwento (pagsasanay lang)",
  },
  newStory: {
    ko: "새 이야기", en: "New story", vi: "Chuyện mới", zh: "新故事",
    fil: "Bagong kuwento", ja: "あたらしい おはなし",
  },
  readAloud: {
    ko: "읽어주기", en: "Read aloud", vi: "Đọc to", zh: "朗读",
    fil: "Basahin", ja: "よんで", th: "อ่านออกเสียง", id: "Bacakan", ru: "Прочитать", hi: "पढ़कर सुनाओ", ar: "اقرأ بصوت",
  },
  langLine: {
    ko: "우리가 쓰는 말", en: "Our languages", vi: "Ngôn ngữ của chúng mình",
    zh: "我们用的语言", fil: "Mga wika natin",
  },
};

// ============================================================
// Small subcomponents
// ============================================================

type ArtSize = "tile" | "compose" | "gallery";

/** 그림 크기는 px 이 아니라 CSS 클래스(토큰 배수)로만 정한다. */
function TileImage({ sym, size }: { sym: StorySymbol; size: ArtSize }) {
  const [failed, setFailed] = useState(false);
  if (failed || !sym.image) {
    return <span className="sc-emoji" data-size={size} aria-hidden="true">{sym.emoji}</span>;
  }
  return (
    <img
      className="sc-img"
      data-size={size}
      src={sym.image}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

function PlayerBadge({ player, turn, lang }: { player: Player; turn: Player; lang: string }) {
  const active = turn === player;
  return (
    <span
      data-ux-role="label"
      className="sc-badge"
      data-player={player}
      data-active={active ? "" : undefined}
    >
      {gp(SC.player, lang)} {player}{active ? ` · ${gp(SC.myTurn, lang)}` : ""}
    </span>
  );
}

/** 진행 막대 폭만 인라인 (값이 상태에 따라 변한다). */
function barWidth(ratio: number): React.CSSProperties {
  return { width: `${Math.max(0, Math.min(1, ratio)) * 100}%` };
}

// ============================================================
// Main
// ============================================================

export default function StoryCubes({ langA, langB }: { langA: string; langB: string }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const composingRef = useRef(false);
  const ttsRef = useRef<HTMLAudioElement | null>(null);

  const currentLang = state.turn === "A" ? langA : langB;
  const otherLang = state.turn === "A" ? langB : langA;

  /** 재생 중인 음성을 한 곳에서 끊는다 — 새 재생 전과 unmount 때 모두 이걸 쓴다. */
  const stopAudio = useCallback(() => {
    const a = ttsRef.current;
    if (a) {
      try { a.pause(); a.currentTime = 0; } catch { /* 이미 정리된 엘리먼트 */ }
      a.onerror = null;
      ttsRef.current = null;
    }
    cancelSpeak();   // lib/ttsMulti 경유 음성(Web Speech 포함)도 함께 끊는다
  }, []);

  // 문장을 확정하자마자 방을 나가도 음성이 계속 흐르지 않는다.
  useEffect(() => {
    return () => { stopAudio(); };
  }, [stopAudio]);

  const playTTS = useCallback((text: string, lang: string) => {
    if (!text.trim()) return;
    stopAudio();                       // 새 음성 전에 이전 음성을 반드시 멈춘다
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text.slice(0, 200))}&lang=${lang}`);
    ttsRef.current = a;
    a.play().catch(() => {});
  }, [stopAudio]);

  function handleCommit() {
    if (!state.draftSentence.trim()) return;
    playTTS(state.draftSentence.trim(), currentLang);
    dispatch({ type: "COMMIT", langA, langB });
  }

  if (state.phase === "INTRO") {
    return <IntroScreen langA={langA} langB={langB} onStart={(mode, theme) => dispatch({ type: "START", mode, theme })} />;
  }
  if (state.phase === "GALLERY") {
    return <GalleryScreen state={state} langA={langA} langB={langB} onRestart={() => dispatch({ type: "RESTART" })} />;
  }

  const total = 9;
  const selectedTile = state.selectedTileIndex !== null ? state.tiles[state.selectedTileIndex] : null;
  const skipOk = state.skipsLeft[state.turn] > 0;
  const rerollOk = state.rerollsLeft[state.turn] > 0 && state.phase === "SELECT";
  const composing = state.phase === "COMPOSE" && selectedTile !== null;
  const canCommit = state.draftSentence.trim().length > 0;

  return (
    <div data-ux-root className="sc-root sc-play">
      <ScopedStyle css={SC_CSS} />

      <div className="sc-head" data-ux-surface="panel">
        <div className="sc-badges">
          <PlayerBadge player="A" turn={state.turn} lang={langA} />
          <PlayerBadge player="B" turn={state.turn} lang={langB} />
        </div>
        <div className="sc-progress">
          <span data-ux-role="secondary">{state.entries.length} / {total}</span>
          <div className="sc-track"><div className="sc-fill" style={barWidth(state.entries.length / total)} /></div>
        </div>
        <div className="sc-headbtns">
          <button
            type="button"
            data-ux-role="control"
            className="sc-mini"
            aria-disabled={!skipOk || undefined}
            onClick={() => { if (!skipOk) return; dispatch({ type: "SKIP" }); }}
          >
            ⏭ {gp(SC.skip, currentLang)} {skipOk ? `${state.skipsLeft[state.turn]} ${gp(SC.left, currentLang)}` : gp(SC.usedUp, currentLang)}
          </button>
          <button
            type="button"
            data-ux-role="control"
            className="sc-mini"
            aria-disabled={!rerollOk || undefined}
            onClick={() => { if (!rerollOk) return; dispatch({ type: "REROLL" }); }}
          >
            🎲 {gp(SC.reroll, currentLang)} {state.rerollsLeft[state.turn] > 0 ? `${state.rerollsLeft[state.turn]} ${gp(SC.left, currentLang)}` : gp(SC.usedUp, currentLang)}
          </button>
        </div>
      </div>

      {state.theme && (
        <p data-ux-role="body-emphasis" className="sc-theme">
          📌 <GameText map={state.theme} lang={currentLang} />
        </p>
      )}

      <div className="sc-cols">
        <section className="sc-board">
          <h3 data-ux-role="label" className="sc-colhead">🎨 {gt(SC2.pickTile, currentLang)}</h3>
          <div className="sc-grid">
            {state.tiles.map((sym, idx) => {
              const used = !state.available.includes(idx);
              const selected = state.selectedTileIndex === idx;
              const entry = state.entries.find((e) => e.symbolId === sym.id);
              const clickable = !used && state.phase === "SELECT";
              return (
                <button
                  key={idx}
                  type="button"
                  data-ux-role="control"
                  className="sc-tile"
                  data-used={used ? "" : undefined}
                  data-selected={selected ? "" : undefined}
                  aria-disabled={!clickable || undefined}
                  onClick={() => { if (!clickable) return; dispatch({ type: "SELECT_TILE", tileIndex: idx }); }}
                  aria-label={used ? `${gp(SC.usedTile, currentLang)}: ${tr(sym.label, currentLang)}` : tr(sym.label, currentLang)}
                >
                  <TileImage sym={sym} size="tile" />
                  {entry && <span className="sc-order" data-player={entry.by}>{entry.order}</span>}
                  <span data-ux-role="secondary" className="sc-tilelabel">
                    <GameText map={sym.label} lang={currentLang} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="sc-side">
          {composing && selectedTile ? (
            <div className="sc-compose" data-ux-surface="panel">
              <div className="sc-composetop">
                <TileImage sym={selectedTile} size="compose" />
                <div className="sc-composewho">
                  <span data-ux-role="secondary">
                    {gp(SC.player, currentLang)} {state.turn} · {LANGUAGES[currentLang]?.label ?? currentLang}
                  </span>
                  <span data-ux-role="body-emphasis" className="sc-composename">
                    <GameText map={selectedTile.label} lang={currentLang} />
                  </span>
                </div>
              </div>

              <label className="sc-field">
                <span data-ux-role="label" className="sc-fieldhead">
                  ✏️ {LANGUAGES[currentLang]?.flag} {gt(SC2.sentenceLabel, currentLang)}
                </span>
                <textarea
                  className="sc-input"
                  value={state.draftSentence}
                  onChange={(e) => dispatch({ type: "EDIT_SENTENCE", value: e.target.value })}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  onKeyDown={(e) => {
                    // 한글·일본어 조합 중 Enter 는 글자를 확정하는 키다 — 여기서 제출하면 안 된다.
                    if (e.nativeEvent.isComposing || composingRef.current) return;
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCommit(); }
                  }}
                  maxLength={120}
                  rows={3}
                  aria-label={gp(SC2.sentenceLabel, currentLang)}
                  placeholder={gp(SC2.phSentence, currentLang)}
                />
              </label>

              <label className="sc-field">
                <span data-ux-role="label" className="sc-fieldhead">
                  🌐 {LANGUAGES[otherLang]?.flag} {gt(SC2.transLabel, otherLang)}
                </span>
                <textarea
                  className="sc-input sc-input-sub"
                  value={state.draftTranslation}
                  onChange={(e) => dispatch({ type: "EDIT_TRANSLATION", value: e.target.value })}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  onKeyDown={(e) => { if (e.nativeEvent.isComposing || composingRef.current) return; }}
                  maxLength={120}
                  rows={2}
                  aria-label={gp(SC2.transLabel, otherLang)}
                  placeholder={gp(SC2.phTrans, otherLang)}
                />
              </label>

              {!canCommit && (
                <p data-ux-role="secondary" className="sc-hint" role="status">
                  🐝 {gt(SC2.needSentence, currentLang)}
                </p>
              )}

              <div className="sc-composebtns">
                <button
                  type="button"
                  data-ux-role="control"
                  className="sc-secondary"
                  onClick={() => dispatch({ type: "CANCEL_SELECT" })}
                >← {gp(SC2.otherTile, currentLang)}</button>
                <button
                  type="button"
                  data-ux-role="action"
                  className="sc-primary"
                  aria-disabled={!canCommit || undefined}
                  onClick={() => { if (!canCommit) return; handleCommit(); }}
                >✨ {gp(SC2.addStory, currentLang)}</button>
              </div>
            </div>
          ) : (
            <div className="sc-sofar" data-ux-surface="panel">
              <h3 data-ux-role="label" className="sc-colhead">📖 {gt(SC2.soFar, currentLang)}</h3>
              {state.entries.length === 0 ? (
                <p data-ux-role="secondary" className="sc-empty">{gt(SC2.nothingYet, currentLang)}</p>
              ) : (
                <ol className="sc-sofarlist">
                  {state.entries.map((e) => (
                    <li key={e.order} className="sc-sofaritem">
                      <span className="sc-order" data-player={e.by}>{e.order}</span>
                      <span data-ux-role="body">{e.sentence}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ============================================================
// Intro
// ============================================================

function IntroScreen({ langA, langB, onStart }: { langA: string; langB: string; onStart: (mode: StoryMode, theme?: LangMap) => void }) {
  const [mode, setMode] = useState<StoryMode>("free");
  const [themeIdx, setThemeIdx] = useState(0);

  return (
    <div data-ux-root className="sc-root sc-intro">
      <ScopedStyle css={SC_CSS} />
      <BeeMascot size={110} mood="welcome" />
      <h2 data-ux-role="title" className="sc-title">📖 {gt(SC.title, langA)}</h2>
      <p data-ux-role="body" className="sc-lede">{gt(SC.howto, langA)}</p>

      <section className="sc-card" data-ux-surface="panel">
        <h3 data-ux-role="label" className="sc-colhead">1️⃣ {gt(SC.modePick, langA)}</h3>
        <div className="sc-modes">
          <button
            type="button"
            data-ux-role="control"
            className="sc-mode"
            data-active={mode === "free" ? "" : undefined}
            aria-pressed={mode === "free"}
            onClick={() => setMode("free")}
          >
            <span className="sc-emoji" data-size="compose" aria-hidden="true">✨</span>
            <span data-ux-role="body-emphasis">{gt(SC.freeMode, langA)}</span>
            <span data-ux-role="secondary">{gt(SC.freeDesc, langA)}</span>
          </button>
          <button
            type="button"
            data-ux-role="control"
            className="sc-mode"
            data-active={mode === "theme" ? "" : undefined}
            aria-pressed={mode === "theme"}
            onClick={() => setMode("theme")}
          >
            <span className="sc-emoji" data-size="compose" aria-hidden="true">🎯</span>
            <span data-ux-role="body-emphasis">{gt(SC.themeMode, langA)}</span>
            <span data-ux-role="secondary">{gt(SC.themeDesc, langA)}</span>
          </button>
        </div>

        {mode === "theme" && (
          <div className="sc-themes">
            <h4 data-ux-role="secondary" className="sc-colhead">{gt(SC.pickTheme, langA)}</h4>
            <div className="sc-themegrid">
              {THEMES.map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  data-ux-role="control"
                  className="sc-theme-btn"
                  data-active={themeIdx === i ? "" : undefined}
                  aria-pressed={themeIdx === i}
                  onClick={() => setThemeIdx(i)}
                  aria-label={tr(t.label, langA)}
                ><GameText map={t.label} lang={langA} /></button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="sc-card sc-guide" data-ux-surface="panel">
        <h3 data-ux-role="label" className="sc-colhead">🐝 {gt(SC.howtoTitle, langA)}</h3>
        <ul className="sc-steps">
          <li data-ux-role="body">{gt(SC.step1, langA)}</li>
          <li data-ux-role="body">{gt(SC.step2, langA)}</li>
          <li data-ux-role="body">{gt(SC.step3, langA)}</li>
        </ul>
        <p data-ux-role="secondary" className="sc-langline">
          {gt(SC2.langLine, langA)}: {LANGUAGES[langA]?.flag} {LANGUAGES[langA]?.label} ↔ {LANGUAGES[langB]?.flag} {LANGUAGES[langB]?.label}
        </p>
      </section>

      <button
        type="button"
        data-ux-role="action"
        className="sc-primary sc-start"
        onClick={() => onStart(mode, mode === "theme" ? THEMES[themeIdx].label : undefined)}
      >🚀 {gt(SC.startBtn, langA)}</button>
    </div>
  );
}

// ============================================================
// Gallery
// ============================================================

function GalleryScreen({ state, langA, langB, onRestart }: { state: GameState; langA: string; langB: string; onRestart: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [saved, setSaved] = useState(false);

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try { a.pause(); a.currentTime = 0; } catch { /* 이미 정리된 엘리먼트 */ }
      audioRef.current = null;
    }
    cancelSpeak();
  }, []);

  // 이야기를 읽어주는 중에 나가도 소리가 남지 않는다.
  useEffect(() => {
    return () => { stopAudio(); };
  }, [stopAudio]);

  const speak = useCallback((text: string, lang: string) => {
    if (!text.trim()) return;
    stopAudio();                       // 새 음성 전에 이전 음성을 멈춘다
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text.slice(0, 200))}&lang=${lang}`);
    audioRef.current = a;
    a.play().catch(() => {});
  }, [stopAudio]);

  return (
    <div data-ux-root className="sc-root sc-gallery">
      <ScopedStyle css={SC_CSS} />
      <div className="sc-gallerytop">
        <BeeMascot size={100} mood="cheer" />
        <h2 data-ux-role="title" className="sc-title">🎉 {gt(SC2.galleryTitle, langA)}</h2>
        {state.theme && (
          <p data-ux-role="body-emphasis" className="sc-theme">📌 <GameText map={state.theme} lang={langA} /></p>
        )}
        <p data-ux-role="secondary" className="sc-lede">{state.entries.length} · {gt(SC2.collected, langA)}</p>
      </div>

      <div className="sc-cards">
        {state.entries.map((e) => {
          const sym = STORY_SYMBOLS.find((s) => s.id === e.symbolId);
          if (!sym) return null;
          const readLang = e.by === "A" ? langA : langB;
          return (
            <article key={e.order} className="sc-entry" data-player={e.by} data-ux-surface="panel">
              <div className="sc-entryart"><TileImage sym={sym} size="gallery" /></div>
              <div className="sc-entrybody">
                <div className="sc-entrytop">
                  <span className="sc-order" data-player={e.by}>{e.order}</span>
                  <span data-ux-role="secondary">
                    {LANGUAGES[e.sentenceLang]?.flag} {LANGUAGES[e.sentenceLang]?.label ?? e.sentenceLang}
                  </span>
                  <button
                    type="button"
                    data-ux-role="control"
                    className="sc-mini sc-read"
                    onClick={() => speak(e.sentence, readLang)}
                  >🔊 {gp(SC2.readAloud, langA)}</button>
                </div>
                <p data-ux-role="body" className="sc-sentence">{e.sentence}</p>
                {e.translation && e.translationLang && (
                  <p data-ux-role="secondary" className="sc-trans">
                    {LANGUAGES[e.translationLang]?.flag} {e.translation}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {saved && (
        <p data-ux-role="body" className="sc-hint" role="status">💾 {gt(SC2.saved, langA)}</p>
      )}

      <div className="sc-gallerybtns">
        <button type="button" data-ux-role="control" className="sc-secondary" onClick={() => setSaved(true)}>
          💾 {gp(SC2.save, langA)}
        </button>
        <button type="button" data-ux-role="action" className="sc-primary" onClick={onRestart}>
          🔄 {gp(SC2.newStory, langA)}
        </button>
      </div>
      <p data-ux-role="secondary" className="sc-langline">{gt(UI.allDone, langA)}</p>
    </div>
  );
}

/* 글자 크기는 전부 토큰. px 글자 크기를 다시 쓰지 말 것.
   넓은 화면에서는 주사위 격자를 크게 두고 오른쪽에 쓰기/이야기 칸을 붙인다. */
const SC_CSS = `
.sc-root{
  color: var(--ux-ink);
  max-width: 1180px; margin: 0 auto;
  padding: var(--ux-space-6) var(--ux-space-4) var(--ux-space-12);
  word-break: keep-all; overflow-wrap: anywhere;
}
.sc-root button, .sc-root textarea{ font-family: inherit; }
.sc-play{ min-height: 100svh; background: var(--ux-bg); }
.sc-title{ margin: 0 0 var(--ux-space-2); }
.sc-lede{ margin: 0 0 var(--ux-space-4); }
.sc-colhead{ margin: 0 0 var(--ux-space-2); font-weight: 900; }
.sc-empty{ margin: 0; }

.sc-head{
  display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap;
  padding: var(--ux-space-3) var(--ux-space-4);
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  margin-bottom: var(--ux-space-3);
}
.sc-badges{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }
.sc-badge{
  padding: var(--ux-space-1) var(--ux-space-3);
  border-radius: var(--ux-radius-pill);
  border: 2px solid var(--ux-primary-border);
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  font-weight: 800; white-space: nowrap;
}
.sc-badge[data-active]{ background: var(--ux-primary-fill); color: var(--ux-primary-ink); }
.sc-badge[data-player="A"][data-active]{ background: var(--ux-hint-mint); color: var(--ux-ink); }
.sc-badge[data-player="B"][data-active]{ background: var(--ux-hint-lavender); color: var(--ux-ink); }
.sc-progress{ flex: 1; min-width: 8rem; display: grid; gap: var(--ux-space-1); }
.sc-track{ height: 10px; background: var(--ux-surface-sunk); border-radius: var(--ux-radius-pill); overflow: hidden; }
.sc-fill{ height: 100%; background: var(--ux-primary-fill); transition: width var(--ux-motion-state) var(--ux-motion-ease); }
.sc-headbtns{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }
.sc-mini{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-weight: 800; white-space: nowrap;
}
.sc-mini[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border-color: var(--ux-surface-sunk); cursor: default;
}
.sc-theme{ margin: 0 0 var(--ux-space-3); text-align: center; font-weight: 900; }

.sc-cols{ display: grid; gap: var(--ux-space-4); align-items: start; }
@media (min-width: 1024px){
  .sc-cols{ grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
  .sc-side{ position: sticky; top: var(--ux-space-4); }
}

.sc-grid{
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ux-space-3);
}
.sc-tile{
  position: relative;
  aspect-ratio: 1 / 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--ux-space-1);
  padding: var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  transition: background var(--ux-motion-state) var(--ux-motion-ease);
}
.sc-tile[data-selected]{ border: 4px solid var(--ux-selected-border); background: var(--ux-hint-mint); }
.sc-tile[data-used]{ background: var(--ux-surface-sunk); color: var(--ux-ink-soft); border-color: var(--ux-surface-sunk); }
.sc-tile[aria-disabled="true"]{ cursor: default; }
.sc-tilelabel{
  max-width: 100%; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sc-order{
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 1.8em; padding: 0 var(--ux-space-1);
  border-radius: var(--ux-radius-pill);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  font-size: var(--ux-font-label); font-weight: 900; line-height: 1.8;
}
.sc-tile .sc-order{ position: absolute; top: var(--ux-space-2); left: var(--ux-space-2); }
.sc-order[data-player="A"]{ background: var(--ux-hint-mint); color: var(--ux-ink); }
.sc-order[data-player="B"]{ background: var(--ux-hint-lavender); color: var(--ux-ink); }

.sc-img{ width: 100%; max-width: 4rem; height: auto; aspect-ratio: 1 / 1; object-fit: contain; }
.sc-img[data-size="compose"]{ max-width: 3.5rem; }
.sc-img[data-size="gallery"]{ max-width: 4rem; }
.sc-emoji{ font-size: calc(var(--ux-font-title) * 1.6); line-height: 1; }
.sc-emoji[data-size="compose"]{ font-size: calc(var(--ux-font-title) * 1.3); }
.sc-emoji[data-size="gallery"]{ font-size: calc(var(--ux-font-title) * 1.4); }
@media (min-width: 1024px){
  .sc-img{ max-width: 6rem; }
  .sc-emoji{ font-size: calc(var(--ux-font-title) * 2.2); }
}

.sc-compose, .sc-sofar{
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  padding: var(--ux-space-4);
  display: grid; gap: var(--ux-space-3);
}
.sc-composetop{ display: flex; align-items: center; gap: var(--ux-space-3); }
.sc-composewho{ display: grid; gap: var(--ux-space-1); min-width: 0; }
.sc-composename{ font-weight: 900; }
.sc-field{ display: grid; gap: var(--ux-space-2); }
.sc-fieldhead{ font-weight: 800; }
.sc-input{
  width: 100%; box-sizing: border-box;
  border-radius: var(--ux-radius-surface);
  border: 2px solid var(--ux-primary-border);
  padding: var(--ux-space-3);
  background: var(--ux-surface); color: var(--ux-ink);
  font-size: var(--ux-font-body); line-height: var(--ux-lh-reading);
  resize: vertical; min-height: var(--ux-control-min);
}
.sc-input-sub{ background: var(--ux-surface-sunk); }
.sc-input:focus-visible{ outline: 3px solid var(--ux-focus); outline-offset: 2px; }
.sc-hint{
  margin: 0; padding: var(--ux-space-3) var(--ux-space-4);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
}
.sc-composebtns, .sc-gallerybtns{ display: flex; gap: var(--ux-space-3); flex-wrap: wrap; }
.sc-primary{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-weight: 900; flex: 2; min-width: 12rem;
}
.sc-primary[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border-color: var(--ux-surface-sunk); cursor: default;
}
.sc-secondary{
  background: var(--ux-surface); color: var(--ux-ink-soft);
  border: 2px solid var(--ux-primary-border); font-weight: 800; flex: 1; min-width: 9rem;
}
.sc-sofarlist{ list-style: none; margin: 0; padding: 0; display: grid; gap: var(--ux-space-2); }
.sc-sofaritem{
  display: flex; align-items: flex-start; gap: var(--ux-space-2);
  padding-bottom: var(--ux-space-2); border-bottom: 1px solid var(--ux-surface-sunk);
}
.sc-sofaritem:last-child{ border-bottom: none; }

.sc-intro{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; }
.sc-intro .sc-card{ width: 100%; text-align: left; }
.sc-card{
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  padding: var(--ux-space-4); display: grid; gap: var(--ux-space-3);
}
.sc-modes, .sc-themegrid, .sc-cards{
  display: grid; gap: var(--ux-space-3);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.sc-mode{
  display: flex; flex-direction: column; align-items: center; gap: var(--ux-space-1);
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-weight: 800; text-align: center;
}
.sc-mode[data-active]{ background: var(--ux-hint-lavender); border: 3px solid var(--ux-selected-border); }
.sc-themes{ display: grid; gap: var(--ux-space-2); }
.sc-theme-btn{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-weight: 800;
}
.sc-theme-btn[data-active]{ background: var(--ux-hint-apricot); border: 3px solid var(--ux-selected-border); }
.sc-guide{ background: var(--ux-hint-apricot); }
.sc-steps{ margin: 0; padding-left: var(--ux-space-6); display: grid; gap: var(--ux-space-2); }
.sc-langline{ margin: 0; }
.sc-start{ width: 100%; max-width: 28rem; }

.sc-gallerytop{ display: grid; justify-items: center; gap: var(--ux-space-2); margin-bottom: var(--ux-space-4); text-align: center; }
.sc-cards{ grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
.sc-entry{
  display: flex; align-items: flex-start; gap: var(--ux-space-3);
  background: var(--ux-surface); padding: var(--ux-space-3);
  border: 2px solid var(--ux-primary-border);
  border-left: 6px solid var(--ux-primary-border);
}
.sc-entry[data-player="A"]{ border-left-color: var(--ux-hint-mint); }
.sc-entry[data-player="B"]{ border-left-color: var(--ux-hint-lavender); }
.sc-entryart{
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  width: 4.5rem; height: 4.5rem;
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-surface);
}
.sc-entrybody{ flex: 1; min-width: 0; display: grid; gap: var(--ux-space-1); }
.sc-entrytop{ display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap; }
.sc-read{ margin-left: auto; white-space: nowrap; }
.sc-sentence{ margin: 0; font-weight: 700; }
.sc-trans{ margin: 0; padding-top: var(--ux-space-1); border-top: 1px dashed var(--ux-surface-sunk); }
.sc-gallerybtns{ margin-top: var(--ux-space-6); }
`;
