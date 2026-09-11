"use client";

/**
 * 글자 크기 버튼 — 구현은 components/ui/child/TextSizeMenu 로 옮겼다.
 *
 * 예전 구현은 `document.documentElement.style.zoom` 으로 문서 전체를 배율
 * 확대했다. zoom 은 인라인 px 까지 같이 키워서 편했지만, 브라우저 200% 확대와
 * 곱해져 이중 배율이 되고 레이아웃·측정이 어긋난다(README §4.1). 이제 설정은
 * lib/childUx 한 곳에 저장되고 토큰 값 자체가 바뀐다.
 *
 * 아직 토큰으로 옮기지 않은 화면은 컨테이너에 `data-ux-legacy` 를 달면 과도기
 * 동안만 종전 zoom 폴백을 받는다.
 */
export { default } from "./ui/child/TextSizeMenu";
