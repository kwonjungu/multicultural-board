"use client";

import { useCallback, useMemo, useState } from "react";
import { RosterManager } from "@/components/RoomManagePanel";
import ScopedStyle from "@/components/ui/child/ScopedStyle";
import ChildText from "@/components/ui/child/ChildText";
import {
  createRosterService, promoteNamesToProfiles,
  type RosterIo, type RosterOp,
} from "@/lib/rosterArchive";
import {
  domainPrefix, encodeLegacyKey, type LearnerProfile,
} from "@/lib/learnerId";

const ROOM = "9999";

/**
 * 고정 입력. 실명 금지 — 전부 가짜다.
 * 검수 대상을 일부러 섞었다: 동명이인 2명, 아주 긴 이름, 라틴/태국/아랍 문자,
 * 이미 보관된 2명.
 */
const ACTIVE_NAMES = [
  "가나다", "라마바", "김민준", "김민준",
  "사아자", "차카타",
  "아주아주긴이름을가진학생사례",
  "Nguyễn Thị Minh Khai",
  "มานีมีตากลมโต",
  "سارة",
];
const ARCHIVED_NAMES = ["전학간친구", "박서준"];

/** 결정적 id — 스크린샷이 실행마다 흔들리지 않게. */
function seedUuid() {
  let n = 0;
  return () => `fixture-${String(++n).padStart(4, "0")}`;
}

function seedProfiles(): LearnerProfile[] {
  const uuid = seedUuid();
  const active = promoteNamesToProfiles(ACTIVE_NAMES, 1_700_000_000_000, uuid);
  const archived = promoteNamesToProfiles(ARCHIVED_NAMES, 1_700_000_000_000, uuid).map((p) => ({
    ...p, rosterStatus: "archived" as const, archivedAt: 1_700_000_100_000,
  }));
  // 표식 예시 — 동명이인 구별용. 국적·피부색이 아니라 사물/자연물.
  active[2] = { ...active[2], markId: "star" };
  active[3] = { ...active[3], markId: "apple" };
  return [...active, ...archived];
}

/** 메모리 저장소. DB 는 어디에도 없다. */
function seedStore(profiles: LearnerProfile[]): Map<string, unknown> {
  const store = new Map<string, unknown>();
  let seed = 11;
  const rnd = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (const p of profiles) {
    const key = encodeLegacyKey(p.displayName);
    const put = (domain: Parameters<typeof domainPrefix>[1], value: unknown) => {
      store.set(`${domainPrefix(ROOM, domain)}/${key}`, value);
    };
    put("stickers", Object.fromEntries(
      Array.from({ length: 1 + rnd(5) }, (_, i) => [`s${i}`, { id: `s${i}`, type: "star", ts: 1000 + i }]),
    ));
    put("cosmetics", { stage: "bee", hat: rnd(2) ? "party" : null });
    put("vocabProgress", Object.fromEntries(
      Array.from({ length: 1 + rnd(6) }, (_, i) => [`w${i}`, { doneSentences: [0], listenCount: i, lastStudied: 2000 + i }]),
    ));
    if (rnd(2)) {
      put("vocabRecordings", Object.fromEntries(
        Array.from({ length: 1 + rnd(3) }, (_, i) => [`w${i}_0`, { audioUrl: `x://${key}/${i}`, duration: 3 }]),
      ));
    }
    put("lms", { xp: 40 * (1 + rnd(6)), hearts: 5, lessons: {} });
  }
  return store;
}

const FIXTURE_CSS = `
.rxf-root{ min-height:100svh; background:var(--ux-bg); color:var(--ux-ink);
  padding:var(--ux-space-4); display:grid; gap:var(--ux-space-4); align-content:start; }
@media (min-width:1024px){ .rxf-root{ padding:var(--ux-space-6) var(--ux-space-8); } }
.rxf-head{ display:grid; gap:var(--ux-space-2); }
`;

export default function RosterFixture() {
  const [profiles, setProfiles] = useState<LearnerProfile[]>(seedProfiles);
  const store = useMemo(() => seedStore(seedProfiles()), []);

  const io: RosterIo = useMemo(() => ({
    async readNode(path: string) { return store.get(path) ?? null; },
    async commitRoster() { /* 메모리 fixture — 저장할 곳이 없다 */ },
    async deleteNodes(paths: string[]) { for (const p of paths) store.delete(p); },
  }), [store]);

  const service = useMemo(() => createRosterService(ROOM, io, { now: () => 1_700_000_200_000 }), [io]);

  const loadImpacts = useCallback(
    (ids: string[]) => service.loadImpacts(profiles, ids),
    [service, profiles],
  );

  const onApply = useCallback(async (ops: RosterOp[], opts?: { allowPurge?: boolean }) => {
    const res = await service.apply(profiles, ops, opts);
    setProfiles(res.profiles);
    return { warnings: res.warnings };
  }, [service, profiles]);

  return (
    <div data-ux-root className="rxf-root">
      <ScopedStyle css={FIXTURE_CSS} />
      <div className="rxf-head">
        <ChildText role="title" as="h1">교실 관리 · 명렬표</ChildText>
        <ChildText role="secondary" as="p">
          검수용 화면입니다. 여기의 이름과 기록은 모두 가짜이고 실제 교실 자료와 이어져 있지 않아요.
        </ChildText>
      </div>
      <RosterManager
        lang="ko"
        profiles={profiles}
        needsPromotion
        seedText={profiles.filter((p) => p.rosterStatus === "active").map((p) => p.displayName).join("\n")}
        loadImpacts={loadImpacts}
        onApply={onApply}
      />
    </div>
  );
}
