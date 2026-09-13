"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SPOTIT_SYMBOLS,
  SPOTIT_CARDS,
  SpotItSymbol,
  commonSymbol,
  tr,
  pickN,
} from "@/lib/gameData";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import GameHeader, { GameStat } from "../ui/game/GameHeader";
import { gt, UI, type LangMap } from "./uiText";
import { gp } from "./plainText";

/** 인라인으로 CSS 커스텀 속성(--si-accent 등)을 넘기기 위한 타입. any 를 쓰지 않는다. */
type CssVars = CSSProperties & Record<`--${string}`, string>;

// ────────────────────────────────────────────────────────────
// 게임 고유 문구 (다국어)
// ────────────────────────────────────────────────────────────
const SI: Record<string, LangMap> = {
  title: {
    ko: "꿀벌 스팟잇", en: "Bee Spot It", vi: "Ong tìm hình", zh: "蜜蜂找相同",
    ja: "ハチのスポットイット", fil: "Bubuyog Spot It", th: "ผึ้งหาภาพเหมือน",
    id: "Lebah Spot It", ru: "Пчелиный Spot It", hi: "मधुमक्खी स्पॉट इट", ar: "لعبة النحلة",
  },
  howto: {
    ko: "내 카드와 가운데 카드에서 똑같은 그림 1개를 먼저 찾아 눌러요!",
    en: "Find the one picture your card shares with the centre card and tap it first!",
    vi: "Tìm 1 hình giống nhau giữa thẻ của bạn và thẻ ở giữa, chạm vào nó trước!",
    zh: "在你的卡片和中间卡片上找出相同的那 1 个图案，先点它！",
    ja: "じぶんのカードと まんなかのカードで おなじ えを ひとつ みつけて おしてね!",
    fil: "Hanapin ang iisang larawang pareho sa card mo at sa gitnang card, pindutin agad!",
    th: "หาภาพที่เหมือนกัน 1 ภาพระหว่างการ์ดของคุณกับการ์ดตรงกลาง แล้วกดให้ไว!",
    id: "Temukan satu gambar yang sama di kartumu dan kartu tengah, lalu tekan lebih dulu!",
    ru: "Найди одну общую картинку на своей и центральной карте и нажми первым!",
    hi: "अपने कार्ड और बीच वाले कार्ड में एक जैसी तस्वीर ढूँढो और पहले दबाओ!",
    ar: "ابحث عن الصورة المشتركة بين بطاقتك والبطاقة الوسطى واضغطها أولًا!",
  },
  player: {
    ko: "플레이어", en: "Player", vi: "Người chơi", zh: "玩家", ja: "プレイヤー",
    fil: "Manlalaro", th: "ผู้เล่น", id: "Pemain", ru: "Игрок", hi: "खिलाड़ी", ar: "لاعب",
  },
  remaining: {
    ko: "남은 카드", en: "Cards left", vi: "Thẻ còn lại", zh: "剩余卡片", ja: "のこりカード",
    fil: "Natitirang card", th: "การ์ดที่เหลือ", id: "Sisa kartu", ru: "Осталось карт",
    hi: "बचे कार्ड", ar: "البطاقات المتبقية",
  },
  goal: {
    ko: "목표", en: "Goal", vi: "Mục tiêu", zh: "目标", ja: "もくひょう",
    fil: "Layunin", th: "เป้าหมาย", id: "Target", ru: "Цель", hi: "लक्ष्य", ar: "الهدف",
  },
  perCard: {
    ko: "그림/카드", en: "pictures per card", vi: "hình mỗi thẻ", zh: "图案/卡",
    ja: "え/カード", fil: "larawan bawat card", th: "ภาพต่อการ์ด", id: "gambar per kartu",
    ru: "картинок на карте", hi: "चित्र प्रति कार्ड", ar: "صور لكل بطاقة",
  },
  easy:   { ko: "쉬움", en: "Easy", vi: "Dễ", zh: "简单", ja: "やさしい", fil: "Madali", th: "ง่าย", id: "Mudah", ru: "Легко", hi: "आसान", ar: "سهل" },
  normal: { ko: "보통", en: "Normal", vi: "Vừa", zh: "普通", ja: "ふつう", fil: "Katamtaman", th: "ปานกลาง", id: "Sedang", ru: "Средне", hi: "सामान्य", ar: "متوسط" },
  hard:   { ko: "어려움", en: "Hard", vi: "Khó", zh: "困难", ja: "むずかしい", fil: "Mahirap", th: "ยาก", id: "Sulit", ru: "Сложно", hi: "कठिन", ar: "صعب" },
  ruleScore: {
    ko: "맞히면 1점을 받고 가운데 카드가 바뀌어요",
    en: "A correct tap scores 1 point and swaps the centre card",
    vi: "Chạm đúng được 1 điểm và thẻ giữa được đổi",
    zh: "点对得 1 分，中间的卡片会换掉",
    ja: "せいかいで 1てん、まんなかのカードが かわります",
    fil: "Tamang pindot: 1 puntos at magpapalit ang gitnang card",
    th: "กดถูกได้ 1 แต้ม และการ์ดกลางจะเปลี่ยน",
    id: "Tekan benar dapat 1 poin dan kartu tengah berganti",
    ru: "Верное нажатие — 1 очко, центральная карта меняется",
    hi: "सही दबाने पर 1 अंक और बीच का कार्ड बदल जाता है",
    ar: "الضغط الصحيح يمنح نقطة ويبدّل البطاقة الوسطى",
  },
  ruleWrong: {
    ko: "틀리면 잠깐 쉬었다가 다시 눌러요",
    en: "If it is not the match, wait a moment and look again",
    vi: "Nếu sai thì nghỉ một chút rồi nhìn lại",
    zh: "点错了就先歇一下，再看一次",
    fil: "Kung mali, sandaling magpahinga at tumingin muli",
    ja: "ちがったら すこし やすんで もういちど みてね",
    th: "ถ้ากดผิด พักสักครู่แล้วดูใหม่",
    id: "Kalau salah, tunggu sebentar lalu lihat lagi",
    ru: "Если не совпало — подожди немного и посмотри снова",
    hi: "गलत हो तो थोड़ा रुको और फिर देखो",
    ar: "إذا أخطأت، انتظر قليلًا ثم انظر مرة أخرى",
  },
  ruleWin: {
    ko: "먼저 목표 점수를 내거나 카드가 떨어지면 끝나요",
    en: "The game ends when someone reaches the goal or the cards run out",
    vi: "Trò chơi kết thúc khi ai đó đạt mục tiêu hoặc hết thẻ",
    zh: "有人先达到目标分数或卡片用完就结束",
    ja: "だれかが もくひょうてんに とどくか カードが なくなると おわり",
    fil: "Matatapos kapag may nakaabot sa layunin o naubos ang card",
    th: "จบเกมเมื่อมีคนถึงเป้าหมายหรือการ์ดหมด",
    id: "Permainan selesai saat ada yang mencapai target atau kartu habis",
    ru: "Игра кончается, когда кто-то набрал цель или карты закончились",
    hi: "कोई लक्ष्य तक पहुँचे या कार्ड खत्म हों तो खेल खत्म",
    ar: "تنتهي اللعبة عند بلوغ الهدف أو نفاد البطاقات",
  },
  compromise: {
    ko: "정식 카드 세트가 아직 준비 중이라, 13개 그림을 다시 써서 간이 모드로 놀아요.",
    en: "The full card set is still being made, so we reuse the 13 pictures in a simple mode.",
    vi: "Bộ thẻ đầy đủ đang được chuẩn bị, nên ta dùng lại 13 hình ở chế độ đơn giản.",
    zh: "正式卡组还在准备中，先用这 13 个图案的简易模式来玩。",
    ja: "せいしきの カードは じゅんびちゅう。13この えを つかった かんいモードで あそぼう。",
    fil: "Ginagawa pa ang buong card set, kaya gagamitin muna ang 13 larawan sa simpleng mode.",
    th: "ชุดการ์ดเต็มยังไม่เสร็จ จึงใช้ 13 ภาพในโหมดอย่างง่ายก่อน",
    id: "Set kartu lengkap masih disiapkan, jadi kita pakai 13 gambar dalam mode sederhana.",
    ru: "Полный набор карт ещё готовится — играем упрощённо с 13 картинками.",
    hi: "पूरा कार्ड सेट अभी बन रहा है, इसलिए 13 चित्रों से आसान मोड में खेलेंगे।",
    ar: "مجموعة البطاقات الكاملة قيد الإعداد، لذا نلعب بوضع مبسّط بـ13 صورة.",
  },
  notReady: {
    ko: "이 난이도는 준비 중이에요. 다른 난이도를 골라요.",
    en: "This level is not ready yet. Please pick another one.",
    vi: "Độ khó này chưa sẵn sàng. Hãy chọn mức khác.",
    zh: "这个难度还在准备中，请选择其他难度。",
    ja: "この なんいどは じゅんびちゅう。ほかを えらんでね。",
    fil: "Hindi pa handa ang antas na ito. Pumili ng iba.",
    th: "ระดับนี้ยังไม่พร้อม เลือกระดับอื่นนะ",
    id: "Tingkat ini belum siap. Pilih yang lain ya.",
    ru: "Этот уровень ещё не готов. Выбери другой.",
    hi: "यह स्तर अभी तैयार नहीं है। दूसरा चुनो।",
    ar: "هذا المستوى غير جاهز بعد. اختر مستوى آخر.",
  },
  tie: {
    ko: "동점이에요!", en: "It's a tie!", vi: "Hòa nhau rồi!", zh: "平局！", ja: "どうてん!",
    fil: "Tabla tayo!", th: "เสมอกัน!", id: "Seri!", ru: "Ничья!", hi: "बराबरी!", ar: "تعادل!",
  },
  settings: {
    ko: "설정", en: "Settings", vi: "Cài đặt", zh: "设置", ja: "せってい",
    fil: "Setting", th: "ตั้งค่า", id: "Pengaturan", ru: "Настройки", hi: "सेटिंग", ar: "الإعدادات",
  },
  noCard: {
    ko: "카드 없음", en: "No card", vi: "Hết thẻ", zh: "没有卡片", ja: "カードなし",
    fil: "Walang card", th: "ไม่มีการ์ด", id: "Tidak ada kartu", ru: "Нет карты", hi: "कोई कार्ड नहीं", ar: "لا توجد بطاقة",
  },
  // 오답은 흔들거나 경고음을 내지 않는다 — 잠깐 쉬며 다시 보게 한다.
  lookAgain: {
    ko: "다시 한 번 볼까요?", en: "Shall we look again?", vi: "Cùng nhìn lại nhé?",
    zh: "我们再看一次好吗？", ja: "もういちど みてみよう?", fil: "Tingnan nating muli?",
    th: "ลองดูอีกครั้งนะ", id: "Yuk lihat lagi?", ru: "Посмотрим ещё раз?",
    hi: "फिर से देखें?", ar: "هل ننظر مرة أخرى؟",
  },
  myCard: {
    ko: "내 카드", en: "My card", vi: "Thẻ của tôi", zh: "我的卡片", ja: "わたしのカード",
    fil: "Card ko", th: "การ์ดของฉัน", id: "Kartu saya", ru: "Моя карта",
    hi: "मेरा कार्ड", ar: "بطاقتي",
  },
  centerCard: {
    ko: "가운데 카드", en: "Centre card", vi: "Thẻ ở giữa", zh: "中间卡片", ja: "まんなかのカード",
    fil: "Gitnang card", th: "การ์ดตรงกลาง", id: "Kartu tengah", ru: "Центральная карта",
    hi: "बीच का कार्ड", ar: "البطاقة الوسطى",
  },
};

