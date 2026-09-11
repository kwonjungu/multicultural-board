# Claude Opus 병렬 실행 지침

## 1. 그대로 전달할 총괄 프롬프트

```text
너는 multicultural-board 아동 친화 개편의 총괄 Claude Opus다.
docs/child-ux-20260911/{README.md,HARNESS.md,tasks.json,VALIDATION.md}와
저장소 CLAUDE.md, 적용되는 AGENTS.md를 먼저 읽어라.
설계 기준 SHA는 ee898b008d51415aa94640341287a9720567da68이다.
현재 HEAD가 다르면 관련 파일 diff를 확인하고 진단 항목을 재검증하라.

목표: 시작 UI부터 큰 글씨·명확한 행동·다국어·안정된 합성/게임으로 상용 수준 개편.
이번 패키지에 구현된 WordMemory 수정은 유지하고 통합 검증하라.
운영 1111에는 테스트 쓰기/시딩/초기화하지 마라. 실제 방 명단을 fixture로 복제하지 마라.

tasks.json의 dependsOn 순서와 소유 파일을 엄수하라.
먼저 A가 공통 토큰/인터페이스 계약을 확정하고 별도 커밋을 만든다.
그 커밋 기준으로 B 시작화면, C 소통창, D 합성, F 게임을 분리된 worktree에 할당한다.
동시 실행 슬롯이 부족하면 B/D/F를 먼저 실행하고 빈 슬롯에 C를 배정한다.
E의 씬 기반 작업은 A 이후 가능하나 캐릭터 연결은 D render plan 계약 완료 이후 진행한다.
Q는 시작부터 독립 fixture/테스트를 만들되 구현자 소유 파일을 수정하지 않는다.

하위 모델에는 tasks.json의 작업을 그대로 통째로 넘기지 말고 아래 작은 작업 단위로 잘라라.
각 작업은 파일 최대 3개 또는 UI 상태 한 묶음, 인수 조건 최대 5개다.
추가 파일/공통 계약 수정은 총괄에게 변경 요청으로 제출한다.
임의 any/ts-ignore/테스트 삭제/스냅샷 일괄 갱신/기준치 하향으로 통과시키지 마라.

각 담당자는 재현→실패 테스트→최소 수정→재검증→시각/증거 순서로 작업한다.
모든 테스트 명령의 cwd, exitCode, stdout 로그, 커밋 SHA를 제출한다.
실행하지 못한 테스트는 blocked로 기록하고 완료라고 하지 마라.
실패 2회면 원인과 축소 재현을 총괄에 넘기고, 같은 수정을 무한 반복하지 마라.
Q의 독립 검증이 없으면 머지 완료로 표시하지 마라.
배포/DB 마이그레이션/유료 자산 생성은 구현 완료와 별개 단계로 다룬다.

첫 시각 산출물은 B 시작 화면의 360px/768px/1280px 및 큰 글씨 상태다.
README의 수치와 정보 순서를 기준으로 승인한 뒤 다른 화면에 같은 언어를 확장한다.
마지막에는 기능별 변경·실행 검사·미검증·스크린샷·롤백 경로를 보고하라.
```

## 2. 파일 소유권과 병합

