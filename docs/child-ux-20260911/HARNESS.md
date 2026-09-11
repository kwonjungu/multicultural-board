# 촘촘한 검증 하네스

## 1. 실행 가능한 것과 앞으로 구현할 것

이 패키지에서 실제 실행 가능한 것은 `node scripts/test-word-memory.mjs`, 기존 `node scripts/test-yut.mjs`, 계획 계약 검사 `node scripts/check-child-ux-plan.mjs`, TypeScript/Next build다. 아래 Playwright/axe/시각/서비스 실패 주입 검사는 **Q가 구현할 상세 명세**다. 현재 존재하지 않는 npm 스크립트를 이미 동작하는 명령으로 제시하지 않는다.

총괄 A가 Playwright Test, axe 및 테스트용 React 렌더 도구 도입 여부를 결정하고 잠금 파일까지 한 번만 갱신한다. 제품은 Next 14/React 18이므로 테스트 도구의 호환성을 확인한다. 도구 업그레이드와 화면 변경을 같은 대형 커밋으로 섞지 않는다.

## 2. G0 격리와 재현성 — 모든 작업 시작 전

fixture route는 개발/테스트 전용이며 production build에서 접근되지 않아야 한다. fixture가 roomCode만 바꿔 실제 Firebase에 연결하는 구조는 불합격이다. DB adapter를 명시적으로 주입하고 emulator 프로젝트 ID를 allowlist로 확인한다. seeded room 이름만 믿지 말고 실제 databaseURL과 emulator 연결을 검증한다. 테스트 코드에서 production 도메인 API 호출과 Firebase 원격 쓰기를 차단한다.

고정 입력: 시각 2026-09-11T00:00:00Z, seed=17, locale 명시, timezone=Asia/Seoul. 임의 이름 ‘학생 A/B/C’, 교사 ‘테스트 교사’. 0/1/30/40명, 카드 0/1/50개, 2,000자 본문, 긴 이름, 모든 장식 없음/대표 장식 조합. 실명·학생 목소리·운영 방 데이터 사용 금지.

network fixture: 정상 200, 400 검증 실패, 401/403 권한 실패, 429, 500, offline, 2초 지연, 중복 응답, 응답 순서 뒤바뀜, abort 후 늦은 응답, 이미지 404, TTS play rejection, 마이크 거부. 모든 경우 기대 결과를 테스트에 명시한다.

## 3. G1 자동 기능 검사

