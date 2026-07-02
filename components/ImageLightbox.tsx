"use client";

import { useEffect } from "react";

/**
 * 공용 이미지 확대 뷰어 — 친구들의 그림/사진을 클릭하면 전체 화면으로 크게.
 * 사용처: 소통판 카드, 의견 나누기 응답, 그림책 열매(응답) 모달, 자유 읽기 답변.
 *
 * 호출 측은 `const [zoomSrc, setZoomSrc] = useState<string | null>(null)` 로
 * 상태를 들고, 이미지에 onClick={() => setZoomSrc(url)} 만 달면 된다.
 */
export default function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  // Esc 로 닫기 (열려 있을 때만 리스너)
  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="이미지 크게 보기"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(9,7,30,0.88)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(12px, 4vw, 40px)",
        cursor: "zoom-out",
        animation: "fadeIn 0.18s ease",
      }}
    >
      <img
        src={src}
        alt={alt || "확대 이미지"}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "94vw", maxHeight: "88vh",
          objectFit: "contain",
          borderRadius: 14,
          background: "#fff",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          cursor: "default",
        }}
      />
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: "fixed", top: 14, right: 14,
          width: 44, height: 44, borderRadius: 14,
          background: "rgba(255,255,255,0.92)", border: "2px solid #FDE68A",
          fontSize: 17, fontWeight: 900, color: "#92400E", cursor: "pointer",
          boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
        }}
      >✕</button>
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.75)",
        pointerEvents: "none",
      }}>
        화면을 누르면 닫혀요
      </div>
    </div>
  );
}
