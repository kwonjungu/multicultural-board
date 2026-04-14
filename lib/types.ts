export interface CardData {
  id: string;
  colId: string;
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

export interface TranslateRequest {
  text: string;
  fromLang: string;
  targetLangs: string[];
  colId: string;
  authorName: string;
  isTeacher: boolean;
  paletteIdx: number;
}

export interface TranslateResponse {
  id: string;
  translations: Record<string, string>;
  safe: boolean;
  reason?: string;
  error?: boolean;
}