// ────────────────────────────────────────────────────────────
// 타입 / 상수
// ────────────────────────────────────────────────────────────
type PlayerId = 0 | 1 | 2 | 3 | 4 | 5;
type Phase = "intro" | "play" | "result";
type Difficulty = "easy" | "normal" | "hard";

interface Pop {
  who: PlayerId;
  label: string;
  labelOther: string;
}

interface DifficultyInfo {
  order: number;         // projective plane order
  perCard: number;       // n+1
  ready: boolean;        // order 3만 정식 지원 (order 4/5 는 타협 모드)
  label: LangMap;
}

const WIN_SCORE = 7;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const DIFF_INFO: Record<Difficulty, DifficultyInfo> = {
  easy:   { order: 3, perCard: 4, ready: true,  label: SI.easy },
  normal: { order: 4, perCard: 5, ready: false, label: SI.normal },
  hard:   { order: 5, perCard: 6, ready: false, label: SI.hard },
};

// ⚠️ 타협(compromise) 모드
// gameData.ts 는 order 3 (13 심볼, 4/카드, 13장) 데이터만 보유.
// order 4/5 정식 데이터가 없으므로 "준비 중" 으로 막는 대신,
// 같은 13 심볼 풀을 재사용해서 perCard 만 5/6 으로 늘린 카드를 합성.
// 이 경우 "두 카드 간 공통 심볼이 정확히 1개" 라는 projective plane 불변이 깨질 수 있음.
// → 아이들 플레이용으로는 "공통 심볼이 있으면 그중 하나" 를 정답으로 수용.
//   수학적 완전성은 포기하되 게임 진행에는 문제 없음.
const COMPROMISE_MODE = true;

