# 지도 데이터 출처 (data/maps)

## 국가 경계 — Natural Earth 1:10m Cultural Vectors, Admin 0 Countries

- 작품명: Natural Earth 1:10m Cultural Vectors — Admin 0 Countries
- 버전: 5.1.1 (다운로드한 zip 안의 `ne_10m_admin_0_countries.VERSION.txt` 로 확인)
- 공식 안내 페이지: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
- 라이선스: Public Domain — https://www.naturalearthdata.com/about/ 를 이 세션에서 직접 열어
  "All versions of Natural Earth raster + vector map data found on this website are in the
  public domain." 문구를 확인했다.
- 다운로드 날짜: 2026-09-13
- 실제 파일 출처: naturalearthdata.com 자체 다운로드 링크가 HTTP 500/404 를 반환해,
  Natural Earth 프로젝트가 실제로 파일을 서빙하는 CDN(naciscdn.org)에서 받았다.
  전체 시도 기록·SHA-256 은 `data/maps/sources.json` 참고.
- 경계 정책(`boundaryPolicy`): `natural-earth-de-facto-disputed-boundaries` — Natural Earth 가
  그린 사실상의 경계를 그대로 쓰고, 분쟁·속령·경계 해석이 복잡한 지역은
  `major-countries.json` 에서 `quizEligible:false` 로 표시(지도에는 보이되 출제에는 쓰지 않음).
- 정답 판정에는 이 polygon 데이터만 쓴다. 다른 시각 layer(지형 texture 등)는 판정에 쓰지 않는다.

## 지형/위성 texture — NASA Visible Earth Blue Marble

- 이번 세션에서는 이 텍스처를 실제로 받아 넣지 않았다(`not-downloaded-this-session`).
  트랙 1·2(경계 polygon 판정 파이프라인)만 진행했기 때문이다.
- 설계 문서가 가리킨 URL(`https://visibleearth.nasa.gov/images/57723/the-blue-marble`)은
  현재 `https://science.nasa.gov/earth/earth-observatory/` 로 301 리다이렉트된다 — 페이지
  개편으로 원래 경로가 사라진 것으로 보인다. 새 경로에서 이미지와 라이선스 문구를
  다시 찾는 작업은 아직 하지 않았다.
- NASA 이미지는 일반적으로 저작권 표시 없이 쓸 수 있지만, NASA 로고를 제품
  브랜딩처럼 쓰거나 NASA가 이 제품을 보증한다는 인상을 주면 안 된다는 것이
  NASA 미디어 정책의 통상적인 내용이다. **이 문장은 이번 세션에서 NASA 정책
  페이지를 직접 열어 확인한 것이 아니라 일반적으로 알려진 내용을 옮긴 것이다** —
  실제로 텍스처를 넣을 때 https://www.nasa.gov/nasa-brand-center/images-and-media/ 를
  직접 열어 다시 확인해야 한다.
- 텍스처는 어디까지나 시각 layer이며, 국가 정답 판정에는 절대 쓰지 않는다
  (판정은 위 Natural Earth polygon으로만 한다).

## 대체 경계 — geoBoundaries 4.0

- 사용하지 않았다. Natural Earth geometry 로 candidate 66개국이 모두(verifiedCount=66)
  해결되어 대체가 필요 없었다.
- 참고 URL: https://github.com/wmgeolab/geoBoundaries/blob/main/LICENSE
  (페이지가 열리는 것만 확인했고, 라이선스 본문은 읽지 않았다 — 실제로 쓰게 되면
  CC BY 4.0 조건과 국가별 원자료 조건을 다시 확인해야 한다.)

## 상세 기록

다운로드 시도 URL·HTTP 상태·SHA-256·라이선스 확인 방식의 전체 기록은
`data/maps/sources.json` 에 있다.