| ID | Given / When | Then / 실패 기준 |
|---|---|---|
| ENTRY-01 | /1111 상당 fixture, 언어/이름 선택 | 방 번호 재입력 없음; onDone payload의 방/이름/언어 일치 |
| ENTRY-02 | 빈 이름, 5회 CTA, 연결 실패 | 빈 이름 차단, 요청 1회, 선택 상태 유지 |
| ENTRY-03 | rosterMode true 40명/false 자유 입력 | 맞는 UI만 노출, 긴 이름도 선택 가능 |
| ENTRY-04 | 유효 수업 세션/유령 세션/종료 후 늦은 callback | 기존 수업 우선순위 유지, 종료한 세션 부활 없음 |
| BOARD-01 | 3개 주제/각각 카드, 모바일 주제 변경 | 올바른 카드만 표시, 작성 대상 columnId 정확 |
| BOARD-02 | 본문 2,000자, 번역 오류 | 원문 접근 가능, 읽기/더 읽기/재시도 유지 |
| POST-01 | 초안 작성→500→재시도→성공 | 텍스트/이미지 유지, 서버에 카드 1개, 올바른 주제로 이동 |
| POST-02 | 로컬 에코 후 서버 거절 | 성공 확정 표시 없음, 초안/재시도 상태 복구 |
| POST-03 | 승인 모드 | 학생은 검토 중 상태, 승인 전 공개하지 않음 |
| IME-01 | 한국어/일본어/중국어 composing=true Enter | 전송 0회; composition 종료 뒤 명시적 전송 1회 |
| STREAM-01 | 요청 A 후 취소→B, A가 늦게 도착 | B 응답만 표시, unmount 후 상태 변경 없음 |
| AUDIO-01 | A 읽기→B 읽기→닫기 | 활성 재생 최대 1개, 닫은 후 0개 |
| MEMORY-01 | 두 장 공개→언어 변경 | 새 덱/0시도/매칭 없음, 예외 없음 |
| MEMORY-02 | 3연타/동일 카드/StrictMode | 두 장까지만 공개, 한 쌍 당 시도 1회 |
| MEMORY-03 | 짝 공개→unmount→가상 시계 1초 | 잔여 timeout 0, 오디오 paused |
| TABOO-01 | deadline 직전/직후 정답·패스 | 만료 후 점수 증가 없음, 같은 cardId 결과 1개 |
| TABOO-02 | 백그라운드 100초 후 복귀 | 선택한 시간 정책에 맞게 종료/일시정지 표시; 조용한 추가 시간 없음 |
| REWARD-01 | 동일 eventId를 두 탭에서 요청 | transaction 결과 보상 1회; exit-only 이벤트는 새 정책에 맞게 처리 |
| ART-01 | 400×800→300×300, anchor(100,0) | x=112.5, y=0 정확 |
| ART-02 | 선택 스킨 합성 실패/원본 정상 | 선택한 스킨 유지; 의도치 않은 classic 전환 없음 |
| ART-03 | 모든 자산 실패→새 장식 선택 | 최종 placeholder로 종료, 새 자산 정상 복구 |
| ART-04 | props 동일, picker/칭찬집/마을 | resolved asset/slot/render plan hash 일치 |
| SCENE-01 | context lost/불가 | 2D 대체가 선택/이름/기능 유지 |
| SCENE-02 | 진입/퇴장 20회, 늦은 loader callback | renderer/texture/geometry·listener 누수 없음 |
| GAMES-ALL | 현재 GAMES 전체 목록 순회 | 모든 게임의 시작/한 행동/나가기/재시작 smoke pass |

기억 카드 pure suite는 9개 검사와 10,000개 결정적 입력을 검사한다. 이 결과만으로 React unmount/오디오/언어 변경 DOM 흐름이 검증되었다고 쓰지 않는다. Q가 MEMORY-01~03을 별도 구현해야 한다.

타이머 정책: 교육 연습은 pause on hidden을 선택할 수 있고 경쟁 모드는 wall clock을 선택할 수 있다. 어떤 정책인지 화면에 명확히 표시하고 테스트 기대값도 정책별로 고정한다. interval 호출 횟수가 실제 시간을 뜻한다고 가정하지 않는다.

## 4. G2 화면·접근성 검사

매 PR 기본 조합: 360×800, 768×1024, 1280×900 × 기본/큰 글씨. 입장/글쓰기에는 360×640 및 844×390 키보드 상태 추가. KO/VI/JA/AR 4개는 전체 핵심 흐름, 나머지 지원 언어는 진입/본문/버튼 줄바꿈 smoke. 실제 LANGUAGES 목록과 비교해 빠진 언어를 보고한다.

자동 assert: 문서 가로 overflow 0(의도된 별도 3D 영역 제외), 필수 텍스트 잘림 없음, 버튼 min-height/width≥56px, 본문 계산 font-size≥20px 상당, 필수 label≥18px 상당, 명시적 focus-visible, 숨겨진 컨트롤 focus 불가. 200% 줌에서는 가로스크롤 없는 핵심 읽기/입력 경로를 확인한다. 무조건 모든 span 크기를 검사하지 말고 semantic role/data-ux-role로 body/label/secondary를 구분한다.

axe critical/serious 0을 목표로 하되 자동 도구가 사용성·시각 자연스러움을 증명하지 못한다. 키보드/스크린리더 순서, dialog focus restore, RTL, TTS 언어, 모달 내 스크롤과 키보드 겹침은 직접 검사한다.

## 5. G3 시각 회귀와 합성 승인

fixture 캡처는 동일 OS/브라우저/폰트/DPR/시계/seed를 사용한다. 애니메이션은 test mode에서 정지시키되 실제 reduced-motion 기능도 별도 테스트한다. 이미지 load와 fonts.ready를 기다리고 로딩 완료 신호를 기다린다. 임의 sleep만으로 준비됐다고 가정하지 않는다.

