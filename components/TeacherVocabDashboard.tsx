"use client";

import { useEffect, useMemo, useState } from "react";
import { VOCAB_WORDS } from "@/lib/vocabWords";
import {
  subscribeClassSnapshot,
  rollupStudent,
  rollupAllWords,
  rollupFormats,
  rollupSubcategories,
  type ClassSnapshot,
  type ClassStudent,
} from "@/lib/vocabAggregates";
import { FORMAT_LABEL, FORMAT_ICON, type QuizFormat } from "@/lib/quizFormats";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

type Tab = "class" | "student" | "word" | "format" | "category";

interface Props {
  roomCode: string;
  onBack: () => void;
}

export default function TeacherVocabDashboard({ roomCode, onBack }: Props) {
  const [snap, setSnap] = useState<ClassSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("class");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeClassSnapshot(roomCode, setSnap);
    return unsub;
  }, [roomCode]);

  const rollups = useMemo(() => {
    if (!snap) return null;
    return {
      students: snap.students.map(rollupStudent),
      words: rollupAllWords(snap.students),
      formats: rollupFormats(snap.students),
      subcategories: rollupSubcategories(snap.students),
    };
  }, [snap]);

  if (!snap) {
    return (
      <Shell onBack={onBack}>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6B7280" }}>
          📊 반 데이터 불러오는 중…
        </div>
      </Shell>
    );
  }

  if (snap.students.length === 0) {
    return (
      <Shell onBack={onBack}>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6B7280" }}>
          아직 학습 기록이 없어요. 학생들이 단어를 학습하면 여기에 통계가 나타납니다.
        </div>
      </Shell>
    );
  }

  return (
    <Shell onBack={onBack}>
      <Header total={snap.students.length} />

      <TabBar tab={tab} onChange={setTab} />

      {tab === "class" && rollups && (
        <ClassTab
          rollups={rollups.students}
          onPickStudent={(cid) => { setSelectedStudent(cid); setTab("student"); }}
        />
      )}

      {tab === "student" && rollups && (
        <StudentTab
          students={snap.students}
          rollups={rollups.students}
          selected={selectedStudent}
          onSelect={setSelectedStudent}
        />
      )}

      {tab === "word" && rollups && (
        <WordTab words={rollups.words} />
      )}

      {tab === "format" && rollups && (
        <FormatTab formats={rollups.formats} />
      )}

      {tab === "category" && rollups && (
        <CategoryTab subcategories={rollups.subcategories} />
      )}
    </Shell>
  );
}

