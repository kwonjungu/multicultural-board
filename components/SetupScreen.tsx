"use client";

import { useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { UserConfig, RoomConfig } from "@/lib/types";
import { t, tFmt } from "@/lib/i18n";
import { landmarkFor } from "@/lib/assets";
import {
  ANIMALS, animalAssetPath, animalLabel, fallbackAnimal, isAnimalId, type AnimalId,
} from "@/lib/animals";
import FlyingBees from "./ui/FlyingBees";
import BeeBanner from "./BeeBanner";
import SpeakButton from "./ui/SpeakButton";
import ScopedStyle from "./ui/child/ScopedStyle";
import AnimalArt from "./ui/child/AnimalArt";

interface Props {
  onDone: (config: UserConfig) => void;
  roomCode: string;
  availableLangs: string[];
  roomConfig: RoomConfig;
}

/**
 * 입장 단계. 학생 기본 흐름은 '편한 말을 골라요 → 내 이름을 골라요' 둘뿐이고,
 * 선생님 입장은 보조 링크로 빠진다(README §5.1). 방 번호는 이미 URL 에 있으므로
 * 다시 묻지 않는다.
 *
 * onDone payload · roomCode · rosterMode · teacherPin 처리는 종전 계약 그대로다.
 */
type Step = "lang" | "name" | "animal" | "teacher";

export default function SetupScreen({ onDone, roomCode, availableLangs, roomConfig }: Props) {
  const [step, setStep] = useState<Step>("lang");
  const [myLang, setMyLang] = useState<string>(() =>
    availableLangs.includes("ko") ? "ko" : availableLangs[0] ?? "ko"
  );
  const [teacherCode, setTeacherCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [myName, setMyName] = useState("");
  /** U05 — 이번 입장에서 고른 동물. null 이면 아직 안 골랐다(저장된 값/폴백을 쓴다). */
  const [animalId, setAnimalId] = useState<AnimalId | null>(null);
  /** 아무것도 안 고르고 입장을 누른 아이에게 다음 할 일을 알려준다. 비난하지 않는다. */
  const [needName, setNeedName] = useState(false);
  /** CTA 연타로 onDone 이 두 번 나가지 않게 한다 (ENTRY-02). */
  const submitted = useRef(false);

  const rosterList: string[] = Array.isArray(roomConfig.roster)
    ? roomConfig.roster
    : roomConfig.roster ? Object.values(roomConfig.roster as unknown as Record<string, string>) : [];
  /** 명단이 있으면 고르게 한다 — 종전 동작 유지(rosterMode 가 꺼져 있어도 명단 우선). */
  const showRoster = rosterList.length > 0;
  /** 자유 입력 허용 여부는 방 설정을 따른다. */
  const showFreeInput = !showRoster && !roomConfig.rosterMode;
  /** 명렬표 방인데 명단이 비어 있으면 아이가 스스로 할 수 있는 일이 없다. */
  const rosterEmpty = !showRoster && Boolean(roomConfig.rosterMode);

  /**
   * U05 — 고른 이름이 활성 프로필 **정확히 하나**와 맞을 때만 learnerId 를 정한다.
   * 동명이인이면 이름만으로 누구인지 가를 수 없으므로 비운다. 자동으로 한 명에게
   * 줘 버리는 것이 가장 되돌리기 어려운 사고다(lib/learnerId.ts 의 ambiguous 와 같은 원칙).
   */
  const learners = roomConfig.learners ?? {};
  function learnerIdForName(name: string): string | undefined {
    const hit = Object.values(learners).filter(
      (p) => p && p.rosterStatus === "active" && p.displayName === name,
    );
    return hit.length === 1 ? hit[0].learnerId : undefined;
  }

  const myLearnerId = myName.trim() ? learnerIdForName(myName.trim()) : undefined;
  /** 이미 저장된 선택. 있으면 재입장 때 동물 단계를 강제로 반복하지 않는다. */
  const savedAnimal = myLearnerId
    ? (isAnimalId(learners[myLearnerId]?.avatarAnimalId) ? (learners[myLearnerId]!.avatarAnimalId as AnimalId) : null)
    : null;
  /** 아직 안 골랐을 때 화면에 보일 결정적 폴백 — 렌더마다 바뀌지 않는다. */
  const previewAnimal: AnimalId =
    animalId ?? savedAnimal ?? fallbackAnimal(roomCode, myLearnerId || myName.trim() || roomCode);

  function finishStudent(pickedAnimal?: AnimalId | null) {
    if (submitted.current) return;
    if (!myName.trim()) { setNeedName(true); return; }
    submitted.current = true;
    const chosen = pickedAnimal ?? animalId ?? savedAnimal ?? undefined;
    onDone({
      myLang,
      myName: myName.trim(),
      isTeacher: false,
      teacherLangs: [],
      ...(myLearnerId ? { learnerId: myLearnerId } : {}),
      ...(chosen ? { animalId: chosen } : {}),
    });
  }

  /** 이름 단계의 다음 행동. 이미 고른 동물이 있으면 바로 들어간다. */
  function afterName() {
    if (!myName.trim()) { setNeedName(true); return; }
    if (savedAnimal) { finishStudent(savedAnimal); return; }
    setStep("animal");
  }

  function finishTeacher() {
    if (submitted.current) return;
    // 교사 암호: 관리 패널에서 바꾼 teacherPin 이 있으면 그것, 없으면 방 번호.
    const expected = roomConfig.teacherPin || roomCode;
    if (teacherCode !== expected) { setCodeError(true); return; }
    submitted.current = true;
    onDone({ myLang, myName: "선생님", isTeacher: true, teacherLangs: availableLangs });
  }

  /** 한국어·일본어·중국어 조합 중 Enter 는 확정용이다 — 전송으로 쓰지 않는다. */
  const enterUnlessComposing = (run: () => void) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    run();
  };

  /** 학생 흐름은 편한 말 → 이름 → 내 동물 3단계. 교사 경로는 이 표시를 쓰지 않는다. */
  const totalSteps = 3;
  const stepNum = step === "lang" ? 1 : step === "name" ? 2 : 3;
  const greeting = LANGUAGES[myLang]?.greet || "안녕!";

  return (
    <div data-ux-root className="setup-root">
      <ScopedStyle css={SETUP_CSS} />
      <div aria-hidden="true" className="setup-backdrop" />
      <FlyingBees />

      <div className="setup-shell">
        <div className="setup-hero">
          <BeeBanner />
          <img src="/mascot/bee-welcome.png" alt="" aria-hidden="true" className="setup-hero-bee" />
        </div>

        <main className="setup-panel" data-ux-surface="panel">
          {/* 단계 표시 + 방 번호. 방 번호는 알림용이며 다시 입력받지 않는다. */}
          <div className="setup-head">
            {step !== "lang" && (
              <button
                type="button"
                data-ux-role="control"
                className="setup-back"
                onClick={() => {
                  // 한 단계씩 돌아간다. 동물에서 뒤로 가면 고르던 값은 버린다.
                  if (step === "animal") { setAnimalId(null); setStep("name"); return; }
                  setStep("lang"); setNeedName(false); setCodeError(false);
                }}
              >
                <span aria-hidden>←</span>
                <span className="setup-back-label">{t("backBtn", myLang).replace("← ", "")}</span>
              </button>
            )}
            <div className="setup-progress">
              <span data-ux-role="secondary">{tFmt("stepOfN", myLang, { n: stepNum, total: totalSteps })}</span>
              <div className="setup-bars" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <span key={i} className={i <= stepNum ? "setup-bar on" : "setup-bar"} />
                ))}
              </div>
            </div>
            <div className="setup-room">
              <span aria-hidden>🚪</span>
              <span data-ux-role="label" className="setup-room-code">{roomCode}</span>
            </div>
          </div>

          {/* ── 1단계: 편한 말 고르기 ───────────────────────────── */}
          {step === "lang" && (
            <>
              <h1 data-ux-role="title" className="setup-title">{t("langStepTitle", myLang)}</h1>
              <p className="setup-greet">
                <span data-ux-role="body-emphasis" lang={myLang}>{greeting} 👋</span>
                <SpeakButton text={greeting} lang={myLang} label="인사말 듣기" />
              </p>

              <div className="setup-choices" role="group" aria-label={t("langStepTitle", myLang)}>
                {availableLangs.map((code) => {
                  const info = LANGUAGES[code];
                  if (!info) return null;
                  const active = myLang === code;
                  const landmark = landmarkFor(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      data-ux-role="control"
                      className={active ? "setup-choice on" : "setup-choice"}
                      aria-pressed={active}
                      onClick={() => setMyLang(code)}
                    >
                      {landmark
                        ? <img src={landmark} alt="" aria-hidden="true" className="setup-choice-art" />
                        : <span aria-hidden className="setup-choice-flag">{info.flag}</span>}
                      <span className="setup-choice-text">
                        {/* 언어는 자국어 이름으로 고른다. 국기는 보조 장식일 뿐 국적 선택이 아니다. */}
                        <span data-ux-role="label" lang={code} className="setup-choice-name">{info.label}</span>
                        {info.romanized && (
                          <span data-ux-role="secondary" className="setup-choice-roman">{info.romanized}</span>
                        )}
                      </span>
                      {/* 색만으로 선택을 알리지 않는다 */}
                      <span aria-hidden className="setup-check">{active ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-ux-role="action"
                className="setup-cta"
                onClick={() => { setStep("name"); setNeedName(false); }}
              >{t("nextBtn", myLang)}</button>

              {/* 선생님 입장은 아이의 기본 흐름에서 비켜난 보조 링크다. */}
              <button
                type="button"
                data-ux-role="control"
                className="setup-teacher-link"
                onClick={() => { setStep("teacher"); setCodeError(false); }}
              >{t("enterAsTeacher", myLang)}</button>
            </>
          )}

          {/* ── 2단계: 내 이름 고르기 ──────────────────────────── */}
          {step === "name" && (
            <>
              <h1 data-ux-role="title" className="setup-title">{t("nameStepTitle", myLang)}</h1>
              <p data-ux-role="body" className="setup-sub">{t("nameStepSub", myLang)}</p>

              {rosterEmpty && (
                <p data-ux-role="body" className="setup-notice" role="status">
                  {t("noRoster", myLang)}<br />{t("noRosterSub", myLang)}
                </p>
              )}

              {showRoster ? (
                <>
                  <p data-ux-role="secondary" className="setup-hint">
                    {t("classmatesHint", myLang)} ({rosterList.length})
                  </p>
                  <div className="setup-choices" role="group" aria-label={t("nameStepTitle", myLang)}>
                    {rosterList.map((name) => {
                      const active = myName === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          data-ux-role="control"
                          className={active ? "setup-choice name on" : "setup-choice name"}
                          aria-pressed={active}
                          onClick={() => { setMyName(name); setNeedName(false); }}
                        >
                          {/* 긴 이름도 가로로 잘리지 않고 두 줄로 내려온다 */}
                          <span data-ux-role="body-emphasis" className="setup-choice-name wrap">{name}</span>
                          <span aria-hidden className="setup-check">{active ? "✓" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : showFreeInput ? (
                <>
                  <label data-ux-role="label" className="setup-label" htmlFor="setup-name">
                    {t("nameStepTitle", myLang)}
                  </label>
                  <input
                    id="setup-name"
                    className="setup-input"
                    value={myName}
                    onChange={(e) => { setMyName(e.target.value); setNeedName(false); }}
                    onKeyDown={enterUnlessComposing(finishStudent)}
                    placeholder={t("enterName", myLang)}
                    autoFocus
                  />
                </>
              ) : null}

              {needName && (
                <p data-ux-role="body" className="setup-needname" role="alert">
                  {showRoster ? t("classmatesHint", myLang) : t("enterName", myLang)}
                </p>
              )}

              <button
                type="button"
                data-ux-role="action"
                className="setup-cta"
                aria-disabled={!myName.trim() || rosterEmpty}
                onClick={afterName}
              >{savedAnimal ? t("enterAsStudent", myLang) : t("nextBtn", myLang)}</button>

              {/* 이미 고른 동물이 있으면 단계를 반복하지 않고, 바꾸고 싶을 때만 들어간다. */}
              {savedAnimal && (
                <p className="setup-mine">
                  <span aria-hidden className="setup-mine-ico">{ANIMALS.find((a) => a.id === savedAnimal)?.emoji}</span>
                  <span data-ux-role="secondary">
                    {t("animalMine", myLang)}: {animalLabel(savedAnimal)}
                  </span>
                  <button
                    type="button"
                    data-ux-role="control"
                    className="setup-teacher-link"
                    onClick={() => setStep("animal")}
                  >{t("animalChange", myLang)}</button>
                </p>
              )}
            </>
          )}

          {/* ── 3단계: 내 동물 고르기 (U05) ─────────────────────
              언어 카드와 **같은 컴포넌트**(.setup-choice)를 쓴다. 이 앱에서 가장
              잘 된 선택 UI 라 새 체계를 만들 이유가 없다 — 그림 + 이름 +
              굵은 테두리와 체크(색 아닌 단서)가 이미 갖춰져 있다. */}
          {step === "animal" && (
            <>
              <h1 data-ux-role="title" className="setup-title">{t("animalStepTitle", myLang)}</h1>
              <p data-ux-role="body" className="setup-sub">{t("animalStepSub", myLang)}</p>

              {/* 미리보기 — 지금 무엇이 골라져 있는지 한 곳에서 크게 보인다. */}
              <p className="setup-preview">
                <AnimalArt id={previewAnimal} size={72} />
                <span data-ux-role="body-emphasis">{animalLabel(previewAnimal)}</span>
              </p>

              <div className="setup-choices animals" role="group" aria-label={t("animalStepTitle", myLang)}>
                {ANIMALS.map((a) => {
                  const active = previewAnimal === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      data-ux-role="control"
                      className={active ? "setup-choice on" : "setup-choice"}
                      aria-pressed={active}
                      onClick={() => setAnimalId(a.id)}
                    >
                      <AnimalArt id={a.id} size={44} />
                      <span className="setup-choice-text">
                        <span data-ux-role="label" className="setup-choice-name">{a.ko}</span>
                      </span>
                      <span aria-hidden className="setup-check">{active ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>

              {/* 저장할 프로필이 없으면 성공한 것처럼 보이게 두지 않는다. */}
              {!myLearnerId && (
                <p data-ux-role="secondary" className="setup-hint" role="status">
                  {t("animalSessionOnly", myLang)}
                </p>
              )}

              <button
                type="button"
                data-ux-role="action"
                className="setup-cta"
                onClick={() => finishStudent(previewAnimal)}
              >{t("enterAsStudent", myLang)}</button>

              {/* 취소하면 원래 선택으로 돌아간다 — 고르다 만 값이 남지 않는다. */}
              <button
                type="button"
                data-ux-role="control"
                className="setup-teacher-link"
                onClick={() => { setAnimalId(null); setStep("name"); }}
              >{t("backBtn", myLang).replace("← ", "")}</button>
            </>
          )}

          {/* ── 보조: 선생님 입장 ─────────────────────────────── */}
          {step === "teacher" && (
            <>
              <h1 data-ux-role="title" className="setup-title">{t("roleTeacher", myLang)}</h1>
              <p data-ux-role="body" className="setup-sub">{t("roleTeacherDesc", myLang)}</p>

              <label data-ux-role="label" className="setup-label" htmlFor="setup-pin">
                {t("teacherCodeLabel", myLang)}
              </label>
              <input
                id="setup-pin"
                className="setup-input pin"
                type="password"
                inputMode="numeric"
                value={teacherCode}
                onChange={(e) => { setTeacherCode(e.target.value); setCodeError(false); }}
                onKeyDown={enterUnlessComposing(finishTeacher)}
                placeholder="○○○○"
                maxLength={8}
                autoFocus
                aria-invalid={codeError}
                aria-describedby={codeError ? "setup-pin-error" : undefined}
              />
              {codeError && (
                <p id="setup-pin-error" data-ux-role="body" className="setup-needname" role="alert">
                  {t("teacherCodeError", myLang)}
                </p>
              )}

              <button
                type="button"
                data-ux-role="action"
                className="setup-cta"
                aria-disabled={teacherCode.length === 0}
                onClick={finishTeacher}
              >{t("enterAsTeacher", myLang)}</button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── 입장 화면 전용 규칙 ───────────────────────────────────────────
   크기·색은 전부 토큰에서 온다. 여기서 px 글자 크기를 새로 만들지 않는다.
   목록을 내부 스크롤 상자에 가두지 않고 문서가 스크롤하게 둔다 — 모바일
   키보드가 올라와도 입력과 CTA 가 스크롤로 닿는다(README §5.1). */
const SETUP_CSS = `
.setup-root{
  position: relative;
  min-height: 100svh;
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-12);
  background: var(--ux-bg);
  display: flex; justify-content: center;
}
.setup-backdrop{
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: url('/landing/landing-bees.webp') center / cover no-repeat;
  opacity: .35;
}
.setup-shell{ position: relative; z-index: 1; width: 100%; max-width: 560px; align-self: center; }
.setup-hero{ text-align: center; }
.setup-hero-bee{ width: 72px; height: 72px; object-fit: contain; }
.setup-panel{
  background: var(--ux-surface);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-6) var(--ux-space-4);
  box-shadow: 0 10px 30px rgba(137,83,0,.14);
  display: grid; gap: var(--ux-space-4);
}
.setup-head{ display: flex; align-items: center; gap: var(--ux-space-3); }
.setup-back{
  display: inline-flex; align-items: center; gap: var(--ux-space-2); flex-shrink: 0;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 700;
}
.setup-progress{ flex: 1; min-width: 0; display: grid; gap: var(--ux-space-1); }
.setup-bars{ display: flex; gap: 4px; }
.setup-bar{ flex: 1; height: 8px; border-radius: var(--ux-radius-pill); background: var(--ux-surface-sunk); }
.setup-bar.on{ background: var(--ux-primary-border); }
.setup-room{
  display: inline-flex; align-items: center; gap: var(--ux-space-2); flex-shrink: 0;
  background: var(--ux-surface-sunk); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill); padding: var(--ux-space-2) var(--ux-space-3);
}
.setup-room-code{ font-weight: 900; letter-spacing: .1em; }
.setup-title{ color: var(--ux-ink); font-weight: 900; text-align: center; word-break: keep-all; overflow-wrap: anywhere; }
.setup-greet{
  margin: 0; display: flex; align-items: center; justify-content: center;
  gap: var(--ux-space-3); flex-wrap: wrap;
}
.setup-sub{ margin: 0; color: var(--ux-ink-soft); text-align: center; word-break: keep-all; }
.setup-hint{ margin: 0; font-weight: 700; }
.setup-label{ font-weight: 800; color: var(--ux-ink); }

/* 한 화면에 한 열. 넓어지면 두 열까지만 — 세 열은 이름이 잘린다. */
.setup-choices{ display: grid; grid-template-columns: 1fr; gap: var(--ux-space-3); }
@media (min-width: 600px){ .setup-choices{ grid-template-columns: 1fr 1fr; } }

/* ── 내 동물 (U05) ──────────────────────────────────────────────────
   동물은 언어보다 라벨이 짧아 같은 2열이면 카드가 과하게 넓어진다.
   04 §5 "동물 선택은 세로 2~3열, 가로 4열". 8종을 보려고 페이지가 길어지지
   않게 한다. */
@media (min-width: 600px){ .setup-choices.animals{ grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 900px){ .setup-choices.animals{ grid-template-columns: repeat(4, 1fr); } }
/* 동물 카드는 그림 위·이름 아래로 쌓는다. 언어 카드처럼 가로로 늘어놓으면
   라벨이 좁은 칸에서 짜부라진다(4열이면 카드가 ~119px 뿐이다). */
.setup-choices.animals .setup-choice{
  flex-direction: column; gap: var(--ux-space-2); text-align: center;
  justify-content: center; position: relative;
}
.setup-choices.animals .setup-choice-text{ min-width: 0; }
.setup-choices.animals .setup-choice-name{ white-space: nowrap; }
/* 체크는 카드 모서리로 — 세로 배치에서 이름 아래 한 줄을 더 먹지 않게 한다. */
.setup-choices.animals .setup-check{ position: absolute; top: 6px; right: 10px; }
.setup-preview{
  display: flex; flex-direction: column; align-items: center; gap: var(--ux-space-2);
  margin: 0 0 var(--ux-space-4);
}
.setup-mine{
  display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap;
  justify-content: center; margin: var(--ux-space-3) 0 0;
}
.setup-mine-ico{ font-size: 1.4em; line-height: 1; }

.setup-choice{
  display: flex; align-items: center; gap: var(--ux-space-3); width: 100%;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); text-align: left; font-family: inherit;
}
.setup-choice.on{ border: 3px solid var(--ux-selected-border); background: var(--ux-surface-sunk); }
.setup-choice.name{ justify-content: space-between; min-width: 0; }
.setup-choice-art{ width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }
.setup-choice-flag{ font-size: 2rem; line-height: 1; flex-shrink: 0; }
.setup-choice-text{ display: grid; gap: 2px; min-width: 0; flex: 1; }
.setup-choice-name{ font-weight: 800; }
.setup-choice-name.wrap{
  white-space: normal;
  /* keep-all 은 어절을 지키지만, 공백 없는 긴 이름은 한 어절이라 넘친다.
     360px 큰 글씨에서 실제로 29px 가로 overflow 가 났다 — anywhere 로 받는다. */
  word-break: keep-all; overflow-wrap: anywhere; min-width: 0;
}
.setup-choice-roman{ color: var(--ux-ink-soft); }
.setup-check{ width: 1.5em; text-align: center; font-weight: 900; color: var(--ux-selected-border); flex-shrink: 0; }

.setup-input{
  width: 100%; min-height: var(--ux-action-min);
  font-family: inherit; font-size: var(--ux-font-body-emphasis); font-weight: 700;
  color: var(--ux-ink); background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3) var(--ux-space-4); box-sizing: border-box;
}
.setup-input:focus{ border-color: var(--ux-selected-border); outline-offset: 1px; }
.setup-input.pin{ text-align: center; letter-spacing: .4em; }

.setup-cta{
  width: 100%; font-family: inherit; font-weight: 900;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
}
/* 아직 누를 수 없는 상태도 읽히게 둔다. 회색 위 회색 글자는 쓰지 않는다. */
.setup-cta[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border: 2px dashed var(--ux-ink-soft);
}
.setup-teacher-link{
  justify-self: center; background: transparent; border: 2px solid transparent;
  color: var(--ux-ink-soft); font-family: inherit; font-weight: 700; text-decoration: underline;
}
.setup-notice, .setup-needname{
  margin: 0; color: var(--ux-error); font-weight: 700; text-align: center; word-break: keep-all;
}
.setup-notice{
  background: var(--ux-surface-sunk); border: 2px dashed var(--ux-error);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-3);
}

/* 넓은 화면: 환영 일러스트 40% / 입장 패널 60%, 패널은 560px 을 넘지 않는다. */
@media (min-width: 1024px){
  .setup-shell{
    max-width: 1040px;
    display: grid; grid-template-columns: 40% 60%;
    align-items: center; gap: var(--ux-space-8);
  }
  .setup-hero-bee{ width: 180px; height: 180px; }
  .setup-panel{ max-width: 560px; padding: var(--ux-space-8) var(--ux-space-6); }
}
`;
