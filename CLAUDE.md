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