기준 PNG는 Q/총괄이 처음 승인한다. 전체 화면 diff ratio 0.5%를 초기 경보값으로 쓰되 안티앨리어싱 노이즈 때문에 바로 자동 실패시킬지 환경별 조정한다. 얼굴/눈/손/모자 접점 crop은 별도 비교하며, 수치가 낮아도 소품 관통/빈 공간에 떠 있음/피부색 변화/잘림은 불합격이다. 합성 의미 판단을 픽셀 diff 하나에 맡기지 않는다.

| 평가 영역 | 0점 | 1점 | 2점 |
|---|---|---|---|
| 읽기 | 잘림/매우 작음 | 읽히나 밀집 | 크고 줄 길이 적절 |
| 행동 | 다음 행동 불명 | 찾을 수 있음 | 1개 핵심 행동 즉시 식별 |
| 합성 | 관통/분리/색 불일치 | 작은 접점/광원 이질감 | 몸/소품/그림자 자연스러움 |
| 일관성 | 화면별 제각각 | 일부 불일치 | 타입/색/아이콘/모션 통일 |
| 회복 | 실패 후 막힘 | 재시도만 있음 | 입력 보존+상태 설명+회복 |

총 10점 중 9점 이상 + 어느 항목도 0점 없음이 초기 승인 목표다. 구현 모델은 자기 점수만으로 승인할 수 없다. Q/총괄의 근거 캡처와 항목별 설명을 남긴다.

## 6. G4 성능·릴리스

측정할 지표: 홈 최초 JS 크기(기준 대비 변화), 동일 기기/네트워크의 LCP/INP/CLS, 3D p95 frame time, renderer.info 메모리, 장시간 음성/구독 수. 초기 현장 목표 LCP≤2.5초, INP≤200ms, CLS≤0.1은 프로젝트 예산이며 이번에 측정된 값이 아니다. CI lab 측정과 실제 사용자 지표를 구분한다.

실제 Firebase 연동은 별도 테스트 프로젝트에서만, 두 브라우저/두 클라이언트로 onValue 에코·재접속·동시 보상·승인 흐름을 검증한다. mock 통과를 실제 rules 검증으로 부풀리지 않는다. 운영 프로젝트 규칙을 UI 테스트를 위해 완화하지 않는다.

프레임워크 버전 점검도 출시 게이트에 둔다. 이번 npm ci에서 Next 14.2.5 보안 경고가 출력되었다. 총괄은 공식 지원/보안 공지에 따라 패치 경로를 별도 작업으로 확인하고 호환성 테스트 후 반영한다. 이 패키지는 프레임워크를 임의 업그레이드하지 않는다.

## 7. 실패 보고와 모델 품질 통제

테스트 결과는 pass/fail/blocked만 사용한다. skipped/미실행은 release gate 실패다. known issue 허용은 총괄이 사유·영향·해결기한을 기록해야 하며 P0 데이터 손실/게임 중단/권한 결함은 허용하지 않는다.

하위 모델이 테스트를 약하게 바꿔 통과시키는 것을 막기 위해 Q 소유 acceptance fixture와 기대값은 구현자 브랜치에서 수정하지 않는다. 테스트의 의미가 바뀌면 총괄이 요구사항과 함께 리뷰한다. 스냅샷 갱신에는 전후 이미지를 반드시 첨부한다.

아래 JSON 형식은 릴리스 증거 예시이며 pass 값은 실행 후에만 채운다:

```json
{
  "commit": "tested-commit-sha",
  "environment": {"node":"...", "browser":"...", "os":"..."},
  "required": ["ENTRY-01","MEMORY-01","ART-04","SCENE-01"],
  "checks": [{"id":"MEMORY-01","status":"blocked","reason":"UI runner not configured"}],
  "reviewer": "",
  "releaseApproved": false
}
```

체크 수를 줄이거나 blocked를 제거해 100%를 만들지 않는다. GAMES-ALL은 등록 목록과 실제 테스트 수행 게임 ID 집합이 같아야 한다. 부분 성공은 어느 게임/화면까지 검증됐는지 그대로 보고한다.