// ════════════════════════════════════════
//                  Shell
// ════════════════════════════════════════

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div style={{
      maxWidth: 980, margin: "0 auto", padding: "16px",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button
          onClick={onBack}
          style={{
            background: PURPLE_LIGHT, border: "none", borderRadius: 12,
            padding: "8px 14px", fontSize: 14, fontWeight: 800, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >← 단어 학습으로</button>
        <h2 style={{
          margin: 0, fontSize: 20, fontWeight: 900,
          color: PURPLE_DARK, letterSpacing: -0.3,
        }}>
          👨‍🏫 반 단어 학습 현황
        </h2>
      </div>
      {children}
    </div>
  );
}

function Header({ total }: { total: number }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
      color: "#fff", borderRadius: 16, padding: "14px 18px",
      marginBottom: 14, display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ fontSize: 28 }}>🎓</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>현재 활동 학생</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{total}명</div>
      </div>
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: Array<{ id: Tab; icon: string; label: string }> = [
    { id: "class", icon: "👥", label: "반 전체" },
    { id: "student", icon: "👤", label: "학생별" },
    { id: "word", icon: "📚", label: "단어별" },
    { id: "format", icon: "🎯", label: "포맷별" },
    { id: "category", icon: "🗂️", label: "카테고리별" },
  ];
  return (
    <div style={{
      display: "flex", gap: 4, marginBottom: 16,
      background: "#F3F4F6", padding: 4, borderRadius: 14,
      overflowX: "auto",
    }}>
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              flex: "1 1 auto", minWidth: 92,
              background: active ? "#fff" : "transparent",
              border: active ? `2px solid ${PURPLE}` : "2px solid transparent",
              boxShadow: active ? `0 2px 8px ${PURPLE}33` : "none",
              borderRadius: 10, padding: "8px 6px",
              fontSize: 13, fontWeight: 900,
              color: active ? PURPLE_DARK : "#6B7280",
              cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >{it.icon} {it.label}</button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════
//          탭1: 반 전체 — 학생 리스트
// ════════════════════════════════════════

function ClassTab({
  rollups, onPickStudent,
}: {
  rollups: ReturnType<typeof rollupStudent>[];
  onPickStudent: (clientId: string) => void;
}) {
  const sorted = [...rollups].sort((a, b) => b.lastActivity - a.lastActivity);
  return (
    <div style={{
      background: "#fff", borderRadius: 16, overflow: "hidden",
      border: `2px solid ${PURPLE_LIGHT}`,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr",
        gap: 8, padding: "10px 14px",
        background: PURPLE_LIGHT,
        fontSize: 12, fontWeight: 900, color: PURPLE_DARK,
      }}>
        <div>학생</div>
        <div style={{ textAlign: "right" }}>학습 단어</div>
        <div style={{ textAlign: "right" }}>완전 마스터</div>
        <div style={{ textAlign: "right" }}>예문 완료</div>
        <div style={{ textAlign: "right" }}>정답률</div>
        <div style={{ textAlign: "right" }}>최근 활동</div>
      </div>
      {sorted.map((r) => (
        <button
          key={r.clientId}
          onClick={() => onPickStudent(r.clientId)}
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr",
            gap: 8, padding: "12px 14px",
            background: "#fff", border: "none",
            borderTop: "1px solid #F3F4F6",
            cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "left",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: "#1F2937" }}>{r.name}</div>
          <Cell value={r.wordsStudied} />
          <Cell value={r.wordsMastered} accent={r.wordsMastered > 0 ? "#10B981" : undefined} />
          <Cell value={r.sentencesDone} />
          <Cell value={`${Math.round(r.correctRate * 100)}%`} accent={r.correctRate >= 0.8 ? "#10B981" : r.correctRate < 0.5 && r.attemptCount > 0 ? "#EF4444" : undefined} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textAlign: "right" }}>
            {formatRelative(r.lastActivity)}
          </div>
        </button>
      ))}
    </div>
  );
}

function Cell({ value, accent }: { value: string | number; accent?: string }) {
  return (
    <div style={{
      fontSize: 14, fontWeight: 900, textAlign: "right",
      color: accent ?? "#374151",
    }}>{value}</div>
  );
}

// ════════════════════════════════════════
//           탭2: 학생별 상세
// ════════════════════════════════════════

