import { ref, push, set, runTransaction, onValue, off } from "firebase/database";
import { getClientDb } from "./firebase-client";
import { giveIndividualSticker } from "./stickers";
import { reportQuestEvent } from "./quests";
import type { LangMap } from "./gameData";

// "내 감정 표현하기" — 활동 중 학생이 빠르게 비언어 표현으로 감정을 공유하는 카드.
// 패들렛 / 그림책 수업 양쪽 학생 소통 화면에서 재사용한다.

export type EmotionId =
  | "joy" | "sad" | "angry" | "surprised" | "scared" | "calm"
  | "tired" | "proud" | "unfair" | "curious" | "shy" | "grateful";

export interface ExpressEmotion {
  id: EmotionId;
  emoji: string;
  hue: string;          // 카드 배경 그라데이션 hue
  label: LangMap;
}

// 12감정 — 황의순 교사 요청: 기본 6 + 확장 6.
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
