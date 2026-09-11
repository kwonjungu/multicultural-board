"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LANGUAGES } from "@/lib/constants";
import { UI_TEXT, t } from "@/lib/i18n";
import { UserConfig, PostData, CardType, CardData, CardStatus } from "@/lib/types";
import DrawBoard from "./DrawBoard";
import WorksheetTab from "./WorksheetTab";
import { WorksheetAnalyzeView } from "./WorksheetAnalyzeModal";
import { compressToUnder1MB, fmtBytes } from "@/lib/imageUtils";
import ScopedStyle from "./ui/child/ScopedStyle";
import {
  createClientRequestId,
  initialPostDraft,
  postDraftReducer,
  submitBlock,
  type PostDraftContent,
  type PostErrorCode,
} from "@/lib/postDraftState";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

async function uploadToServer(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, `upload_${Date.now()}.jpg`);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "업로드 실패");
  }
  const data = await res.json();
  return data.url as string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const bstr = atob(data);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

/** 텍스트에 끼워 넣는 문구는 한국어 병기 없이 그대로 쓴다 (t() 는 표시용). */
function rawT(key: string, lang: string): string {
  const map = UI_TEXT[key];
  return map?.[lang] || map?.["en"] || map?.["ko"] || "";
}

type ModalMode = CardType | "worksheet" | "analyze";
/** 첫 선택 → 상세 선택 → 편집기. 기존 기능은 하나도 지우지 않고 상세로 내려간다. */
type Screen = "ways" | "pictureWays" | "editor";

/**
 * 부모가 서버 결과를 알려줄 수 있으면 이 모양으로 돌려준다.
 * 돌려주지 않으면(= 기존 PadletBoard) 모달은 '보냄, 확인 못 함'에서 멈추고
 * 절대 '저장 완료'라고 말하지 않는다 (POST-02).
 */
export interface PostSubmitOutcome {
  ok: boolean;
  error?: PostErrorCode;
}

/** 재시도가 같은 id 를 다시 보낸다. 중복 저장 방지는 서버/DB 경계의 책임이다. */
export type PostSubmitPayload = PostData & { clientRequestId?: string };

interface Props {
  colId: string;
  colTitle: string;
  colColor: string;
  user: UserConfig;
  posting: boolean;
  onPost: (data: PostSubmitPayload) => void | Promise<PostSubmitOutcome | void>;
  onClose: () => void;
  approvalMode?: boolean;
  myClientId?: string;
  editCard?: CardData;
  roomCode: string;
}

/** 소프트 키보드로 줄어든 실제 가시 영역. 입력·올리기 버튼이 가려지면 안 된다. */
function useVisualViewport(): { height: number; offsetTop: number } {
  const [vp, setVp] = useState({ height: 0, offsetTop: 0 });
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      if (vv) setVp({ height: Math.round(vv.height), offsetTop: Math.round(vv.offsetTop) });
      else setVp({ height: window.innerHeight, offsetTop: 0 });
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return vp;
}

const HINTS = ["postHint1", "postHint2", "postHint3", "postHint4"] as const;
const HINT_LABEL: Record<string, string> = {
  postHint1: "postHint1Full",
  postHint2: "postHint2Full",
  postHint3: "postHint3Full",
  postHint4: "postHint4Full",
};
const MAX_RECORD_MS = 60000;

