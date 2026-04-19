# CLAUDE.md — 작업 시 주의사항

이 프로젝트에서 반복되면 안 되는 실수들. 같은 함정에 다시 빠지지 말 것.

## 에셋 / 좌표

- **PNG 좌표를 눈으로 측정할 때는 반드시 트림된 이미지에서 측정한다.**
  원본 PNG마다 투명 여백이 제각각이라 untrimmed 이미지에서 측정한 % 좌표는
  이미지별로 모두 어긋난다. 새 캐릭터/코스메틱 추가 시:
  1. `node scripts/trim-stickers.mjs` 먼저 실행해 투명 여백 제거
  2. 트림된 이미지에서 head center / head top 측정
  3. `public/stickers/anchors.json` 에 항목 추가
  4. 코드는 수정 불필요 — 런타임에 JSON 을 읽는다

- **`trim-stickers.mjs` 는 멱등(idempotent) 이지만 재실행할 때 이미 트림된
  이미지에도 sharp 가 6px 패딩을 한 번 더 얹을 수 있다.** 변경점이 없으면
  diff 가 0 인지 확인 후 커밋.

- **모자/트로피/펫 좌표는 하드코딩하지 말고 `anchors.json` + 픽셀 계산으로
  도출한다.** 예전에 inline `CHAR_ANCHOR` 객체로 박았다가 에셋 추가마다 코드를
  수정해야 했음.

## CSS / 기하 계산

- **clip-path 타일링(육각형 등) 에서는 `Math.round` / `Math.floor` 금지.**
  CSS 는 fractional px 를 그대로 받으므로 `HEX_H = W * 2 / Math.sqrt(3)` 을
  반올림 없이 사용. 반올림하면 행이 0.5~1px 씩 겹치거나 벌어진다.

- **flush 타일링 체크리스트 (pointy-top hex):**
  ```
  HEX_W = N                       // 원하는 폭
  HEX_H = HEX_W * 2 / √3          // 높이는 자동
  행 간 overlap = HEX_H / 4       // marginTop: -overlap
  홀수 행 shift = HEX_W / 2       // marginLeft
  ```
  셀 내부에 "테두리용 중첩 div" 를 넣으면 시각적 틈이 생기니 단일 clip-path 셀
  + solid background 로 유지.

## Next.js / TypeScript 잔꾀

- **`import data from "./x.json"` 에 meta 키(`_doc` 같은 문자열) 가 섞여 있으면
  `Record<string, SomeObject>` 로 직접 cast 가 안 된다.** `as unknown as
  Record<...>` 로 두 단계 캐스트하거나, meta 키를 `__meta__` 같은 nested
  object 로 분리할 것.

- **`@/public/...` import 는 tsconfig paths (`@/* → ./*`) 와 resolveJsonModule
  설정 덕에 동작한다.** JSON 직접 import 가능.

## Node 스크립트 (Windows)

- **`new URL("..", import.meta.url).pathname` 은 Windows 에서 한글 경로를
  `%EA%B6%8C...` 처럼 URL 인코딩된 상태로 리턴한다 → `ENOENT`.**
  항상 `fileURLToPath(import.meta.url)` + `dirname()` 조합 사용:
  ```js
  import { fileURLToPath } from "node:url";
  import { dirname, resolve } from "node:path";
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  ```

## Git / 쉘

- **현재 쉘의 CWD 가 삭제 대상 폴더일 때 `rm -rf <폴더>` 는 "Device or resource
  busy" 로 실패한다 (Windows).** 해결: 형제 폴더에 clone → 원본 내용만 `rm -rf
  *` → mv → 형제 폴더 제거.

- **`git config user.email/name` 을 임의로 설정하지 않는다.** 전역/로컬
  identity 가 없을 땐 사용자에게 먼저 확인받기. 이 원칙은 `CLAUDE.md` 보다도
  강하다.

- **커밋 전 `git status` 로 `public/` 대량 변경을 확인.** `trim-stickers.mjs`
  실행 후에는 42개 PNG 가 전부 modified 로 나오니, 의도한 변경인지 재확인.

## 빌드 검증

- `npm run build` 는 타입 체크 + 13개 페이지 prerender 까지 포함. PraiseHive /
  BeeMascot / SetupScreen 수정 후엔 반드시 통과시키고 푸시.
- 에셋(PNG) 만 변경했어도 type import 가 깨졌을 수 있으니 빌드 생략하지 말 것.

## Firebase 실시간 구독 (subscribe 패턴)

- **Firebase `onValue` 는 한 번에 두 번 이상 발화할 수 있다.** 캐시값 → 서버값
  왕복, 또는 자기 자신의 낙관적 쓰기가 에코로 되돌아오는 경우가 대표적. 콜백
  안에서 `setDraft(remote)` 같은 코드를 그대로 쓰면 사용자가 고른 값이 subs
  재발화 때 원래값으로 덮어써진다.
- **구독은 "첫 fire 에만 draft 시딩" 패턴을 고수.** 모달/화면이 열릴 때마다
  `useRef(false)` 플래그를 리셋해 1회 시딩, 이후엔 `current`(읽기 전용 상태)만
  갱신하고 사용자 편집 상태는 건드리지 말 것. CosmeticPicker 가 이 패턴.
- **쓰기는 낙관적으로.** 저장 버튼 → `onClose()` 즉시 + `onSaved()` 토스트
  먼저 → `setCosmetics(...).catch(err => onSaveError(err))` 백그라운드. `await`
  로 모달을 붙잡아두면 체감 지연이 커지고, Firebase 가 에코 재발화하며 UI 상태
  가 튈 수 있다.
- 토스트 컴포넌트는 `components/Toast.tsx` 재사용. tone `success` / `error`.

## 배경 제거 파이프라인 (scripts/clean-bg.mjs)

- **이전 실수:** `isNearBlack(r<40 && g<40 && b<40)` 같은 **predicate-only** 스트립
  은 이미지 안쪽의 까만 외곽선까지 통째로 날린다 (예: 번데기 몸통 검은 줄무늬).
- **현재 올바른 방식:** 가장자리에서 **flood-fill seed** 를 잡고, "같은 종류
  (light / dark) 의 인접 픽셀만 지우기"로 경계를 존중한다. 뿌리부터 닿을 수
  있는 배경만 지우기 때문에 **내부 본체 검은 선은 보존**된다.
- **다중 패스.** 체커 패턴처럼 한 겹을 지우면 안쪽 링이 새 가장자리가 되는
  경우가 있어서 `MAX_PASSES=6` 번까지 수렴할 때까지 반복.
- **에지 샘플링은 많이.** 한 변에 16 샘플 위치 × 4 방향으로 가장 바깥 불투명
  픽셀을 seed 로 등록. 본체가 특정 위치에서 edge 에 닿아도 다른 샘플로 우회.
- **dark seed 는 현재 비활성.** 까만 배경을 flood 로 지우면 본체 외곽선까지
  따라가는 사고가 잦아서, 특정 파일에 대해서만 별도 스크립트(`strip-bg.mjs`)
  로 수동 처리.
- `public/patterns/` 는 스크립트 대상에서 제외 — 타일링 배경이므로 내용 자체
  가 "배경".

## Next.js 외부 이미지

- 표준 `<img src="...">` 는 도메인 제한 없이 사용 가능. `next/image` 는 도메인
  허용 목록(`next.config.js → images.remotePatterns`) 필요.
- `flagcdn.com`, `flagpedia.net` 등은 오픈 라이선스 국기 CDN. srcset `w320`/`w640`
  세트로 HiDPI 대응.
