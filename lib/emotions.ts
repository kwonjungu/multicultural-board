import { ref, push, set, runTransaction, onValue, off } from "@/lib/db";
import { getClientDb } from "./firebase-client";
import { giveIndividualSticker } from "./stickers";
import { reportQuestEvent } from "./quests";
import type { LangMap } from "./gameData";

// "내 감정 표현하기" — 활동 중 학생이 빠르게 비언어 표현으로 감정을 공유하는 카드.
// 패들렛 / 그림책 수업 양쪽 학생 소통 화면에서 재사용한다.

export type EmotionId =
  | "joy" | "sad" | "angry" | "surprised" | "scared" | "calm"
  | "tired" | "proud" | "unfair" | "curious" | "shy" | "grateful"
  // ── 확장 8 (2026-09) — 꿀벌 그림이 이미 있는데 감정 카드가 없던 무드 ──
  | "worried" | "excited" | "lonely" | "bored"
  | "letdown" | "loved" | "hopeful" | "peaceful";

export interface ExpressEmotion {
  id: EmotionId;
  emoji: string;
  hue: string;          // 카드 배경 그라데이션 hue
  label: LangMap;
}

// 20감정 — 기본 6 + 확장 6 (황의순 교사 요청) + 확장 8 (꿀벌 그림 전량 사용).
//
// 개수의 상한은 **꿀벌 그림(lib/beeMoods, 20종)** 이 정한다. 감정 카드는 그림을
// 그쪽에서 빌려 오므로, 그림이 없는 감정을 만들면 카드에 얼굴이 비어 버린다.
// 20종을 1:1로 다 쓰면 여기가 20개가 되고, 그 이상은 새 꿀벌 그림이 먼저 필요하다.
export const EXPRESS_EMOTIONS: ExpressEmotion[] = [
  { id: "joy", emoji: "😄", hue: "#FBBF24", label: {
    ko: "기쁨", en: "Joy", vi: "Vui", zh: "开心", ja: "うれしい", th: "ดีใจ",
    id: "Senang", hi: "खुशी", ru: "Радость", ar: "فرح", fil: "Saya",
    km: "រីករាយ", mn: "Баяр", uz: "Quvonch", my: "ပျော်တယ်",
  }},
  { id: "sad", emoji: "😢", hue: "#60A5FA", label: {
    ko: "슬픔", en: "Sad", vi: "Buồn", zh: "难过", ja: "かなしい", th: "เศร้า",
    id: "Sedih", hi: "उदास", ru: "Грусть", ar: "حزن", fil: "Malungkot",
    km: "ព្រួយ", mn: "Гуниг", uz: "Gʻamgin", my: "ဝမ်းနည်း",
  }},
  { id: "angry", emoji: "😠", hue: "#EF4444", label: {
    ko: "화남", en: "Angry", vi: "Tức giận", zh: "生气", ja: "おこる", th: "โกรธ",
    id: "Marah", hi: "गुस्सा", ru: "Злость", ar: "غاضب", fil: "Galit",
    km: "ខឹង", mn: "Уурлах", uz: "Achchiq", my: "ဒေါသ",
  }},
  { id: "surprised", emoji: "😮", hue: "#F472B6", label: {
    ko: "놀람", en: "Surprised", vi: "Ngạc nhiên", zh: "惊讶", ja: "びっくり", th: "ตกใจ",
    id: "Kaget", hi: "हैरान", ru: "Удивление", ar: "مفاجأة", fil: "Gulat",
    km: "ភ្ញាក់ផ្អើល", mn: "Гайхах", uz: "Hayron", my: "အံ့ဩ",
  }},
  { id: "scared", emoji: "😨", hue: "#8B5CF6", label: {
    ko: "두려움", en: "Scared", vi: "Sợ hãi", zh: "害怕", ja: "こわい", th: "กลัว",
    id: "Takut", hi: "डर", ru: "Страх", ar: "خوف", fil: "Takot",
    km: "ភ័យ", mn: "Айх", uz: "Qoʻrqinch", my: "ကြောက်",
  }},
  { id: "calm", emoji: "😌", hue: "#34D399", label: {
    ko: "평온", en: "Calm", vi: "Bình tĩnh", zh: "平静", ja: "おだやか", th: "สงบ",
    id: "Tenang", hi: "शांत", ru: "Спокойствие", ar: "هادئ", fil: "Kalmado",
    km: "ស្ងប់", mn: "Тайван", uz: "Tinch", my: "ငြိမ်",
  }},
  // ── 확장 6 ──
  { id: "tired", emoji: "😴", hue: "#94A3B8", label: {
    ko: "피곤", en: "Tired", vi: "Mệt", zh: "累", ja: "つかれた", th: "เหนื่อย",
    id: "Lelah", hi: "थका", ru: "Усталость", ar: "متعب", fil: "Pagod",
    km: "ហត់", mn: "Ядрах", uz: "Charchoq", my: "မော",
  }},
  { id: "proud", emoji: "🥰", hue: "#F59E0B", label: {
    ko: "뿌듯", en: "Proud", vi: "Tự hào", zh: "自豪", ja: "ほこらしい", th: "ภูมิใจ",
    id: "Bangga", hi: "गर्व", ru: "Гордость", ar: "فخور", fil: "Ipinagmamalaki",
    km: "មោទនភាព", mn: "Бахархах", uz: "Faxr", my: "ဂုဏ်ယူ",
  }},
  { id: "unfair", emoji: "😤", hue: "#F97316", label: {
    ko: "억울", en: "Unfair", vi: "Tủi thân", zh: "委屈", ja: "くやしい", th: "น้อยใจ",
    id: "Tidak adil", hi: "अन्याय", ru: "Обида", ar: "ظلم", fil: "Hindi patas",
    km: "មិនយុត្តិធម៌", mn: "Гомдох", uz: "Adolatsiz", my: "မတရား",
  }},
  { id: "curious", emoji: "🤔", hue: "#22D3EE", label: {
    ko: "궁금", en: "Curious", vi: "Tò mò", zh: "好奇", ja: "きになる", th: "อยากรู้",
    id: "Penasaran", hi: "जिज्ञासु", ru: "Любопытство", ar: "فضولي", fil: "Mausisa",
    km: "ចង់ដឹង", mn: "Сонирхох", uz: "Qiziquvchi", my: "သိချင်",
  }},
  { id: "shy", emoji: "😳", hue: "#FB7185", label: {
    ko: "부끄러움", en: "Shy", vi: "Ngại", zh: "害羞", ja: "はずかしい", th: "อาย",
    id: "Malu", hi: "शर्म", ru: "Стеснение", ar: "خجل", fil: "Mahiyain",
    km: "ខ្មាស់", mn: "Ичих", uz: "Uyat", my: "ရှက်",
  }},
  { id: "grateful", emoji: "🙏", hue: "#A78BFA", label: {
    ko: "감사", en: "Grateful", vi: "Biết ơn", zh: "感谢", ja: "ありがたい", th: "ขอบคุณ",
    id: "Bersyukur", hi: "आभारी", ru: "Благодарность", ar: "ممتن", fil: "Nagpapasalamat",
    km: "អរគុណ", mn: "Талархах", uz: "Minnatdor", my: "ကျေးဇူးတင်",
  }},

  // ────────────────────────────────────────────────────────────────────
  // 확장 8 (2026-09)
  //
  // ⚠️ 아래 8종의 ko 이외 14개 언어 라벨은 **기계 번역이다. 검토가 필요하다.**
  //    앱 자체 번역 API(/api/translate)를 쓰려 했으나 이 환경에 GROQ_API_KEY 가
  //    없어 500 을 돌려주었다(.env.local 부재). 그래서 모델이 직접 채워 넣었고,
  //    사람 검수를 거치지 않았다. 특히 km(크메르)·my(버마)·mn(몽골)·uz(우즈베크)는
  //    화면에서 길이가 튀거나 뜻이 어긋날 수 있다.
  //    위 12종(검수 완료분)과 달리 이 8종은 **선생님 확인 전 임시값**으로 다뤄라.
  // ────────────────────────────────────────────────────────────────────
  { id: "worried", emoji: "😟", hue: "#818CF8", label: {
    ko: "걱정", en: "Worried", vi: "Lo lắng", zh: "担心", ja: "しんぱい", th: "กังวล",
    id: "Khawatir", hi: "चिंता", ru: "Тревога", ar: "قلق", fil: "Nag-aalala",
    km: "បារម្ភ", mn: "Санаа зовох", uz: "Xavotir", my: "စိုးရိမ်",
  }},
  { id: "excited", emoji: "🤩", hue: "#FACC15", label: {
    ko: "신남", en: "Excited", vi: "Hào hứng", zh: "兴奋", ja: "わくわく", th: "ตื่นเต้น",
    id: "Semangat", hi: "उत्साह", ru: "Восторг", ar: "متحمس", fil: "Sabik",
    km: "រំភើប", mn: "Догдлох", uz: "Hayajon", my: "စိတ်လှုပ်ရှား",
  }},
  { id: "lonely", emoji: "🥺", hue: "#38BDF8", label: {
    ko: "외로움", en: "Lonely", vi: "Cô đơn", zh: "孤单", ja: "さびしい", th: "เหงา",
    id: "Kesepian", hi: "अकेलापन", ru: "Одиноко", ar: "وحيد", fil: "Nag-iisa",
    km: "ឯកា", mn: "Ганцаардах", uz: "Yolgʻizlik", my: "အထီးကျန်",
  }},
  { id: "bored", emoji: "😑", hue: "#A8A29E", label: {
    ko: "지루함", en: "Bored", vi: "Chán", zh: "无聊", ja: "たいくつ", th: "เบื่อ",
    id: "Bosan", hi: "ऊब", ru: "Скука", ar: "ملل", fil: "Nababagot",
    km: "អផ្សុក", mn: "Уйдах", uz: "Zerikish", my: "ငြီးငွေ့",
  }},
  { id: "letdown", emoji: "😞", hue: "#64748B", label: {
    ko: "실망", en: "Let down", vi: "Thất vọng", zh: "失望", ja: "がっかり", th: "ผิดหวัง",
    id: "Kecewa", hi: "निराशा", ru: "Огорчение", ar: "خيبة أمل", fil: "Bigo",
    km: "ខកចិត្ត", mn: "Урам хугарах", uz: "Umidsizlik", my: "စိတ်ပျက်",
  }},
  { id: "loved", emoji: "💖", hue: "#F9A8D4", label: {
    ko: "사랑받음", en: "Loved", vi: "Được yêu", zh: "被爱", ja: "あいされる", th: "ถูกรัก",
    id: "Disayangi", hi: "प्यार मिला", ru: "Любимый", ar: "محبوب", fil: "Minamahal",
    km: "ត្រូវបានស្រឡាញ់", mn: "Хайрлуулах", uz: "Sevilgan", my: "ချစ်ခံရ",
  }},
  { id: "hopeful", emoji: "✨", hue: "#2DD4BF", label: {
    ko: "기대", en: "Hopeful", vi: "Mong chờ", zh: "期待", ja: "たのしみ", th: "ตั้งตารอ",
    id: "Berharap", hi: "आशा", ru: "Надежда", ar: "متفائل", fil: "Umaasa",
    km: "សង្ឃឹម", mn: "Найдах", uz: "Umid", my: "မျှော်လင့်",
  }},
  { id: "peaceful", emoji: "🍃", hue: "#86EFAC", label: {
    ko: "안심", en: "Peaceful", vi: "Yên tâm", zh: "安心", ja: "あんしん", th: "โล่งใจ",
    id: "Lega", hi: "निश्चिंत", ru: "Облегчение", ar: "اطمئنان", fil: "Panatag",
    km: "ស្ងប់ចិត្ត", mn: "Санаа амрах", uz: "Xotirjam", my: "စိတ်အေး",
  }},
];

