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
