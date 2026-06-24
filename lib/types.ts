export type CardType = "text" | "image" | "youtube" | "drawing";

export type CardStatus = "pending" | "approved";

export interface RoomConfig {
  languages: string[];
  qrEntry?: boolean;
  rosterMode?: boolean;
  roster?: string[];
  approvalMode?: boolean;
}

export interface CardData {
  id: string;
  colId: string;
  cardType: CardType;
  authorLang: string;
  authorName: string;
  isTeacher: boolean;
  originalText: string;
  translations: Record<string, string>;
  paletteIdx: number;
  timestamp: number;
  loading?: boolean;
  flagged: boolean;
  flagReason?: string;
  translateError?: boolean;
  imageUrl?: string;
  youtubeId?: string;
  status?: CardStatus;
  authorClientId?: string;
  editedAt?: number;
  transcript?: TranscriptData;
}

// YouTube 카드의 자막 + 번역 캐시. /api/youtube-transcript 가 채워
// rooms/{roomCode}/cards/{cardId}/transcript 에 저장한다.
export interface TranscriptData {
  available: boolean;
  reason?: string;                       // available=false 일 때 한국어 사유
  sourceLang: string;                    // 자막 트랙 언어 ("" 이면 미상)
  original: string;                      // 원어 전문
  translations: Record<string, string>;  // lang -> 번역 전문
  fetchedAt: number;
  truncated?: boolean;                   // 길이 상한으로 잘렸는지
}

export interface ColumnData {
  id: string;
  title: string;
  color: string;
}

export interface UserConfig {
  myLang: string;
  myName: string;
  isTeacher: boolean;
  teacherLangs: string[];
}

export interface PostData {
  cardType: CardType;
  text: string;
  writeLang: string;
  imageUrl?: string;
  youtubeId?: string;
  status?: CardStatus;
  authorClientId?: string;
}

export interface CommentData {
  id: string;
  authorName: string;
  authorLang: string;
  authorClientId: string;
  isTeacher: boolean;
  text: string;
  translations: Record<string, string>;
  timestamp: number;
  status?: CardStatus;
  flagged?: boolean;
}

export interface TranslateRequest {
  text: string;
  fromLang: string;
  targetLangs: string[];
  colId?: string;
  authorName: string;
  isTeacher: boolean;
  paletteIdx: number;
  roomCode: string;
  cardType?: CardType | "comment";
  imageUrl?: string;
  youtubeId?: string;
  status?: CardStatus;
  authorClientId?: string;
}

export interface TranslateResponse {
  id: string;
  translations: Record<string, string>;
  safe: boolean;
  reason?: string;
  error?: boolean;
}

export type SessionStatus = "active" | "closed";

export interface SessionMeta {
  id: string;
  title: string;
  titleTranslations?: Record<string, string>;
  bodyText?: string;
  bodyTextTranslations?: Record<string, string>;
  imageUrl?: string;
  startedAt: number;
  closedAt?: number;
  status: SessionStatus;
  teacherClientId: string;
  teacherLang: string;
  teacherName: string;
  targetLangs: string[];
}

export interface SessionResponse {
  id: string;
  authorName: string;
  authorLang: string;
  authorClientId: string;
  text: string;
  translations?: Record<string, string>;
  timestamp: number;
  position?: { x: number; y: number };
}

export interface PresenceEntry {
  name: string;
  lang: string;
  lastSeen: number;
  submitted: boolean;
}

// === Praise Sticker ("칭찬 스티커") system ===
export type StickerType = "helpful" | "brave" | "creative" | "cooperative" | "persistent" | "curious";
export type Stage = "egg" | "larva" | "pupa" | "bee" | "queen";
export type SkinId = "classic" | "orange" | "green" | "sky" | "pink" | "purple";
export type HatId = "top" | "cap" | "party" | "crown" | null;
export type PetId = "dog" | "cat" | "rabbit" | "butterfly" | null;
export type TrophyId = "gold" | "star" | null;

export type StickerSource = "teacher" | "mission";

export interface IndividualSticker {
  id: string;
  type: StickerType;
  fromTeacherName: string;
  fromTeacherId: string;
  timestamp: number;
  memo?: string;
  source?: StickerSource;
  missionId?: string;
}

