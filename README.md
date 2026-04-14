# 🌏 다문화 교실 소통판

초등학교 다문화 교육 환경을 위한 실시간 다국어 소통 플랫폼입니다.  
패들렛 스타일 컬럼 보드 + Grok API 자동 번역 + Firebase 실시간 DB

---

## 🏗 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 번역 + 필터링 | Grok API (xAI) — 서버사이드 |
| 실시간 DB | Firebase Realtime Database |
| 배포 | Vercel |
| TTS | Web Speech API (브라우저 내장) |

---

## 🚀 로컬 실행

### 1. 클론 및 설치
```bash
git clone https://github.com/your-username/multicultural-board.git
cd multicultural-board
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env.local
```
`.env.local` 파일을 열어 아래 값들을 채워주세요.

#### Grok API 키 발급
1. https://console.x.ai 접속
2. API Keys → Create API Key
3. `XAI_API_KEY=xai-...` 에 복사

#### Firebase 설정
1. https://console.firebase.google.com → 새 프로젝트 생성
2. **Realtime Database** 생성 (테스트 모드로 시작)
3. **프로젝트 설정 → 일반 → 내 앱** → 웹 앱 추가 → `NEXT_PUBLIC_FIREBASE_*` 값 복사
4. **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성** → JSON 파일 열어서 `FIREBASE_ADMIN_*` 값 복사

### 3. 실행
```bash
npm run dev
# http://localhost:3000
```

---

## ☁️ Vercel 배포

### 1. GitHub에 푸시
```bash
git add .
git commit -m "init: multicultural board"
git push origin main
```
> ⚠️ `.env.local`은 `.gitignore`에 포함되어 자동으로 제외됩니다.

### 2. Vercel 연결
1. https://vercel.com → New Project
2. GitHub 레포 선택
3. **Settings → Environment Variables** 에서 `.env.example`의 모든 키 입력
4. Deploy!

### 3. Firebase Security Rules 설정 (운영 전 필수!)
Firebase 콘솔 → Realtime Database → 규칙:
```json
{
  "rules": {
    "cards": {
      ".read": true,
      ".write": false
    }
  }
}
```
> 쓰기는 Admin SDK(서버)에서만, 읽기는 클라이언트에서 허용

---

## 📁 프로젝트 구조

```
multicultural-board/
├── .env.example              ← 환경변수 양식 (GitHub 공개)
├── .env.local                ← 실제 키 (gitignore!)
├── app/
│   ├── api/translate/
│   │   └── route.ts          ← Grok API + Firebase Admin 쓰기
│   ├── layout.tsx
│   └── page.tsx              ← SetupScreen ↔ PadletBoard
├── components/
│   ├── SetupScreen.tsx       ← 입장 화면
│   ├── PadletBoard.tsx       ← 메인 보드 + Firebase 구독
│   ├── PadletCard.tsx        ← 개별 카드 + TTS
│   └── PostModal.tsx         ← 글 작성 바텀시트
└── lib/
    ├── constants.ts           ← 언어, 컬럼, 팔레트
    ├── firebase-admin.ts      ← 서버사이드 Admin SDK
    ├── firebase-client.ts     ← 클라이언트 실시간 구독
    └── types.ts               ← 공통 TypeScript 타입
```

---

## 🔒 보안 구조

```
클라이언트
  ├── Firebase JS SDK  →  Realtime DB 읽기/구독 (실시간)
  └── POST /api/translate
          ↓ (서버사이드)
      Grok API  →  번역 + 유해 콘텐츠 필터링
      Firebase Admin SDK  →  DB 쓰기
```

- **Grok API 키**: 서버에만 존재, 클라이언트 노출 없음
- **Firebase Admin 키**: 서버에만 존재
- **Firebase Client 설정**: 클라이언트 노출되지만 Security Rules로 보호

---

## 🌐 지원 언어

| 코드 | 언어 | 대상 |
|------|------|------|
| ko | 한국어 🇰🇷 | 기본 |
| en | English 🇺🇸 | 기본 |
| vi | Tiếng Việt 🇻🇳 | 베트남 |
| zh | 中文 🇨🇳 | 중국 |
| fil | Filipino 🇵🇭 | 필리핀 |

---

## 📋 사용 방법

### 교사 모드
- 역할: **선생님** 선택
- 언어: 2~3개 복수 선택 (모든 글이 선택한 언어로 번역됨)
- 컬럼 추가 버튼 활성화

### 학생 모드
- 역할: **학생** 선택
- 언어: 모국어 1개 선택
- 글 작성 시 한국어+영어로 자동 번역

### 유해 콘텐츠 필터링
- Grok API가 번역과 동시에 안전성 검사
- 부적절한 내용 감지 시 카드에 **⚠️ 검토** 뱃지 표시
