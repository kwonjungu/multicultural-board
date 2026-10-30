import type { Metadata } from "next";
import {
  PRIVACY_ARTICLES,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_INTRO,
} from "@/lib/privacyPolicy";

export const metadata: Metadata = {
  title: "개인정보 처리방침 · 꿀비",
  description: "AI 꿀비와 함께하는 즐거운 소통 공간 개인정보 처리방침",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 16px 64px",
        background: "#fff",
        color: "#222",
        lineHeight: 1.7,
        fontSize: 15,
        wordBreak: "keep-all",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>개인정보 처리방침</h1>
      <p style={{ color: "#666", marginTop: 0 }}>시행일: {PRIVACY_EFFECTIVE_DATE}</p>
      <p>{PRIVACY_INTRO}</p>
      {PRIVACY_ARTICLES.map((a) => (
        <section key={a.title} style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 17, marginBottom: 6 }}>{a.title}</h2>
          {a.body.map((line, i) => (
            <p key={i} style={{ margin: "4px 0" }}>
              {line}
            </p>
          ))}
        </section>
      ))}
      <p style={{ marginTop: 40 }}>
        <a href="/" style={{ color: "#b7791f" }}>
          ← 처음 화면으로
        </a>
      </p>
    </main>
  );
}
