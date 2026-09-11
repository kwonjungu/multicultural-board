# 이번 작업 검증 기록

날짜: 2026-09-11. 기준 HEAD: `ee898b008d51415aa94640341287a9720567da68`.
작업 폴더: `C:/Users/권준구/multicultural-board-ux-spec`.
브랜치: `design/child-ux-20260911`. 변경은 로컬 작업 트리에 있으며 commit/push/배포하지 않았다.
기존 `C:/Users/권준구/multicultural-board`의 미커밋 작업은 수정하지 않았다.

## 실제 코드 변경

- `WordMemory.tsx`: 언어 조합을 React key로 사용해 독립 round를 마운트; 상태 전이를 reducer에 모음; setTimeout cleanup; TTS 교체/종료 시 pause.
- `wordMemoryState.ts`: 동일 카드/세 번째 카드/없는 카드 입력 무시, 두 번째 유효 flip에서 시도 1회 및 match 계산, 다른 카드 쌍의 오래된 settle 무시.
- 테스트/계획 검사/자산 실측 스크립트 3개 추가. 제품의 디자인 UI 전면 개편은 아직 구현하지 않았다.

## 실행 결과

| 명령 | 결과 | 범위/한계 |
|---|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | exit 0, 299 packages 설치 | 잠금 파일 변경 없음; Next 14.2.5 보안 경고 확인 |
| `node scripts/test-word-memory.mjs` | exit 0, 9 checks pass | 10,000개 결정적 입력 포함; React DOM lifecycle 검사는 아님 |
| `node scripts/test-yut.mjs` | exit 0, 39 pass / 0 fail | 기존 윷놀이 순수 로직 회귀 |
| `npx tsc --noEmit --incremental false` | exit 0 | 전체 타입 검사 |
| `npm run build` | exit 0, compile/typecheck/25개 static page 생성 완료 | runtime 외부 서비스/운영 DB 통합을 증명하지 않음 |
| `node scripts/audit-child-ux-assets.mjs` | exit 0, 11개 파일 실측 | 원본 변경 없음; bbox가 얼굴/손 앵커는 아님 |
| `git diff --check` | exit 0 | CRLF 변환 안내만 있음 |
| `node scripts/check-child-ux-plan.mjs` | exit 0, 7개 작업 계약/의존성/필수 문서 통과 | 계획 구조 검사이며 제품 품질 검사 아님 |

빌드 출력: `/` First Load JS 96.2kB, `/[roomCode]` 535kB, shared 87.4kB. 이번 수정 후 빌드 값이며 수정 전 비교 측정을 하지 않아 개선율은 계산하지 않는다. 3D 신규 자산/효과를 넣기 전에 room route의 초기 JS 예산을 점검할 필요가 있다. metadataBase 미설정 경고가 있었으며 별도 배포 메타데이터 작업으로 남긴다.

## 미검증 및 후속 작업

- 운영 URL의 현재 배포 SHA, 실제 입장/글쓰기/게임 클릭: 브라우저 연결이 없어 미검증.
- 기억 카드 MEMORY-01~03 React lifecycle/오디오 DOM 자동 검증: 후속 Q 작업.
- HoneyTaboo/NumberTap 등 전체 게임의 오류 재현/수정: 설계 및 검사 항목 제시, 이번에 일괄 수정하지 않음.
- 합성 자연스러움: 코드/자산 치수 진단 완료, 자산별 시각 교정과 3D 렌더 검수 미완료.
- 접근성/큰 글씨/RTL/200%/모바일 키보드 스크린샷: 하네스 명세 작성, 새 UI 구현 후 실행 필요.
- Firebase emulator/실서비스 rules/동시 보상/TTS/LLM 연결: 이번 테스트는 네트워크 호출 없이 진행.
- 프레임워크 보안 패치 검토: 설치 도구의 실제 경고를 후속 출시 게이트에 반영. 임의 버전 업그레이드는 하지 않음.

전체 출시 준비 상태는 **미완료**다. 설계 패키지와 제한된 게임 수정/검증을 전달하는 단계다.

## 전달 방식

기존 프로젝트에서 적용할 때는 먼저 이 설계 기준 SHA와 현재 코드를 비교한다. 패키지의 `game-fix.patch`는 게임 수정 및 새 실행 스크립트를 포함한다. `git apply --check game-fix.patch`가 통과한 경우에만 적용한다. docs 폴더는 같은 상대 경로로 복사한다. 이미 같은 변경이 적용되어 있으면 중복 적용하지 않는다. `node scripts/check-child-ux-plan.mjs`가 기대하는 문서 경로는 `docs/child-ux-20260911`이다.