| 작업 | 담당/작업 범위 | 동시에 편집하면 안 되는 파일 |
|---|---|---|
| A | 디자인 시스템·공통 계약 | app/layout.tsx, package.json/lock, lib/types.ts, i18n 공통 파일, GameRoom 셸 최종 연결 |
| B | SetupScreen, HomeHub, BeeBanner, FlyingBees | A 파일은 계약만 요청 |
| C | PadletBoard, PadletCard, PostModal, TutorChat | Firebase/번역/보상 함수 변경은 총괄 경유 |
| D | CharacterComposite, PraiseHive, CosmeticPicker, render plan/manifest | BeeVillage/VillageMap3D는 E 소유 |
| E | BeeVillage, VillageMap3D, village renderer | D manifest/plan을 소비만 함 |
| F | components/games/**, 게임 순수 로직 | GameRoom 공통 셸은 총괄에 patch 전달 |
| Q | tests/**, reports/**, 검증 전용 scripts | 제품 코드 수정 금지; 재현/실패 보고 |

공통 파일이 필요하면 `CHANGE-REQUEST`를 제출한다: 변경 이유, 기존 계약, 새 계약, 소비자, 마이그레이션/회귀 항목. 총괄이 작은 계약 커밋으로 먼저 병합하고 담당 worktree가 그 커밋을 반영한다. 파일 충돌을 마지막에 한꺼번에 해결하지 않는다.

독립 브랜치는 같은 기반 커밋에서 만든다. 예시:

```powershell
git worktree add ../bee-entry -b ux/entry <contract-commit>
git worktree add ../bee-board -b ux/board <contract-commit>
git worktree add ../bee-character -b ux/character <contract-commit>
git worktree add ../bee-games -b ux/games <contract-commit>
```

서버 포트와 report 디렉터리도 작업별 분리한다. 통합은 공통 계약→시작 화면→소통창/게임→합성→3D→통합 QA 순서. 각 병합 후 관련 테스트만 실행하고, 마지막에 전체 빌드·핵심 플로를 실행한다. Q는 구현 커밋을 지정해 검증한다. 검증 후 코드가 바뀌면 영향받은 검사를 다시 실행한다.

## 3. 작은 모델용 작업 패킷

```text
TASK_ID: B-02
읽을 파일: README §4~5, SetupScreen.tsx, A의 토큰/버튼 계약
수정 가능: components/SetupScreen.tsx + 전용 style 파일
목표: 360px/큰 글씨에서 언어 선택 및 다음 버튼이 잘리지 않는 입장 단계.
유지할 것: onDone 타입, roomCode 전달, rosterMode, teacherPin 처리.
입력 fixture: 15개 언어, 긴 이름, 연결 실패, 방 번호가 이미 있는 직접 URL.
인수 조건:
1) 본문 20px 상당 이상, label 18px 상당 이상, 선택 버튼 최소 높이 56px
2) 200% 확대에서 모든 내용/동작 접근 가능
3) 선택 상태를 aria-pressed+체크로 표현
4) Enter/키보드/뒤로에서 선택 값 유지
5) A 공유 파일을 직접 수정하지 않음
실행 검사: 타입 검사 + 입장 fixture E2E + 3개 viewport 스크린샷
제출: 변경 파일/정확한 명령과 exit code/스크린샷/남은 항목
```

| 작은 작업 | 입력 → 출력 | 독립 완료 기준 |
|---|---|---|
| A-01 | inline style 조사 → 토큰/CSS 변수 | 대표 버튼/본문/긴 문장 샘플에서 계산값 일치 |
| A-02 | 기존 설정 → 글자크기/reduced-motion 연결 | 새로고침·방 이동에서 설정 유지, 이중 확대 없음 |
| B-01 | 루트/방 진입 → 오류/로딩 상태 | 방 없는 경우 재시도 가능 |
| B-02 | 언어 선택 → 큰 글씨 레이아웃 | 위 패킷 5개 조건 |
| B-03 | 명렬표/허브 → 탐색 카드 | 40명/5개 활동/수업 우선순위 유지 |
| C-01 | 모바일 컬럼 → 주제 선택+1열 보기 | 컬럼/카드 ID/순서 데이터 유지 |
| C-02 | PadletCard → 읽기/번역/듣기 상태 | 긴 본문/번역 실패/음성 중지 |
| C-03 | PostModal → 초안/저장 상태 | 실패 후 내용 유지, 중복 게시 없음 |
| C-04 | TutorChat → IME/abort/스트림 처리 | 조합 Enter 무전송, 오래된 응답 무시 |
| D-01 | PNG/앵커 → inventory/manifest | 파일/크기/hash/좌표 유효성 |
| D-02 | manifest → 순수 render plan | contain 고정 정답/폴백 순서/접점 테스트 |
| D-03 | plan → DOM 렌더 | preview와 실제 화면 동일, 6개 승인판 |
| E-01 | 현행 씬 → 접지/선택/2D 대체 | context loss에서도 선택 가능 |
| E-02 | D plan → 3D texture adapter | 같은 꾸미기 동일 자산/누락 슬롯 0 |
| F-01 | 기억 카드 수정 → UI lifecycle 테스트 | unmount/language switch 타이머·오디오 정리 |
| F-02 | 금칙어 재현 → deadline/reducer | 만료/연타 중복 점수 없음 |
| F-03 | 숫자/카페/윷/마블 → 경계 테스트 | 각 게임 별 독립 패킷으로 재분할 |
| Q-01 | fixture/계약 → 필수 체크 | live DB 없이 결정적 실행 |

## 4. 결과 보고 규격

```json
{
  "taskId": "B",
  "commit": "40-character-commit-sha",
  "status": "ready-for-review",
  "changedFiles": ["components/SetupScreen.tsx"],
  "checks": [{"id":"ENTRY-01","status":"pass","command":"...","exitCode":0,"evidence":"reports/B/entry.log"}],
  "screenshots": ["reports/B/setup-360-default.png"],
  "risks": [],
  "unverified": [],
  "reviewer": ""
}
```

`ready-for-review`는 출시 완료가 아니다. Q/총괄은 증거 파일을 읽고 해당 커밋을 직접 확인한 뒤 accept한다. 실행 로그 없는 pass, 동일 모델의 자기 칭찬만 있는 시각 점수, fixture 없이 운영 캡처만 있는 증거는 반려한다.

## 5. 중단/회복 규칙

외부 서비스가 없으면 해당 네트워크 테스트는 emulator/명시적 mock으로 진행하고, 실제 서비스 통합은 미검증으로 남긴다. 이미지가 없으면 승인 전 placeholder를 쓰고 ‘최종 시각 완료’로 표시하지 않는다. 테스트 flaky는 재실행 결과를 숨기지 말고 seed/시계/폰트/환경을 고정해 원인을 줄인다. 기준 커밋 이동 시 관련 진단과 fixture를 다시 맞춘다.

예상 분량은 A 1~2일, B/C 각각 2~3일, D 3~5일, E 2~4일, F 3~5일, Q 통합 2~3일이다. 사람 기준의 초기 계획값이며 실제 소요는 자산 상태와 발견 오류에 따라 조정한다. 병렬 실행으로 QA와 공통 계약 단계까지 사라지는 것으로 계산하지 않는다.