export type EmotionContext = "padlet" | "storybook";

export interface EmotionEntry {
  id: string;
  emotionId: EmotionId;
  intensity: 1 | 2 | 3;
  clientId: string;
  authorName: string;
  context: EmotionContext;
  ts: number;
  // 그림책 수업 컨텍스트에서만 채워짐 (어느 페이지/질문에 대한 감정인지 추적용)
  bookId?: string;
  pageIdx?: number;
}

export interface PushEmotionParams {
  roomCode: string;
  emotionId: EmotionId;
  intensity?: 1 | 2 | 3;
  clientId: string;
  authorName: string;
  context: EmotionContext;
  bookId?: string;
  pageIdx?: number;
}

function basePath(roomCode: string): string {
  return `rooms/${roomCode}/emotions`;
}

export async function pushEmotion(p: PushEmotionParams): Promise<string> {
  const db = getClientDb();
  const listRef = ref(db, `${basePath(p.roomCode)}/${p.clientId}`);
  const newRef = push(listRef);
  const id = newRef.key as string;
  const entry: EmotionEntry = {
    id,
    emotionId: p.emotionId,
    intensity: p.intensity ?? 2,
    clientId: p.clientId,
    authorName: p.authorName,
    context: p.context,
    ts: Date.now(),
  };
  if (p.bookId) entry.bookId = p.bookId;
  if (typeof p.pageIdx === "number") entry.pageIdx = p.pageIdx;
  await set(newRef, entry);
  // 📋 일일 퀘스트 — 감정 체크인 저장 성공 직후 (EmotionCardDeck 은 room/clientId
  // 스코프가 없어 실제 저장 성공 지점인 여기서 계측. 호출부는 전부 학생 onPick).
  // 퀘스트 키는 학생 이름 (village/stickers 와 동일) — p.clientId 는 UUID 인 경우가
  // 있어 authorName(= user.myName) 을 사용.
  reportQuestEvent(p.roomCode, p.authorName, "emotion_checkin");
  return id;
}

