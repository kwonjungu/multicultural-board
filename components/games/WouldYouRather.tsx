"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { WYR_CARDS, WYRCard, WYRCategory, tr, pickN } from "@/lib/gameData";
import { GameText } from "@/lib/gameI18n";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import { gt, type LangMap } from "./uiText";
import { gp } from "./plainText";

type Vote = "A" | "B" | null;
type Phase = "intro" | "voting" | "reveal" | "summary";

// 의미색(어느 쪽 보기인가 / 어느 학생인가)만 게임 고유 색으로 남긴다.
// 표면·글자·성공/실패 색은 전부 공통 토큰을 쓴다.
const OPT_A_ACCENT = "#F59E0B";
const OPT_B_ACCENT = "#2563EB";
const PLAYER_A_ACCENT = "#DB2777";
const PLAYER_B_ACCENT = "#059669";

// #5 저학년(1~2학년) 난이도 하향 — 한 판 길이를 줄여 집중·피로도를 낮춘다.
const DECK_SIZE = 12;

// #5 저학년 친화 카테고리 — 일상에 가까워 어휘가 쉽다. 명절·계절 등 문화
// 어휘가 많은 카드(다문화 교육 핵심이라 보존)는 소수만 섞는다.
const EASY_CATEGORIES: WYRCategory[] = ["food", "taste", "school", "home"];

// 쉬운 카테고리 카드를 우선 채우고, 부족분만 나머지(season 등)로 보충한다.
function buildEasyDeck(n: number): WYRCard[] {
  const easy = WYR_CARDS.filter((c) => EASY_CATEGORIES.includes(c.category));
  const rest = WYR_CARDS.filter((c) => !EASY_CATEGORIES.includes(c.category));
  const picked = pickN(easy, n);
  if (picked.length < n) picked.push(...pickN(rest, n - picked.length));
  // 카테고리가 한쪽에 몰리지 않게 마지막에 한 번 더 섞는다.
  return pickN(picked, picked.length);
}

const CATEGORIES: WYRCategory[] = ["food", "season", "school", "home", "taste"];
const CATEGORY_META: Record<WYRCategory, { emoji: string; label: LangMap; color: string }> = {
  food: {
    emoji: "🍚", color: "#EA580C",
    label: {
      ko: "음식", en: "Food", vi: "Món ăn", zh: "食物", fil: "Pagkain",
      ja: "たべもの", th: "อาหาร", id: "Makanan", ru: "Еда", hi: "खाना", ar: "طعام",
    },
  },
  season: {
    emoji: "🌸", color: "#10B981",
    label: {
      ko: "계절", en: "Season", vi: "Mùa", zh: "季节", fil: "Panahon",
      ja: "きせつ", th: "ฤดู", id: "Musim", ru: "Сезон", hi: "मौसम", ar: "فصل",
    },
  },
  school: {
    emoji: "🏫", color: "#2563EB",
    label: {
      ko: "학교", en: "School", vi: "Trường", zh: "学校", fil: "Paaralan",
      ja: "がっこう", th: "โรงเรียน", id: "Sekolah", ru: "Школа", hi: "स्कूल", ar: "مدرسة",
    },
  },
  home: {
    emoji: "🏠", color: "#A855F7",
    label: {
      ko: "집", en: "Home", vi: "Nhà", zh: "家", fil: "Bahay",
      ja: "いえ", th: "บ้าน", id: "Rumah", ru: "Дом", hi: "घर", ar: "منزل",
    },
  },
  taste: {
    emoji: "👅", color: "#DB2777",
    label: {
      ko: "취향", en: "Taste", vi: "Sở thích", zh: "喜好", fil: "Panlasa",
      ja: "このみ", th: "ความชอบ", id: "Selera", ru: "Вкус", hi: "पसंद", ar: "ذوق",
    },
  },
};

