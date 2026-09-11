"use client";

import { useChildUx } from "@/lib/childUx/useChildUx";

/**
 * 저장된 화면 설정을 문서 루트에 반영하기만 하는 부팅 훅. layout 에 한 번 둔다.
 * 설정 위젯이 없는 화면(입장·게임 전체화면 등)에서도 큰 글씨가 적용되게 하는 게 목적.
 */
export default function ChildUxBoot() {
  useChildUx();
  return null;
}