// 교사 화면 — 최근 30분 모든 학생 감정 타임라인 구독.
export function subscribeEmotionsRecent(
  roomCode: string,
  windowMs: number,
  cb: (entries: EmotionEntry[]) => void,
): () => void {
  const db = getClientDb();
  const r = ref(db, basePath(roomCode));
  const handler = onValue(r, (snap) => {
    const cutoff = Date.now() - windowMs;
    const out: EmotionEntry[] = [];
    snap.forEach((studentSnap) => {
      studentSnap.forEach((entrySnap) => {
        const v = entrySnap.val() as EmotionEntry | null;
        if (v && typeof v.ts === "number" && v.ts >= cutoff) out.push(v);
        return false;
      });
      return false;
    });
    out.sort((a, b) => b.ts - a.ts);
    cb(out);
  });
  return () => off(r, "value", handler);
}

export function emotionById(id: EmotionId): ExpressEmotion {
  return EXPRESS_EMOTIONS.find((e) => e.id === id) ?? EXPRESS_EMOTIONS[0];
}

export function emotionLabel(id: EmotionId, lang: string): string {
  const e = emotionById(id);
  return e.label[lang] ?? e.label.en ?? e.label.ko ?? e.id;
}

function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 감정 카드 사용 시 하루 최대 1회 자동 스티커 지급. 게이미피케이션 연결고리.
// Firebase 노드 rooms/{roomCode}/emotions/_lastAward/{clientId} 에 마지막 지급 날짜(YYYY-MM-DD) 기록.
// 이미 오늘 받았으면 noop. 첫 사용 시 "curious" 스티커 1개 자동 지급.
export async function awardEmotionStickerOncePerDay(params: {
  roomCode: string;
  clientId: string;
  studentName: string;
}): Promise<boolean> {
  const { roomCode, clientId, studentName } = params;
  const db = getClientDb();
  const stampPath = `${basePath(roomCode)}/_lastAward/${clientId}`;
  const stampRef = ref(db, stampPath);
  const today = todayKey();
  // 트랜잭션으로 "오늘 도장이 비어있다 → 도장 찍기" 를 원자적으로 처리.
  // committed === true 만 스티커 지급 — 동시에 두 번 호출돼도 한 번만 지급.
  try {
    const res = await runTransaction(stampRef, (cur: unknown) => {
      if (cur === today) return; // 이미 받음 → abort
      return today;
    });
    if (!res.committed) return false;
    if (res.snapshot.val() !== today) return false;
    // 도장 선점 성공 → 스티커 지급
    await giveIndividualSticker(
      roomCode,
      clientId,
      "curious",
      studentName,
      "emotion-bot",
      { source: "mission", missionId: "emotion:daily" },
    );
    return true;
  } catch (err) {
    console.warn("[emotions] 스티커 지급 실패", err);
    return false;
  }
}