// 게임 고유 문구 사전. 제목·지문·안내문은 gt()(한국어 병기), 반복되는 작은
// 동작 버튼·표 라벨은 gp()(병기 없음)로 쓴다.
const WYR: Record<string, LangMap> = {
  title: {
    ko: "이거 저거 고르기", en: "Would You Rather", vi: "Chọn cái nào?", zh: "选这个还是那个",
    fil: "Alin ang Mas Gusto?", ja: "どっちが すき?", th: "ชอบอันไหนมากกว่า", id: "Pilih yang Mana?",
    ru: "Что выберешь?", hi: "कौन सा चुनोगे?", ar: "أيهما تفضل؟",
  },
  howto: {
    ko: "둘 중 뭐가 더 좋아? 정답은 없어요.",
    en: "Which one do you like more? There is no wrong answer.",
    vi: "Bạn thích cái nào hơn? Không có đáp án sai.",
    zh: "你更喜欢哪一个? 没有标准答案。",
    fil: "Alin ang mas gusto mo? Walang maling sagot.",
    ja: "どっちが すき? せいかいは ないよ。",
    th: "ชอบอันไหนมากกว่า? ไม่มีคำตอบผิด",
    id: "Kamu lebih suka yang mana? Tidak ada jawaban yang salah.",
    ru: "Что тебе нравится больше? Неправильных ответов нет.",
    hi: "तुम्हें कौन सा ज़्यादा पसंद है? कोई गलत जवाब नहीं है।",
    ar: "أيهما تحب أكثر؟ لا توجد إجابة خاطئة.",
  },
  talkTogether: {
    ko: "서로 이야기하면서 친해져요!",
    en: "Talk about it together and become friends!",
    vi: "Cùng trò chuyện và làm bạn nhé!",
    zh: "一起聊聊，成为好朋友!",
    fil: "Mag-usap kayo at magkaibigan!",
    ja: "はなしながら なかよく なろう!",
    th: "คุยกันแล้วเป็นเพื่อนกันนะ!",
    id: "Mengobrollah bersama dan jadi teman!",
    ru: "Поговорите вместе и подружитесь!",
    hi: "साथ बात करो और दोस्त बनो!",
    ar: "تحدثا معًا وكونا صديقين!",
  },
  leftSeat: {
    ko: "왼쪽", en: "Left", vi: "Bên trái", zh: "左边", fil: "Kaliwa",
    ja: "ひだり", th: "ซ้าย", id: "Kiri", ru: "Слева", hi: "बाएँ", ar: "يسار",
  },
  rightSeat: {
    ko: "오른쪽", en: "Right", vi: "Bên phải", zh: "右边", fil: "Kanan",
    ja: "みぎ", th: "ขวา", id: "Kanan", ru: "Справа", hi: "दाएँ", ar: "يمين",
  },
  student: {
    ko: "학생", en: "Student", vi: "Học sinh", zh: "学生", fil: "Mag-aaral",
    ja: "せいと", th: "นักเรียน", id: "Siswa", ru: "Ученик", hi: "छात्र", ar: "طالب",
  },
  card: {
    ko: "카드", en: "Card", vi: "Thẻ", zh: "卡片", fil: "Karta",
    ja: "カード", th: "การ์ด", id: "Kartu", ru: "Карточка", hi: "कार्ड", ar: "بطاقة",
  },
  cardsTogether: {
    ko: "함께 고른 카드", en: "Cards played together", vi: "Số thẻ đã chơi", zh: "一起玩过的卡片",
    fil: "Mga kartang nalaro", ja: "いっしょに あそんだ カード", th: "การ์ดที่เล่นด้วยกัน",
    id: "Kartu yang dimainkan", ru: "Сыграно карточек", hi: "साथ खेले कार्ड", ar: "البطاقات معًا",
  },
  matchRate: {
    ko: "취향 일치", en: "Same taste", vi: "Giống nhau", zh: "喜好一致", fil: "Parehong gusto",
    ja: "おなじ すき", th: "ชอบเหมือนกัน", id: "Selera sama", ru: "Совпадения", hi: "एक जैसी पसंद", ar: "تطابق الذوق",
  },
  lastResult: {
    ko: "방금 게임 결과", en: "Last game result", vi: "Kết quả vừa rồi", zh: "刚才的结果",
    fil: "Resulta kanina", ja: "さっきの けっか", th: "ผลเมื่อครู่", id: "Hasil tadi",
    ru: "Прошлый результат", hi: "पिछला नतीजा", ar: "نتيجة الجولة السابقة",
  },
  hintPick: {
    ko: "마음에 드는 쪽에서 자기 단추를 눌러요.",
    en: "Tap your own button on the side you like.",
    vi: "Hãy bấm nút của mình ở bên bạn thích.",
    zh: "在你喜欢的一边按下自己的按钮。",
    fil: "Pindutin ang sarili mong butones sa panig na gusto mo.",
    ja: "すきな ほうで じぶんの ボタンを おしてね。",
    th: "กดปุ่มของตัวเองในฝั่งที่ชอบ",
    id: "Tekan tombolmu di sisi yang kamu suka.",
    ru: "Нажми свою кнопку на той стороне, которая нравится.",
    hi: "जो पसंद है उस तरफ अपना बटन दबाओ।",
    ar: "اضغط زرك في الجهة التي تعجبك.",
  },
  turnOther: {
    ko: "이제 친구 차례예요.", en: "Now it is your friend's turn.", vi: "Đến lượt bạn kia.",
    zh: "轮到另一个朋友了。", fil: "Kapareha mo na ang susunod.", ja: "つぎは ともだちの ばん。",
    th: "ถึงตาเพื่อนแล้ว", id: "Sekarang giliran temanmu.", ru: "Теперь очередь друга.",
    hi: "अब दोस्त की बारी है।", ar: "الآن دور صديقك.",
  },
  revealing: {
    ko: "결과를 보여 줄게요.", en: "Showing the result.", vi: "Đang hiện kết quả.",
    zh: "正在公布结果。", fil: "Ipapakita na ang resulta.", ja: "けっかを みせるね。",
    th: "กำลังแสดงผล", id: "Menampilkan hasil.", ru: "Показываем результат.",
    hi: "नतीजा दिखा रहे हैं।", ar: "نعرض النتيجة.",
  },
  pickedDone: {
    ko: "골랐어요", en: "Chosen", vi: "Đã chọn", zh: "选好了", fil: "Napili na",
    ja: "えらんだよ", th: "เลือกแล้ว", id: "Sudah memilih", ru: "Выбрано", hi: "चुन लिया", ar: "تم الاختيار",
  },
  pickHere: {
    ko: "여기 고르기", en: "Pick this", vi: "Chọn bên này", zh: "选这个", fil: "Piliin ito",
    ja: "これを えらぶ", th: "เลือกอันนี้", id: "Pilih ini", ru: "Выбрать это", hi: "यह चुनो", ar: "اختر هذا",
  },
  alreadyPicked: {
    ko: "이미 골랐어요", en: "Already chosen", vi: "Đã chọn rồi", zh: "已经选好了",
    fil: "Nakapili na", ja: "もう えらんだよ", th: "เลือกไปแล้ว", id: "Sudah memilih",
    ru: "Уже выбрано", hi: "पहले ही चुन लिया", ar: "تم الاختيار مسبقًا",
  },
  sameTitle: {
    ko: "비슷해요!", en: "So alike!", vi: "Giống nhau rồi!", zh: "很像呢!", fil: "Magkapareho!",
    ja: "にてるね!", th: "เหมือนกันเลย!", id: "Mirip!", ru: "Похоже!", hi: "एक जैसा!", ar: "متشابهان!",
  },
  sameSub: {
    ko: "둘 다 같은 걸 골랐어요.", en: "You both chose the same thing.", vi: "Cả hai chọn giống nhau.",
    zh: "两人选了同一个。", fil: "Pareho kayo ng napili.", ja: "ふたりとも おなじを えらんだよ。",
    th: "เลือกเหมือนกันทั้งคู่", id: "Kalian memilih yang sama.", ru: "Вы выбрали одно и то же.",
    hi: "दोनों ने एक ही चुना।", ar: "اخترتما الشيء نفسه.",
  },
  diffTitle: {
    ko: "달라서 재밌어요!", en: "Different and fun!", vi: "Khác nhau mới vui!", zh: "不一样才有趣!",
    fil: "Iba, kaya masaya!", ja: "ちがって おもしろい!", th: "ต่างกันก็สนุกดี!", id: "Beda itu seru!",
    ru: "Разное — это интересно!", hi: "अलग होना मज़ेदार है!", ar: "الاختلاف ممتع!",
  },
  diffSub: {
    ko: "둘 다 멋진 선택이에요.", en: "Both are great choices.", vi: "Cả hai đều là lựa chọn hay.",
    zh: "两个都是好选择。", fil: "Parehong magandang pili.", ja: "どちらも すてきな えらびかた。",
    th: "ทั้งสองอย่างดีเลย", id: "Keduanya pilihan bagus.", ru: "Оба выбора отличные.",
    hi: "दोनों चुनाव अच्छे हैं।", ar: "كلا الخيارين رائع.",
  },
  talkAbout: {
    ko: "이야기해 봐요", en: "Let's talk", vi: "Cùng trò chuyện", zh: "聊一聊", fil: "Mag-usap tayo",
    ja: "はなして みよう", th: "มาคุยกัน", id: "Ayo mengobrol", ru: "Давайте поговорим",
    hi: "बात करते हैं", ar: "لنتحدث",
  },
  statsTitle: {
    ko: "우리 취향 통계표", en: "Our taste report", vi: "Bảng sở thích của chúng ta",
    zh: "我们的喜好统计", fil: "Talaan ng gusto namin", ja: "ふたりの すき まとめ",
    th: "ตารางความชอบของเรา", id: "Tabel selera kami", ru: "Наша таблица вкусов",
    hi: "हमारी पसंद की तालिका", ar: "جدول أذواقنا",
  },
  secWeb: {
    ko: "카테고리별 취향 그물", en: "Taste web by topic", vi: "Mạng sở thích theo chủ đề",
    zh: "分类喜好网", fil: "Lambat ng gusto kada paksa", ja: "テーマべつ すきの あみ",
    th: "ใยความชอบตามหัวข้อ", id: "Jaring selera per topik", ru: "Сеть вкусов по темам",
    hi: "विषय अनुसार पसंद का जाल", ar: "شبكة الأذواق حسب الموضوع",
  },
  secBars: {
    ko: "카테고리별 일치율", en: "Match rate by topic", vi: "Tỉ lệ giống theo chủ đề",
    zh: "各分类一致率", fil: "Porsiyento ng pagkakapareho", ja: "テーマべつ いっちりつ",
    th: "อัตราตรงกันตามหัวข้อ", id: "Tingkat kecocokan per topik", ru: "Совпадения по темам",
    hi: "विषय अनुसार मेल दर", ar: "نسبة التطابق حسب الموضوع",
  },
  secTable: {
    ko: "카드별 기록", en: "Card by card", vi: "Ghi chép từng thẻ", zh: "每张卡片记录",
    fil: "Bawat karta", ja: "カードごとの きろく", th: "บันทึกทีละการ์ด",
    id: "Catatan tiap kartu", ru: "Карточка за карточкой", hi: "हर कार्ड का रिकॉर्ड",
    ar: "سجل كل بطاقة",
  },
  noData: {
    ko: "아직 고른 카드가 없어요. 다시 해 볼까요?",
    en: "No cards yet. Shall we try again?",
    vi: "Chưa có thẻ nào. Mình thử lại nhé?",
    zh: "还没有卡片记录。再试一次吧?",
    fil: "Wala pang karta. Subukan ulit?",
    ja: "まだ カードが ないよ。もういちど やってみる?",
    th: "ยังไม่มีการ์ดเลย ลองอีกครั้งไหม",
    id: "Belum ada kartu. Coba lagi, yuk?",
    ru: "Пока нет карточек. Попробуем ещё раз?",
    hi: "अभी कोई कार्ड नहीं है। फिर से करें?",
    ar: "لا توجد بطاقات بعد. نجرب مرة أخرى؟",
  },
  ourTaste: {
    ko: "우리 취향", en: "Our taste", vi: "Sở thích", zh: "我们的喜好", fil: "Gusto namin",
    ja: "ふたりの すき", th: "ความชอบเรา", id: "Selera kami", ru: "Наш вкус", hi: "हमारी पसंद", ar: "ذوقنا",
  },
  colResult: {
    ko: "결과", en: "Result", vi: "Kết quả", zh: "结果", fil: "Resulta",
    ja: "けっか", th: "ผล", id: "Hasil", ru: "Итог", hi: "नतीजा", ar: "النتيجة",
  },
  colCategory: {
    ko: "카테고리", en: "Topic", vi: "Chủ đề", zh: "分类", fil: "Paksa",
    ja: "テーマ", th: "หัวข้อ", id: "Topik", ru: "Тема", hi: "विषय", ar: "الموضوع",
  },
  same: {
    ko: "일치", en: "Same", vi: "Giống", zh: "一致", fil: "Pareho",
    ja: "いっち", th: "ตรงกัน", id: "Sama", ru: "Совпало", hi: "मेल", ar: "متطابق",
  },
  different: {
    ko: "다름", en: "Different", vi: "Khác", zh: "不同", fil: "Iba",
    ja: "ちがう", th: "ต่างกัน", id: "Beda", ru: "Разное", hi: "अलग", ar: "مختلف",
  },
  noRecord: {
    ko: "기록 없음", en: "No record", vi: "Chưa có", zh: "无记录", fil: "Walang tala",
    ja: "きろく なし", th: "ไม่มีบันทึก", id: "Tidak ada", ru: "Нет записи", hi: "कोई रिकॉर्ड नहीं", ar: "لا سجل",
  },
  startBtn: {
    ko: "시작하기", en: "Start", vi: "Bắt đầu", zh: "开始", fil: "Magsimula",
    ja: "スタート", th: "เริ่ม", id: "Mulai", ru: "Старт", hi: "शुरू", ar: "ابدأ",
  },
  nextCard: {
    ko: "다음 카드", en: "Next card", vi: "Thẻ tiếp", zh: "下一张", fil: "Susunod",
    ja: "つぎの カード", th: "การ์ดถัดไป", id: "Kartu berikutnya", ru: "Следующая", hi: "अगला कार्ड", ar: "البطاقة التالية",
  },
  endBtn: {
    ko: "끝내기", en: "Finish", vi: "Kết thúc", zh: "结束", fil: "Tapusin",
    ja: "おわり", th: "จบ", id: "Selesai", ru: "Закончить", hi: "समाप्त", ar: "إنهاء",
  },
  againBtn: {
    ko: "다시 하기", en: "Play again", vi: "Chơi lại", zh: "再玩一次", fil: "Ulitin",
    ja: "もう一度", th: "เล่นอีกครั้ง", id: "Main lagi", ru: "Ещё раз", hi: "फिर खेलें", ar: "العب مجددًا",
  },
};