// ────────────────────────────────────────────────────────────
// 카드 표시용 결정론적 회전
// ────────────────────────────────────────────────────────────
function seededRotation(cardId: number, slot: number): number {
  const h = Math.sin(cardId * 9.31 + slot * 2.17) * 10000;
  const frac = h - Math.floor(h);
  return Math.round(frac * 30 - 15);
}

function cardIndex(card: number[]): number {
  let acc = 0;
  for (let i = 0; i < card.length; i++) acc += card[i] * (i + 1) * 7;
  return acc;
}

// 두 카드가 공유하는 아무 심볼 하나. 없으면 -1.
function anyCommon(a: number[], b: number[]): number {
  for (const x of a) if (b.includes(x)) return x;
  return -1;
}

// ────────────────────────────────────────────────────────────
// 타협 모드 카드 합성
//   base (4 심볼) 카드에 여분 심볼을 채워 perCard 개로 확장.
//   결정론적이지 않아도 무방 (셔플 시마다 다름).
// ────────────────────────────────────────────────────────────
function buildCompromiseDeck(perCard: number): number[][] {
  const totalSymbols = SPOTIT_SYMBOLS.length;
  const out: number[][] = [];
  for (const base of SPOTIT_CARDS) {
    const card = [...base];
    // 무작위로 기존에 없는 심볼 추가
    let guard = 0;
    while (card.length < perCard && guard < 200) {
      const id = Math.floor(Math.random() * totalSymbols);
      if (!card.includes(id)) card.push(id);
      guard++;
    }
    // 심볼이 부족하면 (13 심볼뿐이므로 perCard≤13 이면 항상 충분) 잘라내기
    out.push(card.slice(0, perCard));
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function SpotIt({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // 덱 + 자리
  const [deck, setDeck] = useState<number[][]>([]);
  const [cursor, setCursor] = useState<number>(0);
  const [centerCard, setCenterCard] = useState<number[]>([]);
  const [playerCards, setPlayerCards] = useState<number[][]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [locks, setLocks] = useState<number[]>([]);
  const [pop, setPop] = useState<Pop | null>(null);

  // 이미지 폴백 추적
  const [imgFail, setImgFail] = useState<Record<number, boolean>>({});

  // 10Hz tick — 락 해제 감지
  const [, setTick] = useState(0);
  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  // 예약된 타이머 전부. unmount·재시작 때 한 곳에서 정리한다 (NumberTap 패턴).
  const timersRef = useRef<number[]>([]);
  const aliveRef = useRef(true);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      if (aliveRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // dev invariant check (easy/order 3 만)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      for (let i = 0; i < SPOTIT_CARDS.length; i++) {
        for (let j = i + 1; j < SPOTIT_CARDS.length; j++) {
          const inter = SPOTIT_CARDS[i].filter((x) => SPOTIT_CARDS[j].includes(x));
          // eslint-disable-next-line no-console
          console.assert(
            inter.length === 1,
            `Spot-It pair ${i},${j} has ${inter.length} common symbols`,
          );
        }
      }
    }
  }, []);

  function start() {
    const info = DIFF_INFO[difficulty];
    // aria-disabled 버튼에서도 눌릴 수 있으므로 핸들러가 스스로 막는다.
    if (!info.ready && !COMPROMISE_MODE) return;
    clearTimers();

    const baseDeck = difficulty === "easy"
      ? SPOTIT_CARDS
      : buildCompromiseDeck(info.perCard);

    const shuffled = pickN(baseDeck, baseDeck.length);
    // 중앙 1 + 플레이어 N 만큼 필요
    const need = 1 + playerCount;
    if (shuffled.length < need) return;

    const initPlayerCards: number[][] = [];
    for (let i = 0; i < playerCount; i++) {
      initPlayerCards.push(shuffled[1 + i]);
    }

    setDeck(shuffled);
    setCenterCard(shuffled[0]);
    setPlayerCards(initPlayerCards);
    setCursor(need);
    setScores(new Array(playerCount).fill(0));
    setLocks(new Array(playerCount).fill(0));
    setPop(null);
    setPhase("play");
  }

  function symbolById(id: number): SpotItSymbol {
    return SPOTIT_SYMBOLS[id];
  }

  function showPop(who: PlayerId, symbolId: number, myLang: string, otherLang: string) {
    const sym = symbolById(symbolId);
    setPop({
      who,
      label: tr(sym.label, myLang),
      labelOther: tr(sym.label, otherLang),
    });
    clearTimers();
    later(() => setPop(null), 2000);
  }

  function langForPlayer(p: number): string {
    // 짝수 index → langA, 홀수 → langB
    return p % 2 === 0 ? langA : langB;
  }
  function otherLangForPlayer(p: number): string {
    return p % 2 === 0 ? langB : langA;
  }

  function onTap(player: PlayerId, symbolId: number) {
    if (phase !== "play") return;
    const now = Date.now();
    if (now < (locks[player] ?? 0)) return;

    const myCard = playerCards[player];
    if (!myCard || myCard.length === 0) return;

    // easy(order 3) 는 commonSymbol (정확히 1개 보장),
    // 타협 모드는 공통 심볼이 여러 개일 수 있으므로
    // "양쪽 카드에 모두 있는 심볼" 은 모두 정답으로 수용
    const common = difficulty === "easy"
      ? commonSymbol(myCard, centerCard)
      : anyCommon(myCard, centerCard);

    const isCorrect =
      common !== -1 &&
      (difficulty === "easy"
        ? symbolId === common
        : centerCard.includes(symbolId));

    if (!isCorrect) {
      // 오답 → 0.8초 락
      const until = now + 800;
      setLocks((ls) => ls.map((v, i) => (i === player ? until : v)));
      return;
    }

    // 정답 → 점수 +1, 중앙:=내 카드, 내 카드:=deck[cursor]
    showPop(player, symbolId, langForPlayer(player), otherLangForPlayer(player));

    const nextCenter = myCard;
    const nextCard = cursor < deck.length ? deck[cursor] : null;

    const newScores = scores.map((s, i) => (i === player ? s + 1 : s));
    setScores(newScores);
    setCenterCard(nextCenter);

    if (nextCard === null) {
      // 덱 소진 → 해당 플레이어 카드 비우고 종료
      setPlayerCards((cards) => cards.map((c, i) => (i === player ? [] : c)));
      setPhase("result");
      return;
    }

    setPlayerCards((cards) => cards.map((c, i) => (i === player ? nextCard : c)));
    setCursor((c) => c + 1);

    if (newScores[player] >= WIN_SCORE) {
      setPhase("result");
    }
  }

  const remaining = Math.max(0, deck.length - cursor);

  // ────────────────────────────────────────────────────────────
  // intro 화면
  // ────────────────────────────────────────────────────────────
  if (phase === "intro") {
    const info = DIFF_INFO[difficulty];
    const blocked = !info.ready && !COMPROMISE_MODE;

    return (
      <div data-ux-root className="si-root si-center">
        <ScopedStyle css={SI_CSS} />
        <BeeMascot size={110} mood="happy" />
        <h1 data-ux-role="title" className="si-h">🕵️ {gt(SI.title, langA)}</h1>
        <p data-ux-role="body" className="si-p">{gt(SI.howto, langA)}</p>

        <div className="si-panels">
          {/* 인원 선택 */}
          <section className="si-section" aria-labelledby="si-lbl-players">
            <h2 data-ux-role="label" className="si-sectiontitle" id="si-lbl-players">
              👥 {gt(UI.players, langA)}
            </h2>
            <div className="si-pills">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  data-ux-role="control"
                  className="si-pill"
                  data-active={playerCount === n ? "" : undefined}
                  onClick={() => setPlayerCount(n)}
                  aria-pressed={playerCount === n}
                >
                  {n} {gp(UI.players, langA)}
                </button>
              ))}
            </div>
          </section>

          {/* 난이도 선택 */}
          <section className="si-section" aria-labelledby="si-lbl-diff">
            <h2 data-ux-role="label" className="si-sectiontitle" id="si-lbl-diff">
              🎚️ {gt(UI.difficulty, langA)}
            </h2>
            <div className="si-pills">
              {(Object.keys(DIFF_INFO) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  data-ux-role="control"
                  className="si-pill"
                  data-active={difficulty === d ? "" : undefined}
                  onClick={() => setDifficulty(d)}
                  aria-pressed={difficulty === d}
                >
                  {gp(DIFF_INFO[d].label, langA)}
                  <span data-ux-role="secondary" className="si-pillsub">
                    {DIFF_INFO[d].perCard} {gp(SI.perCard, langA)}
                  </span>
                </button>
              ))}
            </div>
            {!info.ready && (
              <p data-ux-role="secondary" className="si-note" role="status">
                ※ {COMPROMISE_MODE ? gt(SI.compromise, langA) : gt(SI.notReady, langA)}
              </p>
            )}
          </section>

          {/* 규칙 */}
          <section className="si-section si-rules">
            <p data-ux-role="body">• {gt(SI.ruleScore, langA)}</p>
            <p data-ux-role="body">• {gt(SI.ruleWrong, langA)}</p>
            <p data-ux-role="body">
              • {gt(SI.ruleWin, langA)} — {gp(SI.goal, langA)} {WIN_SCORE}
            </p>
          </section>
        </div>

        <button
          type="button"
          data-ux-role="action"
          className="si-primary"
          onClick={start}
          aria-disabled={blocked || undefined}
        >
          ▶ {gt(UI.start, langA)}
        </button>
        {blocked && (
          <p data-ux-role="secondary" className="si-note" role="status">
            {gt(SI.notReady, langA)}
          </p>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // result 화면
  // ────────────────────────────────────────────────────────────
  if (phase === "result") {
    const maxScore = scores.reduce((a, b) => Math.max(a, b), 0);
    const winners = scores
      .map((s, i) => (s === maxScore ? i : -1))
      .filter((i) => i >= 0);
    const isTie = winners.length > 1;

    return (
      <div data-ux-root className="si-root si-center">
        <ScopedStyle css={SI_CSS} />
        <BeeMascot size={120} mood={isTie ? "think" : "celebrate"} />
        <h1 data-ux-role="title" className="si-h">
          {isTie
            ? `🤝 ${gt(SI.tie, langA)}`
            : `🎉 ${gp(SI.player, langA)} ${winners[0] + 1} · ${gt(UI.win, langA)}`}
        </h1>
        <div className="si-scores">
          {scores.map((s, i) => {
            const cardVars: CssVars = { "--si-accent": playerAccent(i) };
            const isWin = winners.includes(i) && !isTie;
            return (
              <div
                key={i}
                className="si-scorecard"
                data-win={isWin ? "" : undefined}
                style={cardVars}
              >
                <span data-ux-role="secondary" className="si-scorename">
                  {gp(SI.player, langA)} {i + 1}
                </span>
                <span data-ux-role="title" className="si-scorenum">{s}</span>
              </div>
            );
          })}
        </div>
        <div className="si-actions">
          <button type="button" data-ux-role="action" className="si-primary" onClick={start}>
            🔁 {gp(UI.playAgain, langA)}
          </button>
          <button
            type="button"
            data-ux-role="control"
            className="si-secondary"
            onClick={() => setPhase("intro")}
          >
            ⚙️ {gp(SI.settings, langA)}
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // play 화면
  // ────────────────────────────────────────────────────────────
  const now = Date.now();
  const layout = computeLayout(playerCount);

  return (
    <div data-ux-root className="si-root si-play">
      <ScopedStyle css={SI_CSS} />

      {/* U01 공용 헤더 — 가운데 정렬 칩 두 개(.si-hud) 대신 다른 게임과 같은
          '왼쪽 뒤로 / 가운데 이름 / 오른쪽 상태'. 뒤로는 설정 화면으로. */}
      <GameHeader
        gameId="spotit"
        title="꿀벌 스팟잇"
        icon="🕵️"
        onBack={() => setPhase("intro")}
        backLabel="설정"
        status={
          <>
            <GameStat icon="🂠" label={gp(SI.remaining, langA)} value={remaining} />
            <GameStat icon="🎯" label={gp(SI.goal, langA)} value={WIN_SCORE} tone="key" />
            <GameStat
              icon="🙋"
              label={gp(UI.players, langA)}
              value={`${playerCount} · ${gp(DIFF_INFO[difficulty].label, langA)}`}
            />
          </>
        }
      />

      {/* 플레이 영역 */}
      <div
        className="si-board"
        style={{ gridTemplateColumns: layout.columns, gridTemplateRows: layout.rows }}
      >
        {/* 중앙 카드 */}
        <div
          className="si-slot si-slot-center"
          style={{ gridColumn: layout.center.col, gridRow: layout.center.row }}
        >
          <SpotItCardView
            card={centerCard}
            accentColor="#F59E0B"
            imgFail={imgFail}
            onImgFail={(id) => setImgFail((m) => ({ ...m, [id]: true }))}
            interactive={false}
            locked={false}
            ariaRole="img"
            ariaLabel={gp(SI.centerCard, langA)}
            tier={layout.tier}
            noCardText={gp(SI.noCard, langA)}
          />
        </div>

        {/* 플레이어 영역 */}
        {playerCards.map((card, i) => {
          const slot = layout.players[i];
          const locked = now < (locks[i] ?? 0);
          return (
            <div
              key={i}
              className="si-slot"
              style={{ gridColumn: slot.col, gridRow: slot.row }}
            >
              <PlayerZone
                playerIndex={i}
                card={card}
                score={scores[i] ?? 0}
                locked={locked}
                imgFail={imgFail}
                onImgFail={(id) => setImgFail((m) => ({ ...m, [id]: true }))}
                onTap={(s) => onTap(i as PlayerId, s)}
                pop={pop?.who === i ? pop : null}
                rotated={slot.rotated}
                tier={layout.tier}
                lang={langA}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 레이아웃 계산
// ────────────────────────────────────────────────────────────
interface SlotPos {
  col: string;   // e.g. "1 / 2"
  row: string;
  rotated: boolean;
}
interface LayoutInfo {
  columns: string;
  rows: string;
  center: { col: string; row: string };
  players: SlotPos[];
  tier: CardTier;
}

/** 카드 치수 단계. 실제 px 은 CSS 가 clamp 로 정한다 (넓은 화면에서 더 크게). */
type CardTier = "lg" | "md" | "sm";

function computeLayout(n: number): LayoutInfo {
  // 인원이 많을수록 한 단계 작은 카드
  const tier: CardTier = n <= 2 ? "lg" : n <= 4 ? "md" : "sm";

  if (n === 2) {
    // 상(B, 회전) / 중앙 / 하(A)
    return {
      columns: "1fr",
      rows: "auto auto auto",
      center: { col: "1 / 2", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1 하단
        { col: "1 / 2", row: "1 / 2", rotated: true },  // P2 상단(회전)
      ],
      tier,
    };
  }

  if (n === 3) {
    // 상 한 명(회전), 하 두 명
    return {
      columns: "1fr 1fr",
      rows: "auto auto auto",
      center: { col: "1 / 3", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1 하-좌
        { col: "2 / 3", row: "3 / 4", rotated: false }, // P2 하-우
        { col: "1 / 3", row: "1 / 2", rotated: true },  // P3 상(회전)
      ],
      tier,
    };
  }

  if (n === 4) {
    // 상 2(회전), 하 2
    return {
      columns: "1fr 1fr",
      rows: "auto auto auto",
      center: { col: "1 / 3", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1 하-좌
        { col: "2 / 3", row: "3 / 4", rotated: false }, // P2 하-우
        { col: "1 / 2", row: "1 / 2", rotated: true },  // P3 상-좌
        { col: "2 / 3", row: "1 / 2", rotated: true },  // P4 상-우
      ],
      tier,
    };
  }

  if (n === 5) {
    // 상 2(회전), 하 3 (중앙 row = 2열 span)
    return {
      columns: "1fr 1fr 1fr",
      rows: "auto auto auto",
      center: { col: "1 / 4", row: "2 / 3" },
      players: [
        { col: "1 / 2", row: "3 / 4", rotated: false }, // P1
        { col: "2 / 3", row: "3 / 4", rotated: false }, // P2
        { col: "3 / 4", row: "3 / 4", rotated: false }, // P3
        { col: "1 / 2", row: "1 / 2", rotated: true },  // P4
        { col: "3 / 4", row: "1 / 2", rotated: true },  // P5
      ],
      tier,
    };
  }

  // n === 6 (최대)
  return {
    columns: "1fr 1fr 1fr",
    rows: "auto auto auto",
    center: { col: "1 / 4", row: "2 / 3" },
    players: [
      { col: "1 / 2", row: "3 / 4", rotated: false }, // P1
      { col: "2 / 3", row: "3 / 4", rotated: false }, // P2
      { col: "3 / 4", row: "3 / 4", rotated: false }, // P3
      { col: "1 / 2", row: "1 / 2", rotated: true },  // P4
      { col: "2 / 3", row: "1 / 2", rotated: true },  // P5
      { col: "3 / 4", row: "1 / 2", rotated: true },  // P6
    ],
    tier,
  };
}

// ────────────────────────────────────────────────────────────
// 플레이어 색상
// ────────────────────────────────────────────────────────────
const PLAYER_ACCENTS = ["#F59E0B", "#3B82F6", "#10B981", "#EC4899", "#8B5CF6", "#EF4444"];
function playerAccent(i: number): string {
  return PLAYER_ACCENTS[i % PLAYER_ACCENTS.length];
}

// ────────────────────────────────────────────────────────────
// PlayerZone
// ────────────────────────────────────────────────────────────
function PlayerZone(props: {
  playerIndex: number;
  card: number[];
  score: number;
  locked: boolean;
  imgFail: Record<number, boolean>;
  onImgFail: (id: number) => void;
  onTap: (symbolId: number) => void;
  pop: Pop | null;
  rotated: boolean;
  tier: CardTier;
  lang: string;
}) {
  const {
    playerIndex, card, score, locked, imgFail, onImgFail, onTap, pop, rotated, tier, lang,
  } = props;

  const accent = playerAccent(playerIndex);
  const label = `P${playerIndex + 1}`;

  return (
    <div className="si-zone" style={{ ["--si-accent" as string]: accent }}>
      <div className={rotated ? "si-zonehead rot" : "si-zonehead"}>
        <span data-ux-role="secondary" className="si-zonetag">{label}</span>
        <span data-ux-role="secondary" className="si-zonescore">⭐ {score}</span>
      </div>

      <div className={rotated ? "si-zonecard rot" : "si-zonecard"}>
        <SpotItCardView
          card={card}
          accentColor={accent}
          imgFail={imgFail}
          onImgFail={onImgFail}
          interactive={!locked && card.length > 0}
          locked={locked}
          onTap={onTap}
          ariaRole="group"
          ariaLabel={`${label} ${gp(SI.myCard, lang)}`}
          tier={tier}
          noCardText={gp(SI.noCard, lang)}
        />
      </div>

      {pop && (
        <div aria-live="polite" className={rotated ? "si-pop rot" : "si-pop"}>
          <span data-ux-role="body-emphasis" className="si-poplabel">{pop.label}</span>
          <span data-ux-role="secondary" className="si-popsub">{pop.labelOther}</span>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SpotItCardView
// ────────────────────────────────────────────────────────────
/** 카드 단계별 심볼 글자 크기. 그림이 없을 때 쓰는 이모지 대체 크기다. */
const SYMBOL_FONT: Record<CardTier, number> = { lg: 34, md: 28, sm: 22 };

function SpotItCardView(props: {
  card: number[];
  accentColor: string;
  imgFail: Record<number, boolean>;
  onImgFail: (id: number) => void;
  interactive: boolean;
  locked: boolean;
  onTap?: (symbolId: number) => void;
  ariaRole?: string;
  ariaLabel?: string;
  tier: CardTier;
  noCardText: string;
}) {
  const {
    card, accentColor, imgFail, onImgFail,
    interactive, locked, onTap, ariaRole, ariaLabel, tier, noCardText,
  } = props;

  const cid = useMemo(() => (card.length ? cardIndex(card) : 0), [card]);
  const grid = useMemo(() => gridSpec(card.length), [card.length]);

  if (!card.length) {
    return (
      <div data-ux-role="secondary" className={`si-card si-card-${tier} si-card-empty`}>
        {noCardText}
      </div>
    );
  }

  return (
    <div
      role={ariaRole}
      aria-label={ariaLabel}
      className={locked ? `si-card si-card-${tier} locked` : `si-card si-card-${tier}`}
      style={{
        ["--si-accent" as string]: accentColor,
        gridTemplateColumns: grid.cols,
        gridTemplateRows: grid.rows,
      }}
    >
      {card.map((symbolId, slot) => (
        <SpotItSymbolButton
          key={`${symbolId}-${slot}`}
          symbolId={symbolId}
          rotation={seededRotation(cid, slot)}
          interactive={interactive}
          imgFailed={!!imgFail[symbolId]}
          onImgFail={() => onImgFail(symbolId)}
          onTap={onTap}
          fontSize={SYMBOL_FONT[tier]}
        />
      ))}

      {locked && (
        <div aria-hidden="true" className="si-cardlock">
          <span role="img" aria-label="대기">⏳</span>
        </div>
      )}
    </div>
  );
}

// 심볼 개수별 격자 배치
function gridSpec(count: number): { cols: string; rows: string } {
  switch (count) {
    case 4:  return { cols: "1fr 1fr", rows: "1fr 1fr" };
    case 5:  return { cols: "1fr 1fr 1fr", rows: "1fr 1fr" }; // 6칸 중 5개 사용
    case 6:  return { cols: "1fr 1fr 1fr", rows: "1fr 1fr" };
    default: return { cols: "1fr 1fr", rows: "1fr 1fr" };
  }
}

// ────────────────────────────────────────────────────────────
// SpotItSymbolButton
// ────────────────────────────────────────────────────────────
function SpotItSymbolButton(props: {
  symbolId: number;
  rotation: number;
  interactive: boolean;
  imgFailed: boolean;
  onImgFail: () => void;
  onTap?: (symbolId: number) => void;
  fontSize: number;
}) {
  const { symbolId, rotation, interactive, imgFailed, onImgFail, onTap, fontSize } = props;
  const sym = SPOTIT_SYMBOLS[symbolId];
  const fallbackEmoji = emojiForKey(sym.key);

  const inner: CSSProperties = {
    width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transform: `rotate(${rotation}deg)`,
    fontSize, lineHeight: 1,
  };

  const imgStyle: CSSProperties = {
    width: "80%", height: "80%", objectFit: "contain",
    pointerEvents: "none",
  };

  const content = imgFailed ? (
    <span aria-hidden="true" style={inner}>{fallbackEmoji}</span>
  ) : (
    <div style={inner}>
      <img
        src={sym.image}
        alt=""
        aria-hidden="true"
        onError={onImgFail}
        style={imgStyle}
        draggable={false}
      />
    </div>
  );

  const baseStyle: CSSProperties = {
    position: "relative",
    width: "100%", height: "100%",
    borderRadius: 16,
    background: "#FFFDF7",
    border: "1px solid #F3E8CA",
    padding: 0,
    cursor: interactive ? "pointer" : "default",
    overflow: "hidden",
    touchAction: "manipulation",
  };

  if (interactive) {
    return (
      <button
        type="button"
        aria-label={sym.key}
        onClick={() => onTap && onTap(symbolId)}
        style={baseStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-hidden="true" style={baseStyle}>
      {content}
    </div>
  );
}

// 이미지 폴백용 이모지 매핑 (SPOTIT_SYMBOLS.key 와 동기화)
function emojiForKey(key: string): string {
  switch (key) {
    case "apple":  return "🍎";
    case "banana": return "🍌";
    case "cat":    return "🐱";
    case "dog":    return "🐶";
    case "book":   return "📖";
    case "water":  return "💧";
    case "school": return "🏫";
    case "house":  return "🏠";
    case "sun":    return "☀️";
    case "moon":   return "🌙";
    case "rice":   return "🍚";
    case "tea":    return "🍵";
    case "bee":    return "🐝";
    default:       return "❓";
  }
}

// 옛 인라인 스타일 상수(primaryBtn/secondaryBtn/sectionBox/sectionTitle/pillBtn)는
// SI_CSS 클래스로 대체되어 삭제했다. 어디서도 참조하지 않는다.

// MIN_PLAYERS / MAX_PLAYERS / PlayerId 레퍼런스 유지용 (린트)
export const _SPOT_IT_META = { MIN_PLAYERS, MAX_PLAYERS };

/* ── 스팟잇 전용 규칙 ─────────────────────────────────────────────────
   크기는 전부 토큰에서 온다. 카드만 단계(lg/md/sm)로 clamp 하며, 넓은 화면
   에서는 더 크게 잡는다 — 데스크톱을 '세로로 늘린 휴대폰' 으로 두지 않는다. */
const SI_CSS = `
.si-root{
  min-height: 100svh; box-sizing: border-box;
  padding: var(--ux-space-4);
  background: var(--ux-bg); color: var(--ux-ink);
  display: flex; flex-direction: column; gap: var(--ux-space-4);
}
.si-center{ align-items: center; text-align: center; }
.si-play{ gap: var(--ux-space-3); }
.si-h{ font-weight: 900; word-break: keep-all; }
.si-p{ color: var(--ux-ink-soft); max-width: 42ch; word-break: keep-all; }

.si-panels{
  width: 100%; max-width: 1080px; display: grid; gap: var(--ux-space-4);
  grid-template-columns: 1fr; text-align: left;
}
@media (min-width: 768px){ .si-panels{ grid-template-columns: 1fr 1fr; } }
.si-section{
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel); padding: var(--ux-space-4);
  display: grid; gap: var(--ux-space-3); align-content: start;
}
.si-sectiontitle{ font-weight: 900; }
.si-rules p, .si-note{ color: var(--ux-ink-soft); word-break: keep-all; }

.si-pills{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); }
.si-pill[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 800; min-width: 0;
}
.si-pill[aria-pressed="true"]{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.si-pillsub{ color: var(--ux-ink-soft); }

.si-actions{ display: flex; flex-wrap: wrap; gap: var(--ux-space-3); justify-content: center; }
.si-primary[data-ux-role="action"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 900;
}
.si-primary[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft); border-style: dashed;
}
.si-secondary[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}

/* U01: .si-hud / .si-chip (가운데 정렬 상태 칩)은 공용 GameHeader 로 옮겼다. */

.si-scores{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); justify-content: center; }
.si-scorecard{
  display: grid; justify-items: center; gap: 2px;
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-3);
}
.si-scorename{ font-weight: 800; }
.si-scorenum{ font-weight: 900; }

.si-board{
  display: grid; gap: var(--ux-space-3); justify-items: center; align-items: center;
  width: 100%; max-width: 1180px; margin: 0 auto;
}
.si-slot{ display: flex; justify-content: center; width: 100%; }
.si-slot-center{ padding: var(--ux-space-2) 0; }

/* 카드 — 단계별 한 변. 1024px 이상에서 한 뼘 더 크게. */
.si-card{
  position: relative; aspect-ratio: 1;
  display: grid; gap: var(--ux-space-1);
  padding: var(--ux-space-2);
  border-radius: var(--ux-radius-panel);
  background: var(--ux-surface);
  border: 3px solid var(--si-accent, var(--ux-primary-border));
  box-shadow: 0 6px 16px rgba(137,83,0,.16);
  transition: opacity var(--ux-motion-state) var(--ux-motion-ease);
}
.si-card.locked{ opacity: .5; }
.si-card-lg{ width: clamp(160px, 46vw, 240px); }
.si-card-md{ width: clamp(140px, 38vw, 200px); }
.si-card-sm{ width: clamp(116px, 30vw, 168px); }
@media (min-width: 1024px){
  .si-card-lg{ width: 300px; }
  .si-card-md{ width: 250px; }
  .si-card-sm{ width: 200px; }
}
.si-card-empty{
  display: flex; align-items: center; justify-content: center;
  background: var(--ux-surface-sunk); border: 2px dashed var(--ux-ink-soft);
  color: var(--ux-ink-soft); font-weight: 700; text-align: center;
}
.si-cardlock{
  position: absolute; inset: 0; border-radius: var(--ux-radius-panel);
  background: rgba(255,255,255,.55);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--ux-font-title); pointer-events: none;
}

.si-zone{
  position: relative; display: flex; flex-direction: column; align-items: center;
  gap: var(--ux-space-2); padding: var(--ux-space-2);
  border-radius: var(--ux-radius-panel);
  border: 2px solid var(--si-accent, var(--ux-primary-border));
  background: var(--ux-surface);
}
.si-zonehead{
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; gap: var(--ux-space-2);
}
.si-zonehead.rot, .si-zonecard.rot{ transform: rotate(180deg); }
.si-zonetag{
  font-weight: 900; color: var(--ux-ink);
  background: var(--ux-surface-sunk); border: 2px solid var(--si-accent, var(--ux-primary-border));
  border-radius: var(--ux-radius-pill); padding: 2px var(--ux-space-2);
}
.si-zonescore{ font-weight: 900; color: var(--ux-ink); }
.si-pop{
  position: absolute; top: -8px; left: 50%;
  transform: translate(-50%, -100%);
  display: grid; justify-items: center; gap: 2px;
  background: var(--ux-surface); border: 3px solid var(--si-accent, var(--ux-primary-border));
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-4);
  box-shadow: 0 8px 20px rgba(137,83,0,.22);
  z-index: 5; min-width: 140px; text-align: center; pointer-events: none;
}
.si-pop.rot{ top: auto; bottom: -8px; transform: translate(-50%, 100%) rotate(180deg); }
.si-poplabel{ font-weight: 900; }
.si-popsub{ color: var(--ux-ink-soft); }
`;
