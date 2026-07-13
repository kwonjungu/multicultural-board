export type CardType = "text" | "image" | "youtube" | "drawing";

export type CardStatus = "pending" | "approved";

export interface RoomConfig {
  languages: string[];
  qrEntry?: boolean;
  rosterMode?: boolean;
  roster?: string[];
  approvalMode?: boolean;
  /** 교사 입장 암호. 미설정(기본)이면 방 번호와 동일. 관리 패널에서 변경/초기화. */
  teacherPin?: string;
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
  /** true 면 활성 세션 중에도 응답을 실시간 공개(학생은 본인 제출 후 열람). 기본/undefined = 종료 후 공개(열매나무). */
  liveReveal?: boolean;
}

export interface SessionReply {
  authorName: string;
  authorLang: string;
  authorClientId: string;
  text: string;
  translations?: Record<string, string>;
  timestamp: number;
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
  reactions?: Record<string, string>;        // clientId → emoji (한 사람당 하나)
  replies?: Record<string, SessionReply>;    // replyId → reply
  kind?: "text" | "drawing";   // 없으면 text (하위호환)
  imageUrl?: string;           // kind==="drawing" 일 때 그림 URL
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
// crown-* 3종은 여왕벌 전용 신규 왕관 — 기본 모자처럼 합성본으로 렌더
// (stage-hats/skin-hats, scripts/gen-queen-crown-composites.mjs 로 생성)
export type HatId =
  | "top" | "cap" | "party" | "crown"
  | "crown-rose" | "crown-sapphire" | "crown-honey"
  | null;
// fox/owl 은 로열 마일스톤(스티커 20/25개) 해금 — 꿀벌 마을 마스터플랜
export type PetId = "dog" | "cat" | "rabbit" | "butterfly" | "fox" | "owl" | null;
export type TrophyId = "gold" | "star" | "diamond" | null;
// 코스메틱 확장 Phase 3-4 (런타임 오버레이 — 합성본 불필요)
export type BackdropId = "flower" | "hive" | "rainbow" | "night" | "throne" | "galaxy" | null;
export type AuraId = "sparkle" | "heart" | "stardust" | "royal" | "prism" | null;
// 소지품(손)·액세서리(몸) — 런타임 오버레이, anchors.json 의 face/neck 좌표 사용
export type HeldId = "honeypot" | "book" | "flag" | null;
export type AccId = "scarf" | "glasses" | "necklace" | "cape" | null;

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
  /** 펫 위치 — 기본 "right"(우하단). 코스메틱 확장 Phase 1. */
  petPos?: "right" | "left";
  /** 배경(캐릭터 뒤 풀사이즈). throne 은 여왕벌 전용. Phase 3. */
  backdrop?: BackdropId;
  /** 오라(캐릭터를 감싸는 이펙트 프레임). royal 은 여왕벌 전용. Phase 3. */
  aura?: AuraId;
  /** 소지품(손/발치 오버레이). 꿀벌 마을 확장. */
  held?: HeldId;
  /** 액세서리(얼굴·목·몸 오버레이). cape 는 여왕벌 전용. 꿀벌 마을 확장. */
  acc?: AccId;
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
  /** [캐릭터 통일성] 이 장면에 등장하는 캐릭터 id — 참조 이미지 선택에 사용 */
  characterIds?: string[];
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
  /** [캐릭터 통일성] canonical 외형 서술 (영어 1문장) — 모든 이미지 프롬프트에 주입 */
  designEn?: string;
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
  /** [퀴즈 예문] 낱말이 실제로 쓰인 책 문장 (lang -> 문장) */
  example?: Record<string, string>;
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
  visible?: boolean;                      // [신규] 학생 자유 읽기 공개 여부 (기본=숨김)
  wordQuizEnabled?: boolean;              // [신규] 책별 단어 퀴즈 기본 사용 여부
  /** 자유 읽기(복습) 중 캐릭터 챗봇 허용 — 교사가 책별로 ON (설계서 항목 3, 기본 OFF) */
  chatEnabled?: boolean;
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
  /** 교사 허용 시 복습(during) 중에도 캐릭터 챗봇 사용 가능 — 기본 OFF (설계서 항목 3) */
  allowReviewChat?: boolean;
  /** [항목 7] 교사가 자동 읽기 중일 때 true — 학생 화면에 배지를 표시. */
  autoReading?: boolean;
}

/** 응답에 달리는 친구 의견 (복습 중 댓글 — 설계서 항목 1) */
export interface StorybookResponseComment {
  id: string;
  clientId: string;
  studentName: string;
  studentLang: string;
  text: string;
  timestamp: number;
  flagged?: boolean;
}

export interface StorybookResponse {
  id: string;
  questionId: string;
  clientId: string;
  studentName: string;
  studentLang: string;
  text: string;
  timestamp: number;
  /** 응답 종류 — 그림이면 "drawing", 감정 카드면 "emotion", 그 외 글/말은 "text". */
  kind?: "text" | "drawing" | "emotion";
  /** 그림 응답일 때 업로드된 이미지 URL. */
  imageUrl?: string;
  /** 하위 노드로 저장되는 댓글 — subscribeResponses raw 에 섞여 올 수 있음 */
  comments?: Record<string, StorybookResponseComment>;
}

// [#6 그림책] 그리는 중 실시간 스냅샷 — 교사 라이브 모니터링용.
//   rooms/{roomCode}/storybook/boards/{questionId}/{clientId}
export interface StorybookLiveBoard {
  clientId: string;
  studentName: string;
  dataUrl: string;
  updatedAt: number;
  submitted: boolean;
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