function StudentTab({
  students, rollups, selected, onSelect,
}: {
  students: ClassStudent[];
  rollups: ReturnType<typeof rollupStudent>[];
  selected: string | null;
  onSelect: (cid: string) => void;
}) {
  const s = selected ? students.find((x) => x.clientId === selected) : students[0];
  const r = selected ? rollups.find((x) => x.clientId === selected) : rollups[0];
  if (!s || !r) return <div style={{ padding: 20, color: "#6B7280" }}>학생을 선택하세요</div>;

  return (
    <div>
      <select
        value={s.clientId}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          width: "100%", padding: "12px 14px", fontSize: 16, fontWeight: 800,
          borderRadius: 12, border: `2px solid ${PURPLE}55`,
          background: "#fff", color: "#1F2937", marginBottom: 12,
          fontFamily: "inherit",
        }}
      >
        {students.map((st) => (
          <option key={st.clientId} value={st.clientId}>{st.name}</option>
        ))}
      </select>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10, marginBottom: 16,
      }}>
        <StatCard label="학습 단어" value={r.wordsStudied} icon="📖" />
        <StatCard label="완전 마스터" value={r.wordsMastered} icon="🏆" />
        <StatCard label="예문 완료" value={r.sentencesDone} icon="✏️" />
        <StatCard label="정답률" value={`${Math.round(r.correctRate * 100)}%`} icon="🎯" />
      </div>

      <Section title="포맷별 성과">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {(Object.keys(r.formatCounts) as QuizFormat[]).map((f) => {
            const v = r.formatCounts[f];
            const rate = v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100);
            return (
              <div key={f} style={{
                background: "#fff", border: `2px solid ${PURPLE}22`,
                borderRadius: 12, padding: "10px 8px", textAlign: "center",
              }}>
                <div style={{ fontSize: 20 }}>{FORMAT_ICON[f]}</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#6B7280", marginTop: 2 }}>{FORMAT_LABEL[f]}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: PURPLE_DARK, marginTop: 4 }}>
                  {v.total > 0 ? `${rate}%` : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{v.correct} / {v.total}</div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="최근 시도 (최대 30개)">
        {s.attempts.length === 0 ? (
          <div style={{ color: "#6B7280", padding: "10px", fontSize: 13 }}>아직 시도가 없어요.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {s.attempts.slice(0, 30).map((a) => (
              <div key={a.id} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto auto",
                gap: 8, alignItems: "center",
                padding: "8px 12px", background: "#fff",
                border: `1px solid ${PURPLE_LIGHT}`, borderRadius: 10,
                fontSize: 13,
              }}>
                <div style={{ fontSize: 16 }}>{FORMAT_ICON[a.format]}</div>
                <div style={{ fontWeight: 800, color: "#1F2937" }}>{a.wordId}</div>
                <div style={{
                  fontSize: 11, fontWeight: 900,
                  color: a.correct ? "#10B981" : "#EF4444",
                  background: a.correct ? "#ECFDF5" : "#FEF2F2",
                  padding: "2px 8px", borderRadius: 999,
                }}>{a.correct ? `✓ ${a.attempts}회` : "✗ 실패"}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{formatRelative(a.ts)}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, #fff, ${PURPLE_LIGHT})`,
      border: `2px solid ${PURPLE}33`,
      borderRadius: 14, padding: "12px 8px", textAlign: "center",
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: PURPLE_DARK, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#FBFAFE", borderRadius: 14, padding: 12,
      marginBottom: 14, border: `1px solid ${PURPLE_LIGHT}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: PURPLE_DARK, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// ════════════════════════════════════════
//             탭3: 단어별 통계
// ════════════════════════════════════════

function WordTab({ words }: { words: ReturnType<typeof rollupAllWords> }) {
  const studied = words.filter((w) => w.studentsStudied > 0);
  // 어려운 단어 (정답률 낮은 순) — 시도 3 이상만 보여줌
  const hard = [...studied]
    .filter((w) => w.attemptCount >= 3)
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 15);

  return (
    <div>
      <Section title="🚨 어려워하는 단어 TOP 15 (시도 ≥ 3)">
        {hard.length === 0 ? (
          <div style={{ color: "#6B7280", fontSize: 13 }}>아직 데이터가 부족해요.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {hard.map((w) => (
              <div key={w.word.id} style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto auto",
                gap: 10, alignItems: "center",
                padding: "10px 12px", background: "#fff",
                border: `1px solid ${PURPLE_LIGHT}`, borderRadius: 10,
              }}>
                <img
                  src={`/vocab-images/icons/${w.word.id}.png`}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6, background: PURPLE_LIGHT }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#1F2937" }}>{w.word.ko}</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>{w.word.subcategory}</div>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 900,
                  color: w.correctRate < 0.4 ? "#EF4444" : "#F59E0B",
                  background: w.correctRate < 0.4 ? "#FEF2F2" : "#FEF3C7",
                  padding: "4px 10px", borderRadius: 999,
                }}>{Math.round(w.correctRate * 100)}%</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{w.attemptCount}회</div>
                {w.weakestFormat && (
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: "#7C2D12",
                    background: "#FED7AA", padding: "3px 8px", borderRadius: 8,
                  }}>약점: {FORMAT_ICON[w.weakestFormat]}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="📊 학습 분포 (학습한 학생 수)">
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 8,
        }}>
          {studied
            .sort((a, b) => b.studentsStudied - a.studentsStudied)
            .slice(0, 40)
            .map((w) => (
              <div key={w.word.id} style={{
                background: "#fff", border: `1px solid ${PURPLE_LIGHT}`,
                borderRadius: 10, padding: 8, textAlign: "center",
              }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#1F2937" }}>{w.word.ko}</div>
                <div style={{
                  marginTop: 4, height: 6, background: PURPLE_LIGHT,
                  borderRadius: 999, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, w.studentsStudied * 20)}%`,
                    background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE_DARK})`,
                  }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginTop: 3 }}>
                  학생 {w.studentsStudied} / 마스터 {w.studentsMastered}
                </div>
              </div>
            ))}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════
//             탭4: 포맷별 통계
// ════════════════════════════════════════

function FormatTab({ formats }: { formats: ReturnType<typeof rollupFormats> }) {
  const maxTotal = Math.max(1, ...formats.map((f) => f.total));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {formats.map((f) => (
        <div key={f.format} style={{
          background: "#fff", border: `2px solid ${PURPLE_LIGHT}`,
          borderRadius: 14, padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
              {FORMAT_ICON[f.format]} {FORMAT_LABEL[f.format]}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 900,
              color: f.rate >= 0.7 ? "#10B981" : f.rate < 0.5 && f.total > 0 ? "#EF4444" : PURPLE_DARK,
            }}>
              {f.total === 0 ? "—" : `${Math.round(f.rate * 100)}%`}
            </div>
          </div>
          <div style={{ height: 10, background: PURPLE_LIGHT, borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
            <div style={{
              height: "100%",
              width: `${Math.round((f.total / maxTotal) * 100)}%`,
              background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE_DARK})`,
            }} />
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 11, fontWeight: 700, color: "#6B7280",
          }}>
            <span>총 시도 {f.total} · 정답 {f.correct}</span>
            {f.avgDurationMs !== undefined && <span>평균 {(f.avgDurationMs / 1000).toFixed(1)}초</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════
//          탭5: 카테고리별 통계
// ════════════════════════════════════════

function CategoryTab({ subcategories }: { subcategories: ReturnType<typeof rollupSubcategories> }) {
  const total = VOCAB_WORDS.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {subcategories.length === 0 && (
        <div style={{ color: "#6B7280", padding: 20, textAlign: "center" }}>
          아직 카테고리별 시도가 없어요.
        </div>
      )}
      {subcategories.map((s) => {
        const wordsInCat = VOCAB_WORDS.filter((w) => w.subcategory === s.subcategory).length;
        return (
          <div key={s.subcategory} style={{
            background: "#fff", border: `2px solid ${PURPLE_LIGHT}`,
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
                🗂️ {s.subcategory}
              </div>
              <div style={{
                fontSize: 18, fontWeight: 900,
                color: s.rate >= 0.7 ? "#10B981" : s.rate < 0.5 ? "#EF4444" : PURPLE_DARK,
              }}>
                {s.total === 0 ? "—" : `${Math.round(s.rate * 100)}%`}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>
              포함 단어 {wordsInCat}개 · 시도 {s.total} · 정답 {s.correct}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 6 }}>
        전체 단어 풀: {total}개
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//                Helpers
// ════════════════════════════════════════

function formatRelative(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}
