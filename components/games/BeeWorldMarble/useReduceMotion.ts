"use client";

import { useEffect, useState } from "react";

/**
 * 움직임 줄이기 설정을 읽는다. 기기 설정이 바뀌면 그 자리에서 따른다.
 *
 * 06 문서 §5: "움직임 줄이기에서는 흔들림·점프·카메라 이동을 생략하고
 * 결과/도착 상태를 바로 보여준다."
 *
 * index(굴림·이동 타이머)와 PieceLayer(말이 미끄러지는 전환) 두 곳이 같은
 * 값을 봐야 해서 밖으로 뺐다. 서버에서는 항상 false 로 시작해 하이드레이션이
 * 어긋나지 않게 한다.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}