interface CategoryStats {
  played: number;
  matched: number;
}

type ByCategory = Record<WYRCategory, CategoryStats>;

interface StatsState {
  played: number;
  matched: number;
  byCategory: ByCategory;
  history: { category: WYRCategory; matched: boolean }[];
}

const INITIAL_BY_CATEGORY: ByCategory = {
  food:   { played: 0, matched: 0 },
  season: { played: 0, matched: 0 },
  school: { played: 0, matched: 0 },
  home:   { played: 0, matched: 0 },
  taste:  { played: 0, matched: 0 },
};

const INITIAL_STATS: StatsState = {
  played: 0,
  matched: 0,
  byCategory: INITIAL_BY_CATEGORY,
  history: [],
};

// ==============================================================
// Main component
// ==============================================================
export default function WouldYouRather({ langA, langB }: { langA: string; langB: string }) {
  const [resetKey, setResetKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [voteA, setVoteA] = useState<Vote>(null);
  const [voteB, setVoteB] = useState<Vote>(null);
  const [stats, setStats] = useState<StatsState>(INITIAL_STATS);

  const deck = useMemo<WYRCard[]>(() => buildEasyDeck(DECK_SIZE), [resetKey]);
  const card = deck[idx];

  function handleVote(player: "A" | "B", option: "A" | "B") {
    if (player === "A") {
      if (voteA) return;
      setVoteA(option);
    } else {
      if (voteB) return;
      setVoteB(option);
    }
  }

  // Auto-reveal once both voted
  useEffect(() => {
    if (phase === "voting" && voteA !== null && voteB !== null && card) {
      const matched = voteA === voteB;
      setStats((s) => {
        const prev = s.byCategory[card.category];
        return {
          played: s.played + 1,
          matched: s.matched + (matched ? 1 : 0),
          byCategory: {
            ...s.byCategory,
            [card.category]: {
              played: prev.played + 1,
              matched: prev.matched + (matched ? 1 : 0),
            },
          },
          history: [...s.history, { category: card.category, matched }],
        };
      });
      setPhase("reveal");
    }
  }, [phase, voteA, voteB, card]);

  function nextCard() {
    const n = idx + 1;
    setVoteA(null);
    setVoteB(null);
    if (n >= deck.length) {
      // End of deck → summary
      setPhase("summary");
    } else {
      setIdx(n);
      setPhase("voting");
    }
  }

  function endGame() {
    // Go to summary
    setVoteA(null);
    setVoteB(null);
    setPhase("summary");
  }

  function restartFromSummary() {
    setPhase("intro");
    setIdx(0);
    setVoteA(null);
    setVoteB(null);
    setStats(INITIAL_STATS);
    setResetKey((k) => k + 1);
  }

  function startGame() {
    setPhase("voting");
    setIdx(0);
    setVoteA(null);
    setVoteB(null);
    setStats(INITIAL_STATS);
  }

  // ----------------- intro -----------------
  if (phase === "intro") {
    return <IntroPanel langA={langA} langB={langB} stats={stats} onStart={startGame} />;
  }

  // ----------------- summary -----------------
  if (phase === "summary") {
    return <SummaryPanel stats={stats} langA={langA} onRestart={restartFromSummary} />;
  }

  // ----------------- voting -----------------
  if (phase === "voting") {
    return (
      <div data-ux-root className="wyr-root wyr-play">
        <ScopedStyle css={WYR_CSS} />
        <StatsBar stats={stats} idx={idx} total={deck.length} langA={langA} />
        <div className="wyr-arena">
          <OptionSide
            option="A" card={card} langA={langA} langB={langB}
            voteA={voteA} voteB={voteB} onVote={handleVote}
          />
          <div className="wyr-vs" aria-hidden="true">VS</div>
          <OptionSide
            option="B" card={card} langA={langA} langB={langB}
            voteA={voteA} voteB={voteB} onVote={handleVote}
          />
        </div>
        <HintFooter voteA={voteA} voteB={voteB} langA={langA} />
      </div>
    );
  }

  // ----------------- reveal -----------------
  return (
    <div data-ux-root className="wyr-root wyr-play">
      <ScopedStyle css={WYR_CSS} />
      <StatsBar stats={stats} idx={idx} total={deck.length} langA={langA} />
      <RevealPanel
        card={card}
        langA={langA}
        langB={langB}
        voteA={voteA}
        voteB={voteB}
        stats={stats}
        onNext={nextCard}
        onEnd={endGame}
      />
    </div>
  );
}

// ==============================================================
// Intro panel
// ==============================================================
function IntroPanel({
  langA, langB, stats, onStart,
}: {
  langA: string; langB: string;
  stats: StatsState;
  onStart: () => void;
}) {
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;
  return (
    <div data-ux-root className="wyr-root wyr-intro">
      <ScopedStyle css={WYR_CSS} />
      <div className="wyr-intro-hero" aria-hidden="true">🎲</div>
      <h2 data-ux-role="title" className="wyr-intro-title">{gt(WYR.title, langA)}</h2>
      <p data-ux-role="body" className="wyr-intro-sub" data-ux-reading>
        {gt(WYR.howto, langA)}
      </p>
      <p data-ux-role="body" className="wyr-intro-sub" data-ux-reading>
        {gt(WYR.talkTogether, langA)}
      </p>

      <div className="wyr-seats">
        <div className="wyr-seat" data-player="A">
          <span data-ux-role="secondary" className="wyr-seat-side">{gp(WYR.leftSeat, langA)}</span>
          <span className="wyr-seat-bee" aria-hidden="true">🐝</span>
          <span data-ux-role="label" className="wyr-seat-name">
            {gp(WYR.student, langA)} A · {langA.toUpperCase()}
          </span>
        </div>
        <div className="wyr-seat" data-player="B">
          <span data-ux-role="secondary" className="wyr-seat-side">{gp(WYR.rightSeat, langA)}</span>
          <span className="wyr-seat-bee" aria-hidden="true">🐝</span>
          <span data-ux-role="label" className="wyr-seat-name">
            {gp(WYR.student, langA)} B · {langB.toUpperCase()}
          </span>
        </div>
      </div>

      {stats.played > 0 && (
        <p data-ux-role="body" className="wyr-intro-last" role="status">
          {gt(WYR.lastResult, langA)} — {gp(WYR.cardsTogether, langA)} {stats.played} · {gp(WYR.matchRate, langA)} {rate}%
        </p>
      )}

      <button
        type="button"
        data-ux-role="action"
        className="wyr-btn wyr-btn-primary wyr-intro-start"
        onClick={onStart}
      >
        🎲 {gp(WYR.startBtn, langA)}
      </button>
    </div>
  );
}

// ==============================================================
// Stats bar (progress + match rate)
// ==============================================================
function StatsBar({
  stats, idx, total, langA,
}: {
  stats: StatsState;
  idx: number;
  total: number;
  langA: string;
}) {
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;
  const pct = ((idx) / total) * 100;
  return (
    <div className="wyr-statsbar">
      <div className="wyr-statsbar-row">
        <span data-ux-role="label">📘 {gp(WYR.card, langA)} {idx + 1} / {total}</span>
        <span data-ux-role="label">
          {gp(WYR.cardsTogether, langA)} {stats.played} · {gp(WYR.matchRate, langA)} {rate}%
        </span>
      </div>
      <div className="wyr-progress" aria-hidden="true">
        <div className="wyr-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ==============================================================
// Arena — 좌/우 대결 구도. 한 쪽(=보기)마다 두 학생의 단추가 들어간다.
// 좁은 화면에서는 세로로 쌓이고, 768 이상에서는 A | VS | B 가로 2단이 된다.
// ==============================================================
function OptionSide({
  option, card, langA, langB, voteA, voteB, onVote,
}: {
  option: "A" | "B";
  card: WYRCard;
  langA: string;
  langB: string;
  voteA: Vote;
  voteB: Vote;
  onVote: (player: "A" | "B", option: "A" | "B") => void;
}) {
  const opt = option === "A" ? card.optionA : card.optionB;
  const chosenBy = [voteA === option ? "A" : null, voteB === option ? "B" : null].filter(Boolean);

  return (
    <section className="wyr-side" data-opt={option} data-chosen={chosenBy.length > 0 ? "" : undefined}>
      <div className="wyr-side-badge" aria-hidden="true">{option}</div>
      <div className="wyr-side-emoji" aria-hidden="true">{opt.emoji}</div>
      <h3 data-ux-role="body-emphasis" className="wyr-side-label">
        <GameText map={opt.label} lang={langA} />
      </h3>
      <p data-ux-role="secondary" className="wyr-side-sub">
        <GameText map={opt.label} lang={langB} />
      </p>
      <div className="wyr-side-votes">
        <VoteButton
          player="A" option={option} optionLabel={tr(opt.label, langA)}
          myVote={voteA} uiLang={langA} onVote={onVote}
        />
        <VoteButton
          player="B" option={option} optionLabel={tr(opt.label, langB)}
          myVote={voteB} uiLang={langA} onVote={onVote}
        />
      </div>
    </section>
  );
}

function VoteButton({
  player, option, optionLabel, myVote, uiLang, onVote,
}: {
  player: "A" | "B";
  option: "A" | "B";
  optionLabel: string;
  myVote: Vote;
  uiLang: string;
  onVote: (player: "A" | "B", option: "A" | "B") => void;
}) {
  const isPicked = myVote === option;
  const hasVoted = myVote !== null;
  // disabled 로 잠그면 포커스를 잃어 키보드로 이유를 읽을 수 없다.
  // aria-disabled + 핸들러 early-return + 화면에 보이는 이유로 대신한다.
  const blocked = hasVoted && !isPicked;

  const state = isPicked ? gp(WYR.pickedDone, uiLang)
    : blocked ? gp(WYR.alreadyPicked, uiLang)
    : gp(WYR.pickHere, uiLang);

  return (
    <button
      type="button"
      data-ux-role="control"
      className="wyr-vote"
      data-player={player}
      data-state={isPicked ? "picked" : blocked ? "blocked" : "open"}
      aria-disabled={blocked || undefined}
      aria-pressed={isPicked}
      aria-label={`${gp(WYR.student, uiLang)} ${player} · ${optionLabel} · ${state}`}
      onClick={() => { if (blocked) return; onVote(player, option); }}
    >
      <span className="wyr-vote-who">
        <span aria-hidden="true">🐝</span>
        <span>{gp(WYR.student, uiLang)} {player}</span>
      </span>
      <span data-ux-role="secondary" className="wyr-vote-state">
        {isPicked ? `✓ ${state}` : state}
      </span>
    </button>
  );
}

function HintFooter({ voteA, voteB, langA }: { voteA: Vote; voteB: Vote; langA: string }) {
  const aDone = voteA !== null;
  const bDone = voteB !== null;
  const text = aDone && bDone
    ? gt(WYR.revealing, langA)
    : aDone || bDone
      ? gt(WYR.turnOther, langA)
      : gt(WYR.hintPick, langA);
  return (
    <p data-ux-role="body" className="wyr-hint" role="status">{text}</p>
  );
}

// ==============================================================
// Reveal panel
// ==============================================================
function RevealPanel({
  card, langA, langB, voteA, voteB, stats, onNext, onEnd,
}: {
  card: WYRCard;
  langA: string;
  langB: string;
  voteA: Vote;
  voteB: Vote;
  stats: StatsState;
  onNext: () => void;
  onEnd: () => void;
}) {
  const match = voteA === voteB;
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;

  return (
    <div className="wyr-reveal">
      <div className="wyr-reveal-grid">
        <div className="wyr-card wyr-reveal-main" data-match={match ? "" : undefined}>
          {match && <Confetti />}
          <div className="wyr-reveal-bee">
            <BeeMascot size={90} mood={match ? "celebrate" : "think"} />
          </div>
          <p data-ux-role="title" className="wyr-reveal-title">
            {match ? `🤝 ${gt(WYR.sameTitle, langA)}` : `🌈 ${gt(WYR.diffTitle, langA)}`}
          </p>
          <p data-ux-role="body" className="wyr-reveal-sub">
            {match ? gt(WYR.sameSub, langA) : gt(WYR.diffSub, langA)}
          </p>

          <MiniNodeDiagram card={card} voteA={voteA} voteB={voteB} langA={langA} langB={langB} />

          <div className="wyr-chips">
            <span data-ux-role="label" className="wyr-chip" data-tone="warm">
              {gp(WYR.cardsTogether, langA)} {stats.played}
            </span>
            <span data-ux-role="label" className="wyr-chip" data-tone="ok">
              ✓ {gp(WYR.same, langA)} {stats.matched}
            </span>
            <span data-ux-role="label" className="wyr-chip" data-tone="cool">
              {gp(WYR.matchRate, langA)} {rate}%
            </span>
          </div>
        </div>

        <div className="wyr-card wyr-followup">
          <p data-ux-role="label" className="wyr-followup-head">💬 {gt(WYR.talkAbout, langA)}</p>
          <p data-ux-role="body-emphasis" className="wyr-followup-main" data-ux-reading>
            <GameText map={card.followUp} lang={langA} />
          </p>
          <p data-ux-role="body" className="wyr-followup-sub" data-ux-reading>
            <GameText map={card.followUp} lang={langB} />
          </p>
        </div>
      </div>

      <div className="wyr-actions">
        <button type="button" data-ux-role="control" className="wyr-btn wyr-btn-quiet" onClick={onEnd}>
          🏁 {gp(WYR.endBtn, langA)}
        </button>
        <button type="button" data-ux-role="action" className="wyr-btn wyr-btn-primary wyr-btn-grow" onClick={onNext}>
          {gp(WYR.nextCard, langA)} →
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// MiniNodeDiagram — two nodes (A/B) with their picked emoji,
// connected by solid (match) or dashed (mismatch) line
// --------------------------------------------------------------
function MiniNodeDiagram({
  card, voteA, voteB, langA, langB,
}: {
  card: WYRCard;
  voteA: Vote;
  voteB: Vote;
  langA: string;
  langB: string;
}) {
  const match = voteA === voteB;
  const pickA = voteA === "A" ? card.optionA : voteA === "B" ? card.optionB : null;
  const pickB = voteB === "A" ? card.optionA : voteB === "B" ? card.optionB : null;

  return (
    <div
      role="img"
      aria-label={match ? gt(WYR.sameSub, langA) : gt(WYR.diffSub, langA)}
      className="wyr-nodes"
    >
      <NodeBubble
        role="A" uiLang={langA}
        emoji={pickA ? pickA.emoji : "❔"}
        label={pickA ? tr(pickA.label, langA) : "—"}
      />
      <ConnectorLine match={match} />
      <NodeBubble
        role="B" uiLang={langA}
        emoji={pickB ? pickB.emoji : "❔"}
        label={pickB ? tr(pickB.label, langB) : "—"}
      />
    </div>
  );
}

function NodeBubble({
  role, emoji, label, uiLang,
}: {
  role: "A" | "B"; emoji: string; label: string; uiLang: string;
}) {
  return (
    <div className="wyr-node" data-player={role}>
      <span className="wyr-node-bubble" aria-hidden="true">{emoji}</span>
      <span data-ux-role="secondary" className="wyr-node-who">
        {gp(WYR.student, uiLang)} {role}
      </span>
      <span data-ux-role="label" className="wyr-node-label">{label}</span>
    </div>
  );
}

function ConnectorLine({ match }: { match: boolean }) {
  return (
    <div className="wyr-conn" data-match={match ? "" : undefined} aria-hidden="true">
      <span className="wyr-conn-line" />
      <span className="wyr-conn-mark">{match ? "=" : "≠"}</span>
    </div>
  );
}

// ==============================================================
// Summary panel — final stats + node graph, 넓은 화면에서는 격자
// ==============================================================
function SummaryPanel({
  stats, langA, onRestart,
}: {
  stats: StatsState;
  langA: string;
  onRestart: () => void;
}) {
  const rate = stats.played > 0 ? Math.round((stats.matched / stats.played) * 100) : 0;
  const hasData = stats.played > 0;

  return (
    <div data-ux-root className="wyr-root wyr-summary">
      <ScopedStyle css={WYR_CSS} />

      <div className="wyr-card wyr-sum-head">
        <div className="wyr-sum-hero" aria-hidden="true">📊</div>
        <h2 data-ux-role="title" className="wyr-sum-title">{gt(WYR.statsTitle, langA)}</h2>
        <div className="wyr-chips">
          <span data-ux-role="label" className="wyr-chip" data-tone="warm">
            {gp(WYR.cardsTogether, langA)} {stats.played}
          </span>
          <span data-ux-role="label" className="wyr-chip" data-tone="ok">
            ✓ {gp(WYR.same, langA)} {stats.matched}
          </span>
          <span data-ux-role="label" className="wyr-chip" data-tone="cool">
            {gp(WYR.matchRate, langA)} {rate}%
          </span>
        </div>
      </div>

      {!hasData && (
        <p data-ux-role="body" className="wyr-card wyr-sum-empty" role="status">
          {gt(WYR.noData, langA)}
        </p>
      )}

      {hasData && (
        <div className="wyr-sum-grid">
          <section className="wyr-card">
            <h3 data-ux-role="label" className="wyr-sec-head">🕸️ {gt(WYR.secWeb, langA)}</h3>
            <CategoryNodeGraph stats={stats} langA={langA} />
          </section>

          <section className="wyr-card">
            <h3 data-ux-role="label" className="wyr-sec-head">📈 {gt(WYR.secBars, langA)}</h3>
            <CategoryBars stats={stats} langA={langA} />
          </section>

          <section className="wyr-card">
            <h3 data-ux-role="label" className="wyr-sec-head">📋 {gt(WYR.secTable, langA)}</h3>
            <HistoryTable history={stats.history} langA={langA} />
          </section>
        </div>
      )}

      <div className="wyr-actions">
        <button
          type="button"
          data-ux-role="action"
          className="wyr-btn wyr-btn-primary wyr-btn-grow"
          onClick={onRestart}
        >
          🔄 {gp(WYR.againBtn, langA)}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// CategoryNodeGraph — central "우리 취향" node, 5 categories around,
// line thickness = match rate.
// SVG 안의 숫자는 px 이 아니라 viewBox 사용자 단위다 — 그림 전체가
// CSS 폭에 맞춰 함께 커지고 작아지므로 글자 크기가 고정되지 않는다.
// --------------------------------------------------------------
function CategoryNodeGraph({ stats, langA }: { stats: StatsState; langA: string }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const centerR = 38;
  const nodeR = 26;
  const ringR = 100;

  const nodes = CATEGORIES.map((cat, i) => {
    const angle = (i / CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * ringR;
    const y = cy + Math.sin(angle) * ringR;
    const s = stats.byCategory[cat];
    const rate = s.played > 0 ? s.matched / s.played : 0;
    const active = s.played > 0;
    return { cat, x, y, rate, played: s.played, matched: s.matched, active };
  });

  const summary = CATEGORIES.map((cat) => {
    const s = stats.byCategory[cat];
    const pct = s.played > 0 ? Math.round((s.matched / s.played) * 100) : 0;
    return `${gp(CATEGORY_META[cat].label, langA)} ${s.played > 0 ? `${pct}%` : gp(WYR.noRecord, langA)}`;
  }).join(", ");

  return (
    <div className="wyr-web">
      <svg
        className="wyr-web-svg"
        role="img"
        aria-label={`${gt(WYR.secWeb, langA)} — ${summary}`}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Connecting lines */}
        {nodes.map((n) => {
          if (!n.active) {
            return (
              <line
                key={`line-${n.cat}`}
                x1={cx} y1={cy} x2={n.x} y2={n.y}
                stroke="var(--ux-surface-sunk)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          }
          const color = CATEGORY_META[n.cat].color;
          const thick = 2 + n.rate * 8; // 2..10 (viewBox 단위)
          return (
            <line
              key={`line-${n.cat}`}
              x1={cx} y1={cy} x2={n.x} y2={n.y}
              stroke={color}
              strokeWidth={thick}
              strokeLinecap="round"
              opacity={0.35 + n.rate * 0.5}
            />
          );
        })}

        {/* Center node */}
        <circle
          cx={cx} cy={cy} r={centerR}
          fill="var(--ux-surface)"
          stroke="var(--ux-primary-border)"
          strokeWidth={3}
        />
        <text x={cx} y={cy - 4} fontSize={22} textAnchor="middle" dominantBaseline="middle">🐝</text>
        <text
          x={cx} y={cy + 16}
          fontSize={10}
          fontWeight={900}
          fill="var(--ux-ink)"
          textAnchor="middle"
        >
          {gp(WYR.ourTaste, langA)}
        </text>

        {/* Category nodes */}
        {nodes.map((n) => {
          const meta = CATEGORY_META[n.cat];
          const pct = n.played > 0 ? Math.round(n.rate * 100) : 0;
          return (
            <g key={`node-${n.cat}`}>
              <circle
                cx={n.x} cy={n.y} r={nodeR}
                fill="var(--ux-surface)"
                stroke={n.active ? meta.color : "var(--ux-surface-sunk)"}
                strokeWidth={n.active ? 3 : 2}
              />
              <text x={n.x} y={n.y - 4} fontSize={18} textAnchor="middle" dominantBaseline="middle">
                {meta.emoji}
              </text>
              <text
                x={n.x} y={n.y + 14}
                fontSize={9}
                fontWeight={900}
                fill={n.active ? meta.color : "var(--ux-ink-soft)"}
                textAnchor="middle"
              >
                {n.active ? `${pct}%` : "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --------------------------------------------------------------
// CategoryBars — horizontal bar chart per category
// --------------------------------------------------------------
function CategoryBars({ stats, langA }: { stats: StatsState; langA: string }) {
  return (
    <div className="wyr-bars">
      {CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const s = stats.byCategory[cat];
        const rate = s.played > 0 ? (s.matched / s.played) : 0;
        const pct = Math.round(rate * 100);
        const active = s.played > 0;

        return (
          <div key={cat} className="wyr-bar" data-active={active ? "" : undefined}>
            <span data-ux-role="label" className="wyr-bar-name" style={{ color: active ? meta.color : "var(--ux-ink-soft)" }}>
              <span aria-hidden="true">{meta.emoji}</span>
              <span>{gp(meta.label, langA)}</span>
            </span>
            <span className="wyr-bar-track" aria-hidden="true">
              <span
                className="wyr-bar-fill"
                style={{
                  width: active ? `${Math.max(pct, 4)}%` : "0%",
                  background: active ? meta.color : "transparent",
                }}
              />
            </span>
            <span
              data-ux-role="secondary"
              className="wyr-bar-num"
              aria-label={`${gp(meta.label, langA)} ${active ? `${s.matched}/${s.played} ${gp(WYR.same, langA)} ${pct}%` : gp(WYR.noRecord, langA)}`}
            >
              {active ? `${s.matched}/${s.played}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------
// HistoryTable — card-by-card list
// --------------------------------------------------------------
function HistoryTable({
  history, langA,
}: {
  history: { category: WYRCategory; matched: boolean }[];
  langA: string;
}) {
  return (
    <div role="table" aria-label={gt(WYR.secTable, langA)} className="wyr-hist">
      <div role="row" className="wyr-hist-row wyr-hist-head">
        <span role="columnheader" data-ux-role="secondary">{gp(WYR.card, langA)}</span>
        <span role="columnheader" data-ux-role="secondary">{gp(WYR.colCategory, langA)}</span>
        <span role="columnheader" data-ux-role="secondary" className="wyr-hist-end">
          {gp(WYR.colResult, langA)}
        </span>
      </div>
      {history.map((h, i) => {
        const meta = CATEGORY_META[h.category];
        return (
          <div role="row" key={i} className="wyr-hist-row">
            <span role="cell" data-ux-role="secondary">#{i + 1}</span>
            <span role="cell" data-ux-role="label" className="wyr-hist-cat" style={{ color: meta.color }}>
              <span aria-hidden="true">{meta.emoji}</span>
              <span>{gp(meta.label, langA)}</span>
            </span>
            <span role="cell" className="wyr-hist-end">
              <span
                data-ux-role="secondary"
                className="wyr-chip"
                data-tone={h.matched ? "ok" : "cool"}
              >
                {h.matched ? `✓ ${gp(WYR.same, langA)}` : `≠ ${gp(WYR.different, langA)}`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ==============================================================
// Confetti — lightweight transform/opacity sprites (일치했을 때만)
// ==============================================================
function Confetti() {
  const pieces = useMemo(() => {
    const arr: { left: number; delay: number; emoji: string; rot: number; dur: number }[] = [];
    const emojis = ["🎊", "🌸", "✨", "🎉", "🌼"];
    for (let i = 0; i < 18; i++) {
      arr.push({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        emoji: emojis[i % emojis.length],
        rot: (Math.random() - 0.5) * 360,
        dur: 1.6 + Math.random() * 1.0,
      });
    }
    return arr;
  }, []);

  return (
    <div aria-hidden="true" className="wyr-confetti">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            ["--wyr-rot" as string]: `${p.rot}deg`,
          } as CSSProperties}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것.
   장식용 이모지만 토큰의 em 배수로 키운다. */
const WYR_CSS = `
.wyr-root{
  color: var(--ux-ink);
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--ux-space-4) var(--ux-space-3) var(--ux-space-8);
  box-sizing: border-box;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
/* min-width 는 여기서 0 으로 깔지 않는다 — 전역 [data-ux-role="control"] 의
   최소 조작 크기를 덮어써 버린다. 폭 제한은 grid 의 minmax(0, 1fr) 로만. */
.wyr-root *{ box-sizing: border-box; }
.wyr-card{
  background: var(--ux-surface);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-4);
}
.wyr-btn{
  font-family: inherit; font-weight: 800; cursor: pointer;
  border-radius: var(--ux-radius-pill);
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--ux-space-2);
}
.wyr-btn-primary[data-ux-role="action"],
.wyr-btn-primary[data-ux-role="control"]{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
}
.wyr-btn-quiet[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
}
.wyr-btn-grow{ flex: 2 1 240px; }
.wyr-actions{
  display: flex; flex-wrap: wrap; gap: var(--ux-space-3);
  margin-top: var(--ux-space-6);
}
.wyr-actions > .wyr-btn{ flex: 1 1 160px; }

/* ── intro ───────────────────────────────────────────────── */
.wyr-intro{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; }
.wyr-intro p{ margin: 0; }
.wyr-intro-hero{ font-size: calc(var(--ux-font-title) * 2.2); line-height: 1; }
.wyr-intro-title{ margin: 0; }
.wyr-intro-sub{ margin: 0; }
.wyr-intro-last{
  margin: 0; background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-4);
}
.wyr-intro-start{ margin-top: var(--ux-space-3); }
.wyr-seats{
  display: grid; gap: var(--ux-space-3); width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin: var(--ux-space-2) 0;
}
.wyr-seat{
  display: grid; justify-items: center; gap: var(--ux-space-1);
  background: var(--ux-surface);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-4) var(--ux-space-3);
  border: 3px solid var(--ux-surface-sunk);
}
.wyr-seat[data-player="A"]{ border-color: ${PLAYER_A_ACCENT}55; }
.wyr-seat[data-player="B"]{ border-color: ${PLAYER_B_ACCENT}55; }
.wyr-seat[data-player="A"] .wyr-seat-side{ color: ${PLAYER_A_ACCENT}; }
.wyr-seat[data-player="B"] .wyr-seat-side{ color: ${PLAYER_B_ACCENT}; }
.wyr-seat-bee{ font-size: calc(var(--ux-font-title) * 1.2); line-height: 1; }
.wyr-seat-name{ font-weight: 800; }

/* ── play: 진행 바 ───────────────────────────────────────── */
.wyr-statsbar{
  background: var(--ux-surface);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-4);
  margin-bottom: var(--ux-space-4);
}
.wyr-statsbar-row{
  display: flex; flex-wrap: wrap; gap: var(--ux-space-2) var(--ux-space-4);
  justify-content: space-between; align-items: center;
  font-weight: 800;
}
.wyr-progress{
  margin-top: var(--ux-space-2); height: 8px; border-radius: var(--ux-radius-pill);
  background: var(--ux-surface-sunk); overflow: hidden;
}
.wyr-progress-fill{
  display: block; height: 100%;
  background: var(--ux-primary-fill);
  transition: width var(--ux-motion-state) var(--ux-motion-ease);
}

/* ── play: 좌/우 대결 무대 ───────────────────────────────── */
.wyr-arena{
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ux-space-3);
  align-items: stretch;
}
.wyr-vs{
  justify-self: center; align-self: center;
  display: flex; align-items: center; justify-content: center;
  min-width: var(--ux-control-min); min-height: var(--ux-control-min);
  padding: var(--ux-space-2) var(--ux-space-3);
  border-radius: var(--ux-radius-pill);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  font-weight: 900; font-size: var(--ux-font-label); letter-spacing: .06em;
}
.wyr-side{
  position: relative;
  display: grid; justify-items: center; align-content: start;
  gap: var(--ux-space-2);
  padding: var(--ux-space-6) var(--ux-space-4) var(--ux-space-4);
  border-radius: var(--ux-radius-panel);
  background: var(--ux-surface);
  border: 3px solid var(--ux-surface-sunk);
  text-align: center;
  transition: border-color var(--ux-motion-state) var(--ux-motion-ease);
}
.wyr-side[data-opt="A"]{ border-color: ${OPT_A_ACCENT}55; }
.wyr-side[data-opt="B"]{ border-color: ${OPT_B_ACCENT}55; }
.wyr-side[data-chosen][data-opt="A"]{ border-color: ${OPT_A_ACCENT}; }
.wyr-side[data-chosen][data-opt="B"]{ border-color: ${OPT_B_ACCENT}; }
.wyr-side-badge{
  position: absolute; top: var(--ux-space-2); left: var(--ux-space-2);
  padding: var(--ux-space-1) var(--ux-space-3);
  border-radius: var(--ux-radius-pill);
  color: var(--ux-surface); font-weight: 900;
  font-size: var(--ux-font-secondary); letter-spacing: .08em;
}
.wyr-side[data-opt="A"] .wyr-side-badge{ background: ${OPT_A_ACCENT}; }
.wyr-side[data-opt="B"] .wyr-side-badge{ background: ${OPT_B_ACCENT}; }
.wyr-side-emoji{ font-size: calc(var(--ux-font-title) * 2); line-height: 1; }
.wyr-side-label{ margin: 0; font-weight: 900; }
.wyr-side-sub{ margin: 0; }
.wyr-side-votes{
  width: 100%; margin-top: var(--ux-space-2);
  display: grid; gap: var(--ux-space-2);
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
.wyr-vote[data-ux-role="control"]{
  display: grid; gap: var(--ux-space-1); justify-items: center;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-surface-sunk);
  font-family: inherit; font-weight: 800;
  transition: background var(--ux-motion-state) var(--ux-motion-ease),
              border-color var(--ux-motion-state) var(--ux-motion-ease);
}
.wyr-vote[data-player="A"]{ border-color: ${PLAYER_A_ACCENT}55; }
.wyr-vote[data-player="B"]{ border-color: ${PLAYER_B_ACCENT}55; }
.wyr-vote-who{ display: inline-flex; align-items: center; gap: var(--ux-space-1); }
.wyr-vote-state{ font-weight: 700; }
.wyr-vote[data-state="picked"][data-player="A"]{
  background: color-mix(in srgb, ${PLAYER_A_ACCENT} 14%, var(--ux-surface));
  border-color: ${PLAYER_A_ACCENT};
}
.wyr-vote[data-state="picked"][data-player="B"]{
  background: color-mix(in srgb, ${PLAYER_B_ACCENT} 14%, var(--ux-surface));
  border-color: ${PLAYER_B_ACCENT};
}
.wyr-vote[data-state="blocked"]{
  background: var(--ux-surface-sunk); cursor: default;
}
.wyr-hint{
  margin: var(--ux-space-4) 0 0; text-align: center;
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-4);
}

@media (min-width: 768px){
  .wyr-arena{ grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .wyr-side{ padding: var(--ux-space-8) var(--ux-space-6) var(--ux-space-6); }
  .wyr-side-emoji{ font-size: calc(var(--ux-font-title) * 3); }
}
@media (min-width: 1024px){
  .wyr-side-emoji{ font-size: calc(var(--ux-font-title) * 3.6); }
}

/* ── reveal ──────────────────────────────────────────────── */
.wyr-reveal-grid{
  display: grid; gap: var(--ux-space-4);
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}
.wyr-reveal-main{ position: relative; overflow: hidden; text-align: center; }
.wyr-reveal-main p{ margin: 0 0 var(--ux-space-2); }
.wyr-reveal-main[data-match]{ border-color: var(--ux-success); }
.wyr-reveal-bee{ display: flex; justify-content: center; margin-bottom: var(--ux-space-2); }
.wyr-reveal-title{ font-weight: 900; }
.wyr-reveal-main[data-match] .wyr-reveal-title{ color: var(--ux-success); }
.wyr-followup{
  background: var(--ux-surface-sunk);
  border: 2px dashed var(--ux-primary-border);
  display: grid; gap: var(--ux-space-2); align-content: start;
}
.wyr-followup p{ margin: 0; }
.wyr-followup-head{ font-weight: 900; letter-spacing: .05em; }
.wyr-followup-main{ font-weight: 800; }
.wyr-followup-sub{ color: var(--ux-ink-soft); }

.wyr-nodes{
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center; gap: var(--ux-space-2);
  background: var(--ux-surface-sunk);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
  margin-top: var(--ux-space-3);
}
.wyr-node{ display: grid; justify-items: center; gap: var(--ux-space-1); }
.wyr-node-bubble{
  width: 3.2em; height: 3.2em; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--ux-surface);
  font-size: calc(var(--ux-font-title) * 0.9); line-height: 1;
  border: 3px solid var(--ux-surface-sunk);
}
.wyr-node[data-player="A"] .wyr-node-bubble{ border-color: ${PLAYER_A_ACCENT}; }
.wyr-node[data-player="B"] .wyr-node-bubble{ border-color: ${PLAYER_B_ACCENT}; }
.wyr-node[data-player="A"] .wyr-node-who{ color: ${PLAYER_A_ACCENT}; }
.wyr-node[data-player="B"] .wyr-node-who{ color: ${PLAYER_B_ACCENT}; }
.wyr-node-who{ font-weight: 900; }
.wyr-node-label{ font-weight: 700; max-width: 100%; }
.wyr-conn{
  position: relative; display: flex; align-items: center;
  width: 4em; min-height: 2.4em;
}
.wyr-conn-line{ flex: 1; border-top: 3px dashed var(--ux-ink-soft); }
.wyr-conn[data-match] .wyr-conn-line{ border-top-style: solid; border-top-color: var(--ux-success); }
.wyr-conn-mark{
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft); color: var(--ux-ink-soft);
  font-size: var(--ux-font-secondary); font-weight: 900;
  padding: 0 var(--ux-space-2); border-radius: var(--ux-radius-pill);
  white-space: nowrap;
}
.wyr-conn[data-match] .wyr-conn-mark{ border-color: var(--ux-success); color: var(--ux-success); }

.wyr-chips{
  display: flex; flex-wrap: wrap; gap: var(--ux-space-2);
  justify-content: center; margin-top: var(--ux-space-3);
}
.wyr-chip{
  display: inline-flex; align-items: center; gap: var(--ux-space-1);
  padding: var(--ux-space-1) var(--ux-space-3);
  border-radius: var(--ux-radius-pill);
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  border: 2px solid var(--ux-surface-sunk);
  font-weight: 800;
}
.wyr-chip[data-tone="ok"]{ border-color: var(--ux-success); color: var(--ux-success); }
.wyr-chip[data-tone="cool"]{ border-color: var(--ux-primary-border); }
.wyr-chip[data-tone="warm"]{ border-color: var(--ux-primary-border); }

.wyr-confetti{
  position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 3;
}
.wyr-confetti span{
  position: absolute; top: 0;
  font-size: calc(var(--ux-font-title) * 0.8);
  animation-name: wyrConfettiFall;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
@keyframes wyrConfettiFall{
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translateY(320px) rotate(var(--wyr-rot, 180deg)); opacity: 0; }
}

@media (min-width: 900px){
  .wyr-reveal-grid{ grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
}

/* ── summary ─────────────────────────────────────────────── */
.wyr-summary{ display: grid; gap: var(--ux-space-4); }
.wyr-sum-head{ text-align: center; }
.wyr-sum-hero{ font-size: calc(var(--ux-font-title) * 1.8); line-height: 1; }
.wyr-sum-title{ margin: var(--ux-space-2) 0 0; }
.wyr-sum-empty{ margin: 0; text-align: center; border-style: dashed; }
.wyr-sum-grid{
  display: grid; gap: var(--ux-space-4);
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  align-items: start;
}
.wyr-sec-head{
  margin: 0 0 var(--ux-space-3); font-weight: 900; letter-spacing: .03em;
}
.wyr-web{ display: flex; justify-content: center; }
.wyr-web-svg{ width: 100%; max-width: 340px; height: auto; }

.wyr-bars{ display: grid; gap: var(--ux-space-3); }
.wyr-bar{ display: grid; grid-template-columns: minmax(0, 7em) minmax(0, 1fr) auto; align-items: center; gap: var(--ux-space-2); }
.wyr-bar-name{ display: inline-flex; align-items: center; gap: var(--ux-space-1); font-weight: 900; }
.wyr-bar-track{
  display: block; height: 14px; border-radius: var(--ux-radius-pill);
  background: var(--ux-surface-sunk); overflow: hidden;
}
.wyr-bar-fill{ display: block; height: 100%; transition: width var(--ux-motion-state) var(--ux-motion-ease); }
.wyr-bar-num{ font-weight: 800; text-align: right; white-space: nowrap; }

.wyr-hist{ display: grid; gap: var(--ux-space-1); }
.wyr-hist-row{
  display: grid; grid-template-columns: 3.5em minmax(0, 1fr) auto;
  gap: var(--ux-space-2); align-items: center;
  padding: var(--ux-space-2);
  border-bottom: 1px dashed var(--ux-surface-sunk);
}
.wyr-hist-row:last-child{ border-bottom: none; }
.wyr-hist-head{ border-bottom: 2px dashed var(--ux-primary-border); font-weight: 900; }
.wyr-hist-cat{ display: inline-flex; align-items: center; gap: var(--ux-space-2); font-weight: 900; }
.wyr-hist-end{ text-align: right; justify-self: end; }
`;