/**
 * 감정 카드 → 꿀벌 감정 그림(lib/beeMoods) 짝짓기.
 *
 * 감정 카드는 15개 언어 라벨을 갖고 있고 꿀벌 무드는 한국어·영어만 있다.
 * 그래서 목록을 합치지 않고 **그림만** 빌려 온다. 여기를 바꾸면 화면의
 * 그림이 바뀌므로, 뜻이 가장 가까운 것으로만 짝지을 것.
 *
 * 확장 8을 더해 이제 꿀벌 무드 20종을 **하나도 남김없이 1:1로** 쓴다.
 * 이 표에 같은 무드가 두 번 나오면 카드 두 장이 같은 얼굴이 된다 — 금지.
 * 감정을 더 늘리려면 lib/beeMoods.ts 에 새 무드와 그림이 먼저 있어야 한다.
 */
export const EMOTION_MOOD: Record<EmotionId, string> = {
  joy: "happy",
  sad: "sad",
  angry: "angry",
  surprised: "surprised",
  scared: "nervous",
  calm: "calm",
  tired: "tired",
  proud: "proud",
  unfair: "frustrated",
  curious: "curious",
  shy: "shy",
  grateful: "thankful",
  // ── 확장 8 ──
  worried: "worried",
  excited: "excited",
  lonely: "lonely",
  bored: "bored",
  letdown: "let-down",
  loved: "loved",
  hopeful: "hopeful",
  peaceful: "peaceful",
};
