# NOTICE — 서드파티 데이터 출처

이 저장소는 아래 서드파티 지도 데이터를 포함하거나(포함) 참조한다(참조). 각 항목의
전체 확인 절차·SHA-256·다운로드 시도 기록은 `data/maps/sources.json` 과
`data/maps/NOTICE.md` 를 참고한다.

## Natural Earth — Admin 0 Countries (1:10m)

- 포함됨 (`data/maps/natural-earth/countries/*.geojson`, `data/maps/major-countries.json`)
- 버전 5.1.1, Public Domain.
- 공식 페이지: https://www.naturalearthdata.com/about/ ,
  https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
- 라이선스 문구("...are in the public domain.")는 이 세션이 위 페이지를 직접 열어
  본문에서 확인했다.

## NASA Visible Earth — Blue Marble

- 참조만 함, 이번 세션에서는 실제로 받아 넣지 않았다.
- 설계 문서가 가리킨 원래 URL은 현재 리다이렉트되어 있다 — 자세한 내용은
  `data/maps/NOTICE.md` 참고.
- 실제로 포함하게 되면: NASA는 이 제품을 만들거나 보증하지 않는다. NASA 로고를
  제품 브랜딩처럼 사용하지 않는다.

## geoBoundaries 4.0

- 사용하지 않음. Natural Earth 데이터만으로 목표한 66개 candidate 국가가 전부
  해결되었다.