export interface TeamSticker {
  id: string;
  type: StickerType;
  fromTeacherName: string;
  fromTeacherId: string;
  contributorClientId: string;
  timestamp: number;
  memo?: string;
  source?: StickerSource;
  missionId?: string;
}

export interface StickerGoal {
  target: number;
  seasonStart: number;
}

export interface StudentCosmetics {
  skin: SkinId;
  hat: HatId;
  pet: PetId;
  trophy: TrophyId;
}

// === Storybook ("그림책으로 공부하기") system ===

export type StorybookPhase = "before" | "during" | "after" | "done";
export type QuestionTier = "intro" | "check" | "core" | "deep" | "concept";
export type IbConcept =
  | "form" | "function" | "causation" | "change"
  | "connection" | "perspective" | "responsibility" | "reflection";

// Per-page illustration. In MVP we use emoji+gradient; later replaced with Gemini image URL.
export interface StorybookIllustration {
  emoji: string;              // e.g. "🐝🌸"
  bgGradient: string;         // CSS gradient
  imageUrl?: string;          // AI-generated or uploaded
  imagePrompt?: string;       // Used for cover (page uses StorybookPage.imagePrompt)
}

export interface StorybookPage {
  idx: number;                // 1-based; 0 reserved for cover
  text: Record<string, string>;   // lang -> text
  illustration: StorybookIllustration;
  imagePrompt?: string;       // For future regenerate
}

export interface StorybookQuestion {
  id: string;
  tier: QuestionTier;
  text: Record<string, string>;
  pageIdx?: number;           // For 'check' questions tied to a page
  ibConcept?: IbConcept;      // For 'concept' questions
  standard?: string;          // For 'deep' questions linked to 성취기준
}

export interface StorybookCharacter {
  id: string;
  name: Record<string, string>;
  avatarEmoji: string;        // Fallback when avatarUrl is not yet generated
  avatarUrl?: string;         // Subject-isolated portrait (character only, clean bg)
  avatarImagePrompt?: string; // English prompt used to generate avatarUrl
  personality: string;        // internal (system prompt only)
  speechStyle: string;
  bookContext: string;
  systemPromptExtra?: string; // additional hardening
}

// [신규] 그림책 단어 퀴즈 — 동화 생성 시 추출한 핵심·어려운 낱말.
export interface StorybookVocabWord {
  id: string;
  lemma: string;                          // ko 기본형
  word: Record<string, string>;           // lang -> 낱말 표기
  gloss: Record<string, string>;          // lang -> 1~2학년용 짧은 뜻풀이
  distractors: Record<string, string[]>;  // lang -> 오답 3개
  pageIdx: number;                        // 처음 등장 페이지
  difficulty: "easy" | "mid" | "hard";
}

export interface Storybook {
  id: string;
  title: Record<string, string>;
  cover: StorybookIllustration;
  authorName: string;
  createdAt: number;
  pages: StorybookPage[];
  characters: StorybookCharacter[];
  questions: StorybookQuestion[];
  vocab?: StorybookVocabWord[];           // [신규] 단어 퀴즈용 어휘 세트
}

export interface StorybookSession {
  bookId: string;
  phase: StorybookPhase;
  currentPage: number;        // 0 = cover, 1..N = pages
  currentQuestionId: string | null;
  activeCharacterId: string | null;  // which character is being chatted with (after phase)
  teacherClientId: string;
  startedAt: number;
  wordQuizEnabled?: boolean;  // [신규] 수업 전 단어 퀴즈(4지선다) 게이트 사용 여부
}

export interface StorybookResponse {
  id: string;
  questionId: string;
  clientId: string;
  studentName: string;
  studentLang: string;
  text: string;
  timestamp: number;
}

export interface StorybookChatTurn {
  id: string;
  from: "student" | "character";
  text: string;
  timestamp: number;
  flagged?: boolean;          // if safety filter triggered
}

export interface StorybookAlert {
  id: string;
  clientId: string;
  studentName: string;
  timestamp: number;
  kind: "distress" | "turn_limit" | "repeated_block";
}