export default function PostModal({
  colId,
  colTitle,
  colColor,
  user,
  posting,
  onPost,
  onClose,
  approvalMode,
  myClientId,
  editCard,
  roomCode,
}: Props) {
  const lang = user.myLang;
  const isEdit = !!editCard;
  const draftKey = editCard ? null : `draft_${roomCode}_${colId}`;
  /** 학생 글만 승인 대기로 간다. 교사 글은 종전대로 바로 공개된다. */
  const shouldPend = !!approvalMode && !user.isTeacher;

  const [state, dispatch] = useReducer(postDraftReducer, initialPostDraft({
    kind: (editCard?.cardType as PostDraftContent["kind"]) ?? "text",
    text: editCard?.originalText || "",
    writeLang: editCard ? editCard.authorLang : user.myLang,
    mediaRef: editCard?.imageUrl || (editCard?.youtubeId ? `https://youtu.be/${editCard.youtubeId}` : null),
  }));
  /** 비동기 콜백이 보는 최신 상태. setState 클로저의 stale 값을 쓰지 않기 위한 거울. */
  const stateRef = useRef(state);
  stateRef.current = state;

  const [screen, setScreen] = useState<Screen>(isEdit ? "editor" : "ways");
  const [mode, setMode] = useState<ModalMode>((editCard?.cardType as ModalMode) ?? "text");
  const [hintKey, setHintKey] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(editCard?.imageUrl || null);
  const [imageOrigSize, setImageOrigSize] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [compressedSize, setCompressedSize] = useState(0);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState(
    editCard?.cardType === "youtube" && editCard.youtubeId ? `https://youtu.be/${editCard.youtubeId}` : ""
  );

  const [hasDraft, setHasDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [blockHint, setBlockHint] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [micBlocked, setMicBlocked] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** unmount 뒤 늦게 돌아온 응답으로 상태를 바꾸지 않는다. */
  const aliveRef = useRef(true);
  /** 같은 요청을 재시도할 때 이미 올라간 이미지를 다시 올리지 않는다. */
  const uploadedRef = useRef<{ requestId: string; url: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  const vp = useVisualViewport();
  const draft = state.draft;
  const youtubeId = extractYouTubeId(youtubeUrl);
  const langOptions = user.isTeacher ? user.teacherLangs : Object.keys(LANGUAGES);
  const busy = state.phase === "sending";
  const done = state.phase === "published" || state.phase === "awaitingReview" || state.phase === "sentUnconfirmed";

  useEffect(() => {
    // StrictMode 는 effect 를 mount→cleanup→mount 로 두 번 돌린다. 여기서
    // 되살리지 않으면 첫 cleanup 이 aliveRef 를 영구히 false 로 만들어, 이후
    // 모든 서버 응답이 조용히 버려진다 (실측에서 '보내는 중'에 멈춤).
    aliveRef.current = true;
    setMounted(true);
    return () => { aliveRef.current = false; };
  }, []);

  // ── 초안(localStorage) ──
  useEffect(() => {
    if (!draftKey) { setDraftLoaded(true); return; }
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { text?: string; youtubeUrl?: string };
        if (parsed.text && parsed.text.trim()) setHasDraft(true);
      }
    } catch { /* ignore */ }
    setDraftLoaded(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftLoaded || hasDraft) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (draft.text.trim() || youtubeUrl.trim()) {
        localStorage.setItem(draftKey, JSON.stringify({ text: draft.text, youtubeUrl }));
      }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft.text, youtubeUrl, draftKey, draftLoaded, hasDraft]);

  function clearStoredDraft() {
    if (!draftKey) return;
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }

  function restoreDraft() {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { text?: string; youtubeUrl?: string };
        if (parsed.text) { setText(parsed.text); setScreen("editor"); setMode("text"); }
        if (parsed.youtubeUrl) { setYoutubeUrl(parsed.youtubeUrl); setMode("youtube"); setScreen("editor"); }
      }
    } catch { /* ignore */ }
    setHasDraft(false);
  }

  // ── 초안 편집 ──
  function setText(next: string) {
    dispatch({ type: "edit", patch: { kind: "text", text: next, mediaRef: null } });
    setBlockHint(null);
  }
  function setWriteLang(next: string) {
    dispatch({ type: "edit", patch: { writeLang: next } });
  }
  function applyHint(key: string | null) {
    const prev = hintKey ? rawT(hintKey, draft.writeLang) : "";
    const rest = prev && draft.text.startsWith(prev) ? draft.text.slice(prev.length) : draft.text;
    const next = key ? rawT(key, draft.writeLang) : "";
    setHintKey(key);
    setText(next + rest);
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  }

  // ── 모드 전환 ──
  function goMode(next: ModalMode, opts?: { record?: boolean }) {
    setMode(next);
    setScreen("editor");
    setBlockHint(null);
    if (next === "text") {
      dispatch({ type: "edit", patch: { kind: "text", mediaRef: null } });
      if (opts?.record) setTimeout(() => { void startRecording(); }, 120);
      else setTimeout(() => textareaRef.current?.focus(), 80);
    }
    if (next === "youtube") dispatch({ type: "edit", patch: { kind: "youtube", mediaRef: youtubeId } });
    if (next === "image") dispatch({ type: "edit", patch: { kind: "image", mediaRef: compressedBlob ? "photo" : null } });
    if (next === "drawing") dispatch({ type: "edit", patch: { kind: "drawing", mediaRef: drawingDataUrl } });
  }

  // ── 녹음 ──
  function micUsable(): boolean {
    if (typeof window === "undefined") return false;
    if (typeof MediaRecorder === "undefined") return false;
    return !!navigator.mediaDevices?.getUserMedia;
  }

  function fallbackToWriting(message: string) {
    setMicBlocked(true);
    setIsRecording(false);
    setNotice(`${message} · ${t("postSwitchedToText", lang)}`);
    setMode("text");
    setScreen("editor");
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  async function startRecording() {
    if (isRecording || isTranscribing) return;
    if (!micUsable()) { fallbackToWriting(t("postMicUnavailable", lang)); return; }
    setNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.onstop = async () => {
        audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
        audioStreamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        if (!aliveRef.current) return;
        if (blob.size < 1000) return;
        await transcribeBlob(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecSecs(0);
      setIsRecording(true);
    } catch (err) {
      console.error("mic error:", err);
      fallbackToWriting(t("micDenied", lang));
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setIsRecording(false);
  }

  async function transcribeBlob(blob: Blob) {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `voice.${ext}`);
      fd.append("lang", draft.writeLang);
      const res = await fetch("/api/stt", { method: "POST", body: fd });
      if (!res.ok) throw new Error("STT failed");
      const data = (await res.json()) as { text?: string };
      const text = (data.text || "").trim();
      if (!aliveRef.current) return;
      if (text) {
        const cur = stateRef.current.draft.text;
        setText(cur ? `${cur} ${text}` : text);
      }
    } catch (err) {
      console.error("transcribe error:", err);
      if (aliveRef.current) setNotice(t("sttFailed", lang));
    }
    if (aliveRef.current) setIsTranscribing(false);
  }

  // 녹음 시간 표시 + 안전 상한
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setRecSecs((s) => {
        const next = s + 1;
        if (next * 1000 >= MAX_RECORD_MS) stopRecording();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  // 모달이 사라지면 백그라운드 녹음도 끝난다.
  useEffect(() => {
    return () => {
      audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* ignore */ } }
    };
  }, []);

  function closeModal() {
    stopRecording();
    audioStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    audioStreamRef.current = null;
    onClose();
  }

  // ── 사진 ──
  async function handleImageSelect(file: File) {
    setImageOrigSize(file.size);
    setImagePreview(URL.createObjectURL(file));
    setCompressing(true);
    setCompressedBlob(null);
    setCompressedSize(0);
    let blob: Blob = file;
    try {
      blob = await compressToUnder1MB(file);
      setImagePreview(URL.createObjectURL(blob));
    } catch { /* 원본으로 진행 */ }
    if (!aliveRef.current) return;
    setCompressedBlob(blob);
    setCompressedSize(blob.size);
    setCompressing(false);
    dispatch({ type: "edit", patch: { kind: "image", mediaRef: `photo_${file.name}_${blob.size}` } });
  }

  // ── 전송 ──
  function whyBlocked(): string | null {
    const block = submitBlock(stateRef.current);
    if (block === "inFlight") return t("postBusyWait", lang);
    if (block === "settled") return t("postDoneAlready", lang);
    if (block === "empty") {
      if (draft.kind === "image") return t("postNeedPhoto", lang);
      if (draft.kind === "drawing") return t("postNeedDraw", lang);
      if (draft.kind === "youtube") return t("postNeedVideo", lang);
      return t("postNeedText", lang);
    }
    if (compressing) return t("compressing", lang);
    return null;
  }

  function goPreview() {
    const why = whyBlocked();
    if (why) { setBlockHint(why); return; }
    setBlockHint(null);
    dispatch({ type: "preview" });
  }

  async function runSubmit() {
    const cur = stateRef.current;
    const why = whyBlocked();
    if (why) { setBlockHint(why); return; }
    if (cur.phase !== "preview" && cur.phase !== "failed" && cur.phase !== "sentUnconfirmed") return;

    // 재시도는 첫 전송과 같은 id 를 다시 보낸다.
    const requestId = cur.clientRequestId ?? createClientRequestId();
    dispatch({ type: "submit", requestId, approval: shouldPend });

    const statusField: { status?: CardStatus; authorClientId?: string } = shouldPend
      ? { status: "pending" as CardStatus, authorClientId: myClientId || "" }
      : {};

    try {
      // 새로 고른 사진/그림이 있을 때만 올린다. 수정 모드에서 사진을 그대로
      // 두면 imageUrl 을 보내지 않고 부모가 기존 값을 유지한다.
      const newBlobSource =
        cur.draft.kind === "image" && compressedBlob ? "image" :
        cur.draft.kind === "drawing" && drawingDataUrl ? "drawing" : null;
      let imageUrl: string | undefined;
      if (newBlobSource) {
        if (uploadedRef.current?.requestId === requestId) {
          imageUrl = uploadedRef.current.url;
        } else {
          const blob = newBlobSource === "image"
            ? compressedBlob!
            : await compressToUnder1MB(dataUrlToBlob(drawingDataUrl!));
          imageUrl = await uploadToServer(blob);
          uploadedRef.current = { requestId, url: imageUrl };
        }
      }

      const payload: PostSubmitPayload = {
        cardType: cur.draft.kind as CardType,
        text: cur.draft.kind === "text" ? cur.draft.text : (isEdit ? cur.draft.text : ""),
        writeLang: cur.draft.writeLang,
        ...(imageUrl ? { imageUrl } : {}),
        ...(cur.draft.kind === "youtube" && youtubeId ? { youtubeId } : {}),
        ...statusField,
        clientRequestId: requestId,
      };

      const outcome = await Promise.resolve(onPost(payload));
      if (!aliveRef.current) return;
      if (outcome && typeof outcome === "object" && typeof outcome.ok === "boolean") {
        if (outcome.ok) {
          clearStoredDraft();
          dispatch({ type: "serverAccepted", requestId, approval: shouldPend });
        } else {
          dispatch({ type: "serverRejected", requestId, error: outcome.error ?? "server" });
        }
        return;
      }
      // 부모가 결과를 알려주지 않았다. 서버 저장 완료로 승격하지 않는다 (POST-02).
      clearStoredDraft();
      dispatch({ type: "serverUnknown", requestId });
    } catch (err) {
      console.error("게시 실패:", err);
      if (!aliveRef.current) return;
      dispatch({ type: "serverRejected", requestId, error: "network" });
    }
  }

  /** 활동지 경로는 자체 확인 화면을 가진다 — 같은 전송 계약으로 흘려보낸다. */
  async function submitPrepared(content: PostDraftContent, extra: { imageUrl?: string }) {
    const requestId = createClientRequestId();
    dispatch({ type: "reset", draft: content });
    dispatch({ type: "preview" });
    dispatch({ type: "submit", requestId, approval: shouldPend });
    const statusField: { status?: CardStatus; authorClientId?: string } = shouldPend
      ? { status: "pending" as CardStatus, authorClientId: myClientId || "" }
      : {};
    try {
      const outcome = await Promise.resolve(onPost({
        cardType: content.kind as CardType,
        text: content.text,
        writeLang: content.writeLang,
        ...(extra.imageUrl ? { imageUrl: extra.imageUrl } : {}),
        ...statusField,
        clientRequestId: requestId,
      }));
      if (!aliveRef.current) return;
      if (outcome && typeof outcome === "object" && typeof outcome.ok === "boolean") {
        if (outcome.ok) dispatch({ type: "serverAccepted", requestId, approval: shouldPend });
        else dispatch({ type: "serverRejected", requestId, error: outcome.error ?? "server" });
        return;
      }
      dispatch({ type: "serverUnknown", requestId });
    } catch (err) {
      console.error("활동지 게시 실패:", err);
      if (aliveRef.current) dispatch({ type: "serverRejected", requestId, error: "network" });
    }
  }

  /** 조합 중 Enter/Ctrl+Enter 는 확정용이다 — 전송으로 쓰지 않는다 (IME-01). */
  function onComposeKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key !== "Enter") return;
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    goPreview();
  }

  function onEscape(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); closeModal(); }
  }

  if (!mounted) return null;

  const stepNum = done ? 3 : state.phase === "preview" || busy ? 2 : 1;

  const content = (
    <div
      className="pm-overlay"
      data-ux-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-modal-title"
      style={{ top: vp.offsetTop, height: vp.height ? `${vp.height}px` : undefined }}
      onKeyDown={onEscape}
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <ScopedStyle css={PM_CSS} />
      <div className="pm-sheet" data-ux-surface="panel">

        <div className="pm-head">
          <div className="pm-head-text">
            <h2 id="post-modal-title" data-ux-role="title" className="pm-title">
              {isEdit ? t("editCard", lang) : t("postAskWhat", lang)}
            </h2>
            <p data-ux-role="secondary" className="pm-col">{colTitle}</p>
          </div>
          <button type="button" data-ux-role="control" className="pm-quiet" onClick={closeModal}>
            <span aria-hidden>✕</span> {t("postCloseLabel", lang)}
          </button>
        </div>

        {/* 지금 어디쯤인지 — 작성 → 확인 → 올리기 */}
        {!isEdit && (
          <ol className="pm-steps">
            {[t("postStepWrite", lang), t("postStepPreview", lang), t("postStepSend", lang)].map((label, i) => (
              <li key={label} className={i + 1 <= stepNum ? "pm-step on" : "pm-step"}>
                <span data-ux-role="secondary">{label}</span>
              </li>
            ))}
          </ol>
        )}

        {/* 안내 · 초안 복원 · 실패 — 아이 탓으로 쓰지 않는다 */}
        {notice && (
          <p data-ux-role="body" className="pm-notice" role="status">{notice}</p>
        )}
        {hasDraft && !isEdit && (
          <div className="pm-banner">
            <span data-ux-role="body">💾 {t("draftRestore", lang)}</span>
            <div className="pm-banner-acts">
              <button type="button" data-ux-role="control" className="pm-secondary" onClick={restoreDraft}>
                {t("postKeepWriting", lang)}
              </button>
              <button type="button" data-ux-role="control" className="pm-quiet" onClick={() => { clearStoredDraft(); setHasDraft(false); }}>
                {t("draftDiscard", lang)}
              </button>
            </div>
          </div>
        )}
        {state.phase === "failed" && (
          <div className="pm-banner error" role="alert">
            <span data-ux-role="body">{t("postFailedKeep", lang)}</span>
            <div className="pm-banner-acts">
              <button type="button" data-ux-role="action" className="pm-primary" onClick={() => { void runSubmit(); }}>
                {t("postRetrySame", lang)}
              </button>
            </div>
          </div>
        )}

        {/* ── 결과: 로컬 에코와 서버 확정을 섞지 않는다 ── */}
        {done ? (
          <div className="pm-result" role="status">
            <p data-ux-role="body-emphasis" className="pm-result-head">
              {state.phase === "awaitingReview"
                ? `🕒 ${t("postAwaitTeacher", lang)}`
                : state.phase === "published"
                  ? `🐝 ${t("postPublished", lang)}`
                  : `📨 ${t("postSentUnconfirmed", lang)}`}
            </p>
            {state.phase === "awaitingReview" && (
              <p data-ux-role="body" className="pm-result-sub">{t("postAwaitTeacherSub", lang)}</p>
            )}
            <blockquote data-ux-role="body" data-ux-reading className="pm-quote" lang={draft.writeLang}>
              {draft.text || (draft.kind === "image" ? t("postPhotoReady", lang) : draft.kind === "drawing" ? t("postDrawReady", lang) : youtubeUrl)}
            </blockquote>
            <button type="button" data-ux-role="action" className="pm-primary pm-wide" onClick={closeModal}>
              {t("postSeeBoard", lang)}
            </button>
          </div>
        ) : state.phase === "preview" || busy ? (
          /* ── 미리보기 / 보내는 중 ── */
          <div className="pm-preview">
            <p data-ux-role="body-emphasis" className="pm-preview-title">{t("postPreviewTitle", lang)}</p>
            <div className="pm-card" data-ux-surface>
              <p data-ux-role="secondary">{user.myName} · {LANGUAGES[draft.writeLang]?.label}</p>
              {imagePreview && draft.kind === "image" && (
                <img src={imagePreview} alt="" className="pm-media" />
              )}
              {drawingDataUrl && draft.kind === "drawing" && (
                <img src={drawingDataUrl} alt="" className="pm-media" />
              )}
              {draft.kind === "youtube" && youtubeId && (
                <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} alt="" className="pm-media" />
              )}
              {draft.text && (
                <p data-ux-role="body" data-ux-reading className="pm-quote" lang={draft.writeLang}>{draft.text}</p>
              )}
            </div>
            {shouldPend && (
              <p data-ux-role="secondary" className="pm-pend-note">🕒 {t("postAwaitTeacherSub", lang)}</p>
            )}
            <div className="pm-actions">
              <button
                type="button"
                data-ux-role="control"
                className="pm-secondary"
                aria-disabled={busy}
                onClick={() => { if (busy) { setBlockHint(t("postBusyWait", lang)); return; } dispatch({ type: "back" }); }}
              >{t("postBackToWrite", lang)}</button>
              <button
                type="button"
                data-ux-role="action"
                className="pm-primary"
                aria-disabled={busy || posting}
                aria-busy={busy}
                onClick={() => { void runSubmit(); }}
              >{busy ? `⟳ ${t("postSendingNow", lang)}` : isEdit ? t("editCard", lang) : `🐝 ${t("postSend", lang)}`}</button>
            </div>
            {blockHint && <p data-ux-role="body" className="pm-blockhint" role="status">{blockHint}</p>}
          </div>
        ) : screen === "ways" ? (
          /* ── 첫 선택: 글 · 말 · 그림/사진 ── */
          <div className="pm-ways">
            <div className="pm-way-grid">
              {[
                { key: "write", icon: "✏️", label: t("postWayWrite", lang), sub: t("postWayWriteSub", lang), go: () => goMode("text") },
                { key: "speak", icon: "🎤", label: t("postWaySpeak", lang), sub: t("postWaySpeakSub", lang), go: () => goMode("text", { record: true }) },
                { key: "pic", icon: "🎨", label: t("postWayPicture", lang), sub: t("postWayPictureSub", lang), go: () => setScreen("pictureWays") },
              ].map((w) => (
                <button key={w.key} type="button" data-ux-role="control" className="pm-way" onClick={w.go}>
                  <span aria-hidden className="pm-way-icon">{w.icon}</span>
                  <span className="pm-way-text">
                    <span data-ux-role="body-emphasis" className="pm-way-label">{w.label}</span>
                    <span data-ux-role="secondary">{w.sub}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* 기존 기능은 지우지 않고 상세 선택으로 남는다 */}
            <p data-ux-role="label" className="pm-more-head">{t("postMoreWays", lang)}</p>
            <div className="pm-more">
              <button type="button" data-ux-role="control" className="pm-secondary" onClick={() => goMode("analyze")}>
                <span aria-hidden>📸</span> {t("postWorksheetShot", lang)}
              </button>
              <button type="button" data-ux-role="control" className="pm-secondary" onClick={() => goMode("worksheet")}>
                <span aria-hidden>📋</span> {t("postWorksheetTrans", lang)}
              </button>
              <button type="button" data-ux-role="control" className="pm-secondary" onClick={() => goMode("youtube")}>
                <span aria-hidden>📺</span> {t("postVideoLink", lang)}
              </button>
            </div>
          </div>
        ) : screen === "pictureWays" ? (
          /* ── 상세 선택: 사진 · 그림 ── */
          <div className="pm-ways">
            <p data-ux-role="body-emphasis" className="pm-sub">{t("postPickPicture", lang)}</p>
            <div className="pm-way-grid">
              <button type="button" data-ux-role="control" className="pm-way" onClick={() => goMode("image")}>
                <span aria-hidden className="pm-way-icon">📷</span>
                <span className="pm-way-text"><span data-ux-role="body-emphasis" className="pm-way-label">{t("postChoosePhoto", lang)}</span></span>
              </button>
              <button type="button" data-ux-role="control" className="pm-way" onClick={() => goMode("drawing")}>
                <span aria-hidden className="pm-way-icon">🖍️</span>
                <span className="pm-way-text"><span data-ux-role="body-emphasis" className="pm-way-label">{t("postDrawPicture", lang)}</span></span>
              </button>
            </div>
            <button type="button" data-ux-role="control" className="pm-quiet" onClick={() => setScreen("ways")}>
              <span aria-hidden>←</span> {t("postBackLabel", lang)}
            </button>
          </div>
        ) : (
          /* ── 편집기 ── */
          <div className="pm-editor">
            {!isEdit && (
              <button type="button" data-ux-role="control" className="pm-quiet pm-back" onClick={() => setScreen("ways")}>
                <span aria-hidden>←</span> {t("postBackLabel", lang)}
              </button>
            )}

            {mode === "text" && (
              <>
                <div className="pm-langs" role="group" aria-label={t("writingLang", lang)}>
                  <span data-ux-role="label" className="pm-langs-head">{t("writingLang", lang)}</span>
                  {langOptions.map((l) => (
                    <button
                      key={l}
                      type="button"
                      data-ux-role="control"
                      className={draft.writeLang === l ? "pm-chip on" : "pm-chip"}
                      aria-pressed={draft.writeLang === l}
                      onClick={() => setWriteLang(l)}
                    >
                      <span aria-hidden>{LANGUAGES[l]?.flag}</span>
                      <span lang={l}>{LANGUAGES[l]?.label}</span>
                    </button>
                  ))}
                </div>

                {/* 말로 하기 — 시간과 멈추기를 분명히 */}
                {micBlocked ? (
                  <p data-ux-role="body" className="pm-notice" role="status">{t("postMicUnavailable", lang)}</p>
                ) : (
                  <div className="pm-rec">
                    <button
                      type="button"
                      data-ux-role="action"
                      className={isRecording ? "pm-primary pm-rec-on" : "pm-secondary"}
                      aria-pressed={isRecording}
                      aria-disabled={isTranscribing}
                      onClick={() => {
                        if (isTranscribing) { setBlockHint(t("transcribing", lang)); return; }
                        if (isRecording) stopRecording(); else void startRecording();
                      }}
                    >
                      {isRecording
                        ? `⏹ ${t("postRecordStop", lang)}`
                        : isTranscribing
                          ? t("transcribing", lang)
                          : `🎤 ${t("postRecordStart", lang)}`}
                    </button>
                    {isRecording && (
                      <p data-ux-role="body" className="pm-rec-time" role="status">
                        ● {t("postRecordGoing", lang)} {String(Math.floor(recSecs / 60)).padStart(2, "0")}:{String(recSecs % 60).padStart(2, "0")}
                      </p>
                    )}
                  </div>
                )}

                {/* 문장 시작 힌트 — 선택형. 원치 않으면 빈 글쓰기 그대로. */}
                <div className="pm-hints" role="group" aria-label={t("postHintTitle", lang)}>
                  <span data-ux-role="label" className="pm-hints-head">{t("postHintTitle", lang)}</span>
                  {HINTS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      data-ux-role="control"
                      className={hintKey === k ? "pm-chip on" : "pm-chip"}
                      aria-pressed={hintKey === k}
                      onClick={() => applyHint(hintKey === k ? null : k)}
                    >{t(HINT_LABEL[k], lang)}</button>
                  ))}
                  <button
                    type="button"
                    data-ux-role="control"
                    className={hintKey === null ? "pm-chip on" : "pm-chip"}
                    aria-pressed={hintKey === null}
                    onClick={() => applyHint(null)}
                  >{t("postHintNone", lang)}</button>
                </div>

                <label data-ux-role="label" className="pm-label" htmlFor="pm-text">{t("postYourStory", lang)}</label>
                <textarea
                  id="pm-text"
                  ref={textareaRef}
                  data-ux-role="body"
                  className="pm-textarea"
                  value={draft.text}
                  lang={draft.writeLang}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onComposeKeyDown}
                  placeholder={t("postWriteHere", lang)}
                  rows={5}
                />
              </>
            )}

            {mode === "image" && (
              <div className="pm-pick">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="pm-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageSelect(f); }}
                />
                {!imagePreview ? (
                  <button type="button" data-ux-role="control" className="pm-drop" onClick={() => fileInputRef.current?.click()}>
                    <span aria-hidden className="pm-way-icon">🖼️</span>
                    <span data-ux-role="body-emphasis">{t("selectPhoto", lang)}</span>
                  </button>
                ) : (
                  <>
                    <img src={imagePreview} alt="" className="pm-media" />
                    <p data-ux-role="secondary" className="pm-size">
                      {compressing
                        ? t("compressing", lang)
                        : compressedSize > 0 && imageOrigSize > 0
                          ? `🗜 ${fmtBytes(imageOrigSize)} → ${fmtBytes(compressedSize)}`
                          : ""}
                    </p>
                    <button
                      type="button"
                      data-ux-role="control"
                      className="pm-secondary"
                      onClick={() => {
                        setImagePreview(null); setCompressedBlob(null); setCompressedSize(0); setImageOrigSize(0);
                        dispatch({ type: "edit", patch: { kind: "image", mediaRef: null } });
                        if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
                      }}
                    >{t("postChoosePhoto", lang)}</button>
                  </>
                )}
              </div>
            )}

            {mode === "youtube" && (
              <div className="pm-pick">
                <label data-ux-role="label" className="pm-label" htmlFor="pm-yt">{t("postVideoLink", lang)}</label>
                <input
                  id="pm-yt"
                  type="url"
                  className="pm-input"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    dispatch({ type: "edit", patch: { kind: "youtube", mediaRef: extractYouTubeId(e.target.value) } });
                  }}
                  onKeyDown={onComposeKeyDown}
                  placeholder="https://youtu.be/..."
                />
                {youtubeId && (
                  <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} alt="" className="pm-media" />
                )}
              </div>
            )}

            {mode === "drawing" && (
              <div className="pm-pick">
                <DrawBoard
                  width={720}
                  height={480}
                  accent={colColor || "#F59E0B"}
                  onChange={(url) => {
                    setDrawingDataUrl(url);
                    dispatch({ type: "edit", patch: { kind: "drawing", mediaRef: url ? "drawing" : null } });
                  }}
                />
              </div>
            )}

            {mode === "worksheet" && !isEdit && (
              <WorksheetTab
                userLang={lang}
                onPostText={(text, postLang) => {
                  void submitPrepared({ kind: "text", text, writeLang: postLang, mediaRef: null }, {});
                }}
                onPostWorksheetImage={async (blob, _originalText, translatedText, postLang) => {
                  try {
                    const imageUrl = await uploadToServer(blob);
                    await submitPrepared({ kind: "image", text: translatedText, writeLang: postLang, mediaRef: imageUrl }, { imageUrl });
                  } catch (err) {
                    console.error("활동지 이미지 업로드 실패:", err);
                    await submitPrepared({ kind: "text", text: translatedText, writeLang: postLang, mediaRef: null }, {});
                  }
                }}
                onClose={closeModal}
              />
            )}

            {mode === "analyze" && !isEdit && (
              <WorksheetAnalyzeView
                submitLabel={t("postSend", lang)}
                requireConfirm={true}
                onComplete={async ({ content: ocrText, previewUrl }) => {
                  try {
                    const compressed = await compressToUnder1MB(dataUrlToBlob(previewUrl));
                    const imageUrl = await uploadToServer(compressed);
                    await submitPrepared({ kind: "image", text: ocrText, writeLang: draft.writeLang, mediaRef: imageUrl }, { imageUrl });
                  } catch (err) {
                    console.error("활동지 이미지 업로드 실패 → 텍스트 카드로 폴백:", err);
                    await submitPrepared({ kind: "text", text: ocrText, writeLang: draft.writeLang, mediaRef: null }, {});
                  }
                }}
              />
            )}

            {/* 다음 단계 — 미리보기로 */}
            {mode !== "worksheet" && mode !== "analyze" && (
              <>
                {blockHint && <p data-ux-role="body" className="pm-blockhint" role="status">{blockHint}</p>}
                <button
                  type="button"
                  data-ux-role="action"
                  className="pm-primary pm-wide"
                  aria-disabled={!!whyBlocked()}
                  onClick={goPreview}
                >{t("postPreviewGo", lang)}</button>
                {mode === "text" && (
                  <p data-ux-role="secondary" className="pm-kbd">Ctrl + Enter</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // 화면 본체와 data-ux-root 가 겹치지 않게 body 로 띄운다.
  return createPortal(content, document.body);
}

/* ── 작성 모달 전용 규칙 ─────────────────────────────────────────────
   글자 크기는 전부 토큰이다. 시트 안을 100vh 로 잠그지 않고 오버레이가
   스크롤한다 — 키보드가 올라와도 입력과 올리기 버튼에 스크롤로 닿는다.
   높이는 visualViewport 로 실제 보이는 만큼만 잡는다(README §6.3). */
const PM_CSS = `
.pm-overlay{
  position: fixed; left: 0; right: 0; top: 0;
  height: 100dvh;
  z-index: 400;
  background: rgba(41, 37, 31, .55);
  display: flex; justify-content: center;
  overflow-y: auto; overscroll-behavior: contain;
  padding: var(--ux-space-8) 0 0;
}
.pm-sheet{
  /* align-items:flex-end 는 넘치는 내용의 위쪽을 잘라 스크롤로 닿을 수 없게
     만든다. auto 마진으로 아래에 붙이면 넘칠 때 위쪽이 살아 있다. */
  margin-top: auto;
  width: 100%; max-width: 560px;
  background: var(--ux-surface);
  border-radius: var(--ux-radius-panel) var(--ux-radius-panel) 0 0;
  padding: var(--ux-space-4) var(--ux-space-4)
           calc(var(--ux-space-8) + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -10px 30px rgba(137,83,0,.24);
  display: grid; gap: var(--ux-space-4);
  align-content: start;
}
.pm-head{ display: flex; align-items: flex-start; gap: var(--ux-space-3); }
.pm-head-text{ flex: 1; min-width: 0; display: grid; gap: var(--ux-space-1); }
.pm-title{ color: var(--ux-ink); font-weight: 900; word-break: keep-all; overflow-wrap: anywhere; }
.pm-col{ overflow-wrap: anywhere; }
.pm-sub{ margin: 0; color: var(--ux-ink); font-weight: 800; word-break: keep-all; }

.pm-steps{ display: flex; gap: var(--ux-space-2); list-style: none; margin: 0; padding: 0; }
.pm-step{
  flex: 1; text-align: center; min-width: 0;
  border-top: 6px solid var(--ux-surface-sunk);
  padding-top: var(--ux-space-2);
}
.pm-step.on{ border-top-color: var(--ux-primary-border); }
.pm-step span{ overflow-wrap: anywhere; }

.pm-notice, .pm-blockhint{
  margin: 0; color: var(--ux-ink); font-weight: 700; word-break: keep-all;
  background: var(--ux-surface-sunk);
  border: 2px dashed var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
}
.pm-banner{
  display: grid; gap: var(--ux-space-3);
  background: var(--ux-surface-sunk);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
}
.pm-banner.error{ border-color: var(--ux-error); }
.pm-banner.error span{ color: var(--ux-error); font-weight: 800; }
.pm-banner-acts{ display: flex; flex-wrap: wrap; gap: var(--ux-space-3); }
.pm-banner span{ word-break: keep-all; overflow-wrap: anywhere; }

.pm-way-grid{ display: grid; grid-template-columns: 1fr; gap: var(--ux-space-3); }
@media (min-width: 600px){ .pm-way-grid{ grid-template-columns: 1fr 1fr; } }
.pm-way{
  display: flex; align-items: center; gap: var(--ux-space-3); width: 100%;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); text-align: left; font-family: inherit;
}
.pm-way-icon{ font-size: 2rem; line-height: 1; flex-shrink: 0; }
.pm-way-text{ display: grid; gap: 2px; min-width: 0; flex: 1; }
.pm-way-label{ font-weight: 800; word-break: keep-all; overflow-wrap: anywhere; }
.pm-ways{ display: grid; gap: var(--ux-space-3); }
.pm-more-head{ margin: 0; color: var(--ux-ink-soft); font-weight: 800; }
.pm-more{ display: flex; flex-wrap: wrap; gap: var(--ux-space-3); }
.pm-more > button{ flex: 1 1 14ch; }

.pm-editor{ display: grid; gap: var(--ux-space-3); }
.pm-back{ justify-self: start; }
.pm-langs, .pm-hints{ display: flex; flex-wrap: wrap; gap: var(--ux-space-2); align-items: center; }
.pm-langs-head, .pm-hints-head{ width: 100%; color: var(--ux-ink-soft); font-weight: 800; }
.pm-chip{
  display: inline-flex; align-items: center; gap: var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 700; word-break: keep-all; overflow-wrap: anywhere;
}
.pm-chip.on{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }

.pm-rec{ display: grid; gap: var(--ux-space-2); }
.pm-rec > button{ width: 100%; }
.pm-rec-on{ border-color: var(--ux-error); }
.pm-rec-time{ margin: 0; color: var(--ux-error); font-weight: 800; }

.pm-label{ color: var(--ux-ink); font-weight: 800; }
.pm-textarea, .pm-input{
  width: 100%; box-sizing: border-box; font-family: inherit;
  font-size: var(--ux-font-body); line-height: var(--ux-lh-reading);
  font-weight: 600; color: var(--ux-ink); background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-4);
  min-height: var(--ux-action-min); resize: vertical;
}
.pm-textarea:focus, .pm-input:focus{ border-color: var(--ux-selected-border); }
.pm-kbd{ margin: 0; text-align: right; }

.pm-pick{ display: grid; gap: var(--ux-space-3); justify-items: stretch; }
.pm-file{ display: none; }
.pm-drop{
  display: flex; flex-direction: column; align-items: center; gap: var(--ux-space-2);
  width: 100%; min-height: 120px; font-family: inherit;
  background: var(--ux-surface-sunk); color: var(--ux-ink);
  border: 3px dashed var(--ux-primary-border);
}
.pm-media{ width: 100%; max-height: 260px; object-fit: contain; border-radius: var(--ux-radius-surface); background: var(--ux-surface-sunk); }
.pm-size{ margin: 0; }

.pm-preview, .pm-result{ display: grid; gap: var(--ux-space-3); }
.pm-preview-title, .pm-result-head{ margin: 0; color: var(--ux-ink); font-weight: 800; word-break: keep-all; overflow-wrap: anywhere; }
.pm-result-sub{ margin: 0; color: var(--ux-ink-soft); word-break: keep-all; }
.pm-card{
  display: grid; gap: var(--ux-space-2);
  background: var(--ux-surface-sunk);
  border: 2px solid var(--ux-primary-border);
  padding: var(--ux-space-3);
}
.pm-quote{ margin: 0; white-space: pre-wrap; word-break: keep-all; overflow-wrap: anywhere; }
.pm-pend-note{ margin: 0; }
.pm-actions{ display: flex; flex-wrap: wrap; gap: var(--ux-space-3); }
.pm-actions > button{ flex: 1 1 12ch; }

.pm-primary{
  font-family: inherit; font-weight: 900;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  word-break: keep-all; overflow-wrap: anywhere;
}
.pm-secondary{
  font-family: inherit; font-weight: 800;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
  word-break: keep-all; overflow-wrap: anywhere;
}
.pm-quiet{
  font-family: inherit; font-weight: 800;
  background: transparent; color: var(--ux-ink-soft);
  border: 2px solid transparent;
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
  flex-shrink: 0;
}
.pm-wide{ width: 100%; }
/* 아직 누를 수 없는 상태도 읽히게 둔다. 회색 위 회색 글자를 쓰지 않는다. */
.pm-primary[aria-disabled="true"], .pm-secondary[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border: 2px dashed var(--ux-ink-soft);
}

@media (min-width: 700px){
  .pm-overlay{ padding: var(--ux-space-8) var(--ux-space-4); }
  .pm-sheet{ margin: auto; border-radius: var(--ux-radius-panel); padding: var(--ux-space-6); }
}
`;
