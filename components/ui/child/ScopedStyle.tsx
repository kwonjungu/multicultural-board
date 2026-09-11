"use client";

/**
 * 화면 전용 CSS 를 그 화면 옆에 두기 위한 얇은 래퍼.
 *
 * 인라인 style 로는 미디어 쿼리·:focus·:not() 을 쓸 수 없어서 360px 대응과
 * 상태 표현이 불가능하다. 문자열을 자식으로 넣으면 SSR 이 따옴표·말줄임표를
 * 이스케이프해 선택자가 깨지므로(app/layout.tsx 주석 참조) __html 로 넣는다.
 */
export default function ScopedStyle({ css }: { css: string }) {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
