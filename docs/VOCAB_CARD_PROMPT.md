# 🐝 어휘 카드 학습 기능 구현 프롬프트

> **프로젝트**: multicultural-board (다문화 교실 소통판)
> **대상 사용자**: 초등학교 다문화 학생 (한국어가 모국어가 아닌 학생)
> **목표**: 패들렛 소통창에서 사용된 어휘를 기반으로 한국어 필수 단어를 카드 형식으로 학습하는 기능 추가

---

## 1. 전체 아키텍처 개요

### 1-1. 새로 추가할 구성요소

```
app/
  [roomCode]/page.tsx              ← hubView에 "vocab" 추가
  api/
    vocab-extract/route.ts         ← 패들렛 어휘 추출 + 매칭 API (Groq LLM)
    vocab-tts/route.ts             ← 단어/예문 TTS (기존 /api/tts 재사용 가능)

components/
  VocabHub.tsx                     ← 어휘학습 메인 (탭: 오늘의 단어 / 단어장)
  VocabCard.tsx                    ← 개별 단어 카드 (뒤집기 + 예문 3개)
  VocabSentenceCard.tsx            ← 예문 카드 (듣기/말하기/쓰기 모드)
  VocabNotebook.tsx                ← 단어장 탭 (학습 이력 보관)
  VocabRecorder.tsx                ← 녹음 + 재생 컴포넌트

lib/
  vocabWords.ts                    ← 100개 단어셋 + 예문 데이터
  vocabUtils.ts                    ← 어휘 추출/매칭 유틸
```

### 1-2. Firebase 스키마 확장

```
rooms/{roomCode}/
  vocab/
    extracted/                       ← 패들렛에서 추출된 어휘 캐시
      {extractionId}/
        words: string[]              ← 추출된 한국어 단어 목록
        sourceCardIds: string[]      ← 출처 카드 ID
        timestamp: number

    progress/{clientId}/             ← 학생별 학습 진행 기록
      {wordId}/
        wordId: string
        listenCount: number          ← 듣기 완료 횟수
        speakCount: number           ← 말하기(녹음) 완료 횟수
        writeCount: number           ← 쓰기 완료 횟수
        sentencesDone: number[]      ← 완료한 예문 인덱스 [0,1,2]
        lastStudied: number          ← 마지막 학습 timestamp
        firstStudied: number         ← 최초 학습 timestamp
        mastered: boolean            ← 3개 예문 모두 완료 여부

    recordings/{clientId}/
      {wordId}_{sentenceIdx}/
        audioUrl: string             ← Firebase Storage 경로
        timestamp: number
        duration: number             ← 녹음 길이 (초)

    stats/{clientId}/
      totalWordsStudied: number      ← 학습한 총 단어 수
      totalSentencesDone: number     ← 완료한 총 예문 수
      totalRecordings: number        ← 총 녹음 횟수
      streak: number                 ← 연속 학습 일수
      lastActiveDate: string         ← "2026-04-20" 형식
      stickersEarned: number         ← 이 기능에서 받은 스티커 수
```

### 1-3. HomeHub 확장

HomeHub.tsx의 기존 4개 섹션 카드에 5번째 추가:

```typescript
// HomeHub.tsx에 추가
{
  key: "vocab",
  title: "단어 카드",
  subtitle: "Word Cards",
  desc: "소통창에서 배운 단어를 카드로 공부해요",
  color: "#8B5CF6",        // 보라색 (기존 팔레트와 구별)
  icon: "📚",
  mascot: "/mascots/bee-study.png"
}
```

`app/[roomCode]/page.tsx`의 `HubView` 타입에 `"vocab"` 추가, view 라우팅에 `VocabHub` 컴포넌트 매핑.

---

## 2. 어휘 추출 알고리즘

### 2-1. API 엔드포인트: `/api/vocab-extract`

**요청:**
```typescript
interface VocabExtractRequest {
  roomCode: string;
  clientId: string;
  studentLang: string;        // 학생의 모국어 코드 (예: "vi", "zh")
}
```

**처리 흐름:**

```
1. Firebase에서 해당 방의 모든 카드 텍스트 가져오기
   → rooms/{roomCode}/cards 전체 읽기
   → originalText + translations.ko 수집

2. Groq LLM에 어휘 추출 요청 (llama-3.3-70b-versatile)

3. 추출된 단어를 vocabWords.ts의 100개 단어셋과 매칭

4. 매칭된 단어 + 관련도 점수 반환
```

**Groq 프롬프트:**

```
당신은 초등학교 한국어 교육 전문가입니다.

아래는 다문화 교실 소통판에 학생들이 작성한 글 목록입니다.
이 글들에서 한국어 학습에 유용한 핵심 어휘를 추출해주세요.

[소통판 글 목록]
{cardTexts}

[기준 단어 목록 - 이 중에서만 선택]
{wordList: vocabWords의 100개 단어 ID와 한국어 표기}

다음 기준으로 관련도를 매기세요:
1. 직접 사용됨 (해당 단어가 글에 등장) → 관련도 5
2. 동의어/유사어 사용됨 (비슷한 의미 단어 등장) → 관련도 4
3. 같은 주제/맥락 (글의 주제와 관련) → 관련도 3
4. 학교생활 필수 어휘 (글에 없지만 맥락상 필요) → 관련도 2

JSON으로 응답:
{
  "matched": [
    {"wordId": "happy", "score": 5, "reason": "학생이 '기뻐요'를 직접 사용"},
    {"wordId": "friend", "score": 4, "reason": "'친구'가 3번 등장"},
    ...
  ]
}

상위 10~15개만 반환. 관련도 3 이상만 포함.
```

**응답:**
```typescript
interface VocabExtractResponse {
  words: {
    wordId: string;
    score: number;
    reason: string;
  }[];
  extractionId: string;
}
```

### 2-2. 폴백: LLM 없이 단순 매칭

Groq API 실패 시 폴백 알고리즘:

```typescript
function extractVocabSimple(cardTexts: string[], wordSet: VocabWord[]): MatchedWord[] {
  const freq: Record<string, number> = {};

  for (const text of cardTexts) {
    for (const word of wordSet) {
      // 단어의 모든 활용형 검사
      const forms = [word.ko, ...word.conjugations];
      for (const form of forms) {
        const count = (text.match(new RegExp(form, 'g')) || []).length;
        if (count > 0) {
          freq[word.id] = (freq[word.id] || 0) + count;
        }
      }
    }
  }

  return Object.entries(freq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15)
    .map(([id, count]) => ({ wordId: id, score: Math.min(5, count), reason: `${count}회 등장` }));
}
```

---

## 3. 단어셋 100개 (vocabWords.ts)

### 3-1. 데이터 구조

```typescript
export interface VocabWord {
  id: string;                    // 고유 ID (영문)
  ko: string;                   // 한국어 단어
  category: "noun" | "adjective" | "verb" | "expression";
  subcategory: string;           // 세부 분류
  level: 1 | 2 | 3;             // 난이도 (1:기초, 2:중급, 3:활용)
  conjugations: string[];        // 활용형 (검색 매칭용)
  sentences: [SentenceCard, SentenceCard, SentenceCard];  // 예문 3개
  imagePrompt: string;           // 단어 대표 이미지 생성 프롬프트
}

export interface SentenceCard {
  ko: string;                    // 한국어 예문
  situation: string;             // 상황 설명 (학교 맥락)
  imagePrompt: string;           // 이 예문의 이미지 생성 프롬프트
}
```

### 3-2. 100개 단어 목록

아래 100개 단어에 대해 각각 예문 3개 + 이미지 프롬프트를 포함한 전체 데이터를 `lib/vocabWords.ts`에 작성한다.

---

#### A. 감정 (15개)

| # | ID | 한국어 | 활용형 예시 | 분류 |
|---|-----|--------|------------|------|
| 1 | happy | 기쁘다 | 기뻐, 기쁜, 기뻐요, 기쁩니다 | 형용사 |
| 2 | sad | 슬프다 | 슬퍼, 슬픈, 슬퍼요, 슬픕니다 | 형용사 |
| 3 | angry | 화나다 | 화나, 화난, 화나요, 화납니다 | 동사 |
| 4 | scared | 무섭다 | 무서워, 무서운, 무서워요, 무섭습니다 | 형용사 |
| 5 | fun | 재미있다 | 재미있어, 재미있는, 재미있어요 | 형용사 |
| 6 | boring | 지루하다 | 지루해, 지루한, 지루해요, 지루합니다 | 형용사 |
| 7 | lonely | 외롭다 | 외로워, 외로운, 외로워요, 외롭습니다 | 형용사 |
| 8 | proud | 자랑스럽다 | 자랑스러워, 자랑스러운, 자랑스러워요 | 형용사 |
| 9 | sorry | 미안하다 | 미안해, 미안한, 미안해요, 미안합니다 | 형용사 |
| 10 | thankful | 고맙다 | 고마워, 고마운, 고마워요, 고맙습니다 | 형용사 |
| 11 | worried | 걱정되다 | 걱정돼, 걱정되는, 걱정돼요, 걱정됩니다 | 동사 |
| 12 | excited | 신나다 | 신나, 신나는, 신나요, 신납니다 | 동사 |
| 13 | shy | 부끄럽다 | 부끄러워, 부끄러운, 부끄러워요 | 형용사 |
| 14 | surprised | 놀라다 | 놀라, 놀란, 놀라요, 놀랍니다 | 동사 |
| 15 | comfortable | 편하다 | 편해, 편한, 편해요, 편합니다 | 형용사 |

**예문 샘플 — "슬프다" (sad):**

```typescript
{
  id: "sad",
  ko: "슬프다",
  category: "adjective",
  subcategory: "감정",
  level: 1,
  conjugations: ["슬퍼", "슬픈", "슬퍼요", "슬픕니다", "슬펐어", "슬펐어요"],
  sentences: [
    {
      ko: "나는 슬퍼요.",
      situation: "기분이 좋지 않을 때 선생님께 말하기",
      imagePrompt: "A young elementary school student sitting at their desk looking sad with a slight frown, soft watercolor illustration style, warm classroom background with colorful decorations, child-friendly Korean school setting, gentle pastel colors, no text"
    },
    {
      ko: "친구가 넘어져서 슬퍼요.",
      situation: "운동장에서 친구가 다쳤을 때",
      imagePrompt: "Two elementary school children in a playground, one child has fallen down and the other child is kneeling beside them looking concerned and sad, soft watercolor illustration style, Korean school playground with trees, gentle pastel colors, no text"
    },
    {
      ko: "슬픈 친구를 도와줘요.",
      situation: "울고 있는 친구를 위로할 때",
      imagePrompt: "A young child gently patting the back of a crying friend sitting on a bench, elementary school hallway background, soft watercolor illustration style, warm and comforting atmosphere, child-friendly, gentle pastel colors, no text"
    }
  ],
  imagePrompt: "A simple icon-style illustration of a sad face with a single tear drop, soft watercolor style, gentle blue and pastel tones, child-friendly, circular frame, no text"
}
```

---

#### B. 지칭어 / 위치 (12개)

| # | ID | 한국어 | 활용형 예시 | 분류 |
|---|-----|--------|------------|------|
| 16 | here | 여기 | 여기요, 여기에 | 명사 |
| 17 | there | 저기 | 저기요, 저기에 | 명사 |
| 18 | that_place | 거기 | 거기요, 거기에 | 명사 |
| 19 | this | 이것 | 이거, 이게 | 명사 |
| 20 | that | 저것 | 저거, 저게 | 명사 |
| 21 | i_me | 나 | 나는, 내가, 저는, 제가 | 명사 |
| 22 | you | 너 | 너는, 네가 | 명사 |
| 23 | we | 우리 | 우리는, 우리가, 우리의 | 명사 |
| 24 | who | 누구 | 누가, 누구요 | 명사 |
| 25 | what | 뭐 | 뭐요, 뭐야, 무엇 | 명사 |
| 26 | where | 어디 | 어디요, 어디에 | 명사 |
| 27 | when | 언제 | 언제요, 언제나 | 명사 |

---

#### C. 의사표현 (13개)

| # | ID | 한국어 | 활용형 예시 | 분류 |
|---|-----|--------|------------|------|
| 28 | want | 원하다 | 원해, 원해요, 원합니다 | 동사 |
| 29 | dislike | 싫다 | 싫어, 싫어요, 싫습니다 | 형용사 |
| 30 | like | 좋다 | 좋아, 좋아요, 좋습니다 | 형용사 |
| 31 | need | 필요하다 | 필요해, 필요해요, 필요합니다 | 형용사 |
| 32 | ok | 괜찮다 | 괜찮아, 괜찮아요, 괜찮습니다 | 형용사 |
| 33 | help | 도와주다 | 도와줘, 도와주세요, 도와줍니다 | 동사 |
| 34 | dunno | 모르다 | 몰라, 몰라요, 모릅니다 | 동사 |
| 35 | know | 알다 | 알아, 알아요, 압니다, 알겠어요 | 동사 |
| 36 | yes | 네 | 네, 예, 응 | 표현 |
| 37 | no | 아니요 | 아니요, 아뇨, 아니 | 표현 |
| 38 | please | 주세요 | 주세요, 줘, 줘요 | 표현 |
| 39 | wait | 기다리다 | 기다려, 기다려요, 기다려주세요 | 동사 |
| 40 | again | 다시 | 다시요, 다시 해주세요 | 표현 |

---

#### D. 학교생활 명사 (25개)

| # | ID | 한국어 | 분류 |
|---|-----|--------|------|
| 41 | friend | 친구 | 명사 |
| 42 | teacher | 선생님 | 명사 |
| 43 | school | 학교 | 명사 |
| 44 | classroom | 교실 | 명사 |
| 45 | desk | 책상 | 명사 |
| 46 | chair | 의자 | 명사 |
| 47 | book | 책 | 명사 |
| 48 | pencil | 연필 | 명사 |
| 49 | eraser | 지우개 | 명사 |
| 50 | notebook | 공책 | 명사 |
| 51 | bag | 가방 | 명사 |
| 52 | lunch | 급식 | 명사 |
| 53 | water | 물 | 명사 |
| 54 | toilet | 화장실 | 명사 |
| 55 | playground | 운동장 | 명사 |
| 56 | gym | 체육관 | 명사 |
| 57 | music_room | 음악실 | 명사 |
| 58 | library | 도서관 | 명사 |
| 59 | homework | 숙제 | 명사 |
| 60 | test | 시험 | 명사 |
| 61 | class_hour | 수업 | 명사 |
| 62 | break_time | 쉬는시간 | 명사 |
| 63 | art_supplies | 크레파스 | 명사 |
| 64 | scissors | 가위 | 명사 |
| 65 | glue | 풀 | 명사 |

---

#### E. 일상 동사 (20개)

| # | ID | 한국어 | 활용형 예시 | 분류 |
|---|-----|--------|------------|------|
| 66 | eat | 먹다 | 먹어, 먹어요, 먹습니다 | 동사 |
| 67 | drink | 마시다 | 마셔, 마셔요, 마십니다 | 동사 |
| 68 | go | 가다 | 가, 가요, 갑니다, 갈게요 | 동사 |
| 69 | come | 오다 | 와, 와요, 옵니다, 올게요 | 동사 |
| 70 | sit | 앉다 | 앉아, 앉아요, 앉습니다 | 동사 |
| 71 | stand | 서다 | 서, 서요, 섭니다, 일어서다 | 동사 |
| 72 | read | 읽다 | 읽어, 읽어요, 읽습니다 | 동사 |
| 73 | write | 쓰다 | 써, 써요, 씁니다 | 동사 |
| 74 | speak | 말하다 | 말해, 말해요, 말합니다 | 동사 |
| 75 | listen | 듣다 | 들어, 들어요, 듣습니다 | 동사 |
| 76 | play | 놀다 | 놀아, 놀아요, 놉니다 | 동사 |
| 77 | study | 공부하다 | 공부해, 공부해요, 공부합니다 | 동사 |
| 78 | draw | 그리다 | 그려, 그려요, 그립니다 | 동사 |
| 79 | sing | 노래하다 | 노래해, 노래해요, 노래합니다 | 동사 |
| 80 | run | 달리다 | 달려, 달려요, 달립니다 | 동사 |
| 81 | wash | 씻다 | 씻어, 씻어요, 씻습니다 | 동사 |
| 82 | sleep | 자다 | 자, 자요, 잡니다 | 동사 |
| 83 | give | 주다 | 줘, 줘요, 줍니다 | 동사 |
| 84 | receive | 받다 | 받아, 받아요, 받습니다 | 동사 |
| 85 | make | 만들다 | 만들어, 만들어요, 만듭니다 | 동사 |

---

#### F. 일상 형용사 (10개)

| # | ID | 한국어 | 활용형 예시 | 분류 |
|---|-----|--------|------------|------|
| 86 | big | 크다 | 커, 큰, 커요, 큽니다 | 형용사 |
| 87 | small | 작다 | 작아, 작은, 작아요, 작습니다 | 형용사 |
| 88 | hot | 덥다 | 더워, 더운, 더워요, 덥습니다 | 형용사 |
| 89 | cold | 춥다 | 추워, 추운, 추워요, 춥습니다 | 형용사 |
| 90 | pretty | 예쁘다 | 예뻐, 예쁜, 예뻐요, 예쁩니다 | 형용사 |
| 91 | delicious | 맛있다 | 맛있어, 맛있는, 맛있어요 | 형용사 |
| 92 | difficult | 어렵다 | 어려워, 어려운, 어려워요 | 형용사 |
| 93 | easy | 쉽다 | 쉬워, 쉬운, 쉬워요, 쉽습니다 | 형용사 |
| 94 | fast | 빠르다 | 빨라, 빠른, 빨라요, 빠릅니다 | 형용사 |
| 95 | slow | 느리다 | 느려, 느린, 느려요, 느립니다 | 형용사 |

---

#### G. 인사/생활 표현 (5개)

| # | ID | 한국어 | 분류 |
|---|-----|--------|------|
| 96 | hello | 안녕하세요 | 표현 |
| 97 | goodbye | 안녕히 가세요 | 표현 |
| 98 | thanks | 감사합니다 | 표현 |
| 99 | excuse_me | 잠깐만요 | 표현 |
| 100 | congrats | 축하해요 | 표현 |

---

## 4. 예문 카드 상세 규칙

### 4-1. 예문 작성 원칙

모든 100개 단어에 대해 아래 규칙으로 **3개 예문**을 작성:

1. **예문 1 — 1인칭 기본 표현**: "나는 ~해요" 형태의 가장 기본적인 문장
2. **예문 2 — 상황 서술**: 학교에서 일어나는 구체적 상황을 묘사하는 문장
3. **예문 3 — 관계/행동 표현**: 친구나 선생님과의 관계 속에서 쓰는 문장

### 4-2. 예문 길이

- 최소 4어절, 최대 10어절
- 초등학교 1~3학년 수준의 문장 구조
- 존댓말(~요) 기본, 단 친구 간 대화는 반말 허용

### 4-3. 전체 예문 데이터 예시 (10개 단어 분량)

```typescript
export const VOCAB_WORDS: VocabWord[] = [
  // ── 감정 ──
  {
    id: "happy",
    ko: "기쁘다",
    category: "adjective",
    subcategory: "감정",
    level: 1,
    conjugations: ["기뻐", "기쁜", "기뻐요", "기쁩니다", "기뻤어", "기뻤어요"],
    sentences: [
      {
        ko: "상을 받아서 정말 기뻐요.",
        situation: "시상식에서 상을 받았을 때",
        imagePrompt: "A young elementary school student standing on a small stage receiving a certificate/award from a teacher, the child is beaming with joy, other children clapping in background, soft watercolor illustration style, bright warm colors, Korean elementary school auditorium setting, no text"
      },
      {
        ko: "새 친구가 생겨서 기뻐요.",
        situation: "전학생과 처음 친구가 되었을 때",
        imagePrompt: "Two young children shaking hands and smiling brightly in a colorful Korean elementary school classroom, one child appears to be new, both wearing backpacks, soft watercolor illustration style, warm welcoming atmosphere, gentle pastel colors, no text"
      },
      {
        ko: "기쁜 마음으로 노래해요.",
        situation: "음악 시간에 즐겁게 노래할 때",
        imagePrompt: "A group of happy elementary school children singing together in a music classroom, one child in the center singing enthusiastically with a joyful expression, musical notes floating in the air, soft watercolor illustration style, vibrant but gentle colors, no text"
      }
    ],
    imagePrompt: "A simple cheerful smiling face icon, round shape, bright yellow and warm orange tones, soft watercolor style, child-friendly, minimal design, circular frame, no text"
  },

  {
    id: "sad",
    ko: "슬프다",
    category: "adjective",
    subcategory: "감정",
    level: 1,
    conjugations: ["슬퍼", "슬픈", "슬퍼요", "슬픕니다", "슬펐어", "슬펐어요"],
    sentences: [
      {
        ko: "나는 슬퍼요.",
        situation: "기분이 좋지 않을 때 선생님께 말하기",
        imagePrompt: "A young elementary school student sitting at their desk looking sad with a slight frown, soft watercolor illustration style, warm classroom background with colorful decorations, child-friendly Korean school setting, gentle pastel colors, no text"
      },
      {
        ko: "친구가 넘어져서 슬퍼요.",
        situation: "운동장에서 친구가 다쳤을 때",
        imagePrompt: "Two elementary school children in a playground, one child has fallen down and the other child is kneeling beside them looking concerned and sad, soft watercolor illustration style, Korean school playground with trees, gentle pastel colors, no text"
      },
      {
        ko: "슬픈 친구를 도와줘요.",
        situation: "울고 있는 친구를 위로할 때",
        imagePrompt: "A young child gently patting the back of a crying friend sitting on a bench, elementary school hallway background, soft watercolor illustration style, warm and comforting atmosphere, child-friendly, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple sad face icon with a single small tear, round shape, soft blue and pastel tones, watercolor style, child-friendly, minimal design, circular frame, no text"
  },

  {
    id: "friend",
    ko: "친구",
    category: "noun",
    subcategory: "학교생활",
    level: 1,
    conjugations: ["친구가", "친구를", "친구와", "친구의", "친구랑", "친구한테"],
    sentences: [
      {
        ko: "우리 반에 친구가 많아요.",
        situation: "자기소개 시간에 반을 소개할 때",
        imagePrompt: "A diverse group of elementary school children sitting together in a circle on the classroom floor, all smiling and looking friendly, soft watercolor illustration style, colorful Korean elementary classroom, warm lighting, gentle pastel colors, no text"
      },
      {
        ko: "친구와 같이 놀아요.",
        situation: "쉬는 시간에 함께 노는 장면",
        imagePrompt: "Two children playing together happily on a Korean school playground, one pushing the other on a swing, both laughing, soft watercolor illustration style, sunny day, trees and school building in background, gentle pastel colors, no text"
      },
      {
        ko: "새 친구한테 인사해요.",
        situation: "전학 온 친구에게 먼저 다가갈 때",
        imagePrompt: "A child waving hello to a new shy student standing at the classroom door with a backpack, welcoming expression, other children looking curiously, soft watercolor illustration style, warm Korean classroom setting, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "Two simple child silhouettes holding hands, round frame, warm yellow and orange tones, soft watercolor style, child-friendly, minimal design, no text"
  },

  {
    id: "here",
    ko: "여기",
    category: "noun",
    subcategory: "지칭어",
    level: 1,
    conjugations: ["여기요", "여기에", "여기서", "여기는", "여기가"],
    sentences: [
      {
        ko: "선생님, 여기 앉아도 돼요?",
        situation: "자리를 바꾸고 싶을 때 선생님께 질문",
        imagePrompt: "A young student standing next to an empty desk in a classroom, raising hand and pointing to the empty chair, looking at the teacher with a questioning expression, soft watercolor illustration style, Korean elementary classroom, gentle pastel colors, no text"
      },
      {
        ko: "여기에 이름을 써요.",
        situation: "시험지나 활동지에 이름 쓰는 위치를 알려줄 때",
        imagePrompt: "A close-up of a child's hand pointing to a blank name field on a worksheet paper on a desk, pencil in the other hand, soft watercolor illustration style, warm classroom desk surface, gentle pastel colors, no text"
      },
      {
        ko: "여기서 같이 놀자!",
        situation: "운동장에서 친구를 불러 함께 놀자고 할 때",
        imagePrompt: "A child standing in a sunny school playground waving and calling out to friends in the distance, pointing down to the ground where they are standing, soft watercolor illustration style, open playground with equipment, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple hand pointing downward with a small arrow, round frame, warm amber tones, soft watercolor style, child-friendly, minimal design, no text"
  },

  {
    id: "want",
    ko: "원하다",
    category: "verb",
    subcategory: "의사표현",
    level: 1,
    conjugations: ["원해", "원해요", "원합니다", "원하는", "원했어요"],
    sentences: [
      {
        ko: "물을 마시고 싶어요.",
        situation: "목이 마를 때 선생님께 말하기",
        imagePrompt: "A young student raising their hand in class, touching their throat with the other hand indicating thirst, a water bottle visible on the desk, soft watercolor illustration style, Korean elementary classroom, gentle pastel colors, no text"
      },
      {
        ko: "나는 그림 그리기를 원해요.",
        situation: "자유 시간에 하고 싶은 활동을 말할 때",
        imagePrompt: "A child sitting at a desk with art supplies (crayons, colored pencils, paper), eagerly reaching for the crayons with an excited expression, soft watercolor illustration style, art classroom or activity area, gentle pastel colors, no text"
      },
      {
        ko: "같은 모둠이 되고 싶어요.",
        situation: "모둠 활동에서 친구와 같은 팀이 되고 싶을 때",
        imagePrompt: "A child looking hopefully toward a group of children at another desk, with a thought bubble showing them all together in one group, soft watercolor illustration style, Korean classroom with grouped desks, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple star with a small heart inside, round frame, warm pink and gold tones, soft watercolor style, child-friendly, minimal design, no text"
  },

  {
    id: "eat",
    ko: "먹다",
    category: "verb",
    subcategory: "일상동사",
    level: 1,
    conjugations: ["먹어", "먹어요", "먹습니다", "먹는", "먹었어요", "먹고"],
    sentences: [
      {
        ko: "급식을 맛있게 먹어요.",
        situation: "급식 시간에 밥을 먹을 때",
        imagePrompt: "A child sitting in a school cafeteria happily eating Korean school lunch (rice, soup, side dishes) from a metal tray, other children eating at tables nearby, soft watercolor illustration style, bright and cheerful cafeteria, gentle pastel colors, no text"
      },
      {
        ko: "간식 먹고 싶어요.",
        situation: "쉬는 시간에 배가 고플 때",
        imagePrompt: "A child sitting at their desk during break time, looking at a small snack bag with a hopeful expression, touching their tummy, soft watercolor illustration style, Korean elementary classroom during recess, gentle pastel colors, no text"
      },
      {
        ko: "친구랑 같이 먹어요.",
        situation: "점심시간에 친구와 함께 식사할 때",
        imagePrompt: "Two children sitting across from each other at a cafeteria table, both eating from trays and chatting happily, soft watercolor illustration style, Korean school cafeteria background, warm and friendly atmosphere, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple bowl of rice with chopsticks, round frame, warm orange and cream tones, soft watercolor style, child-friendly, minimal design, no text"
  },

  {
    id: "go",
    ko: "가다",
    category: "verb",
    subcategory: "일상동사",
    level: 1,
    conjugations: ["가", "가요", "갑니다", "가는", "갔어요", "갈게요", "가자"],
    sentences: [
      {
        ko: "학교에 가요.",
        situation: "아침에 등교할 때",
        imagePrompt: "A young child with a backpack walking toward a Korean elementary school building entrance in the morning, cherry blossom trees along the path, other children walking ahead, soft watercolor illustration style, bright morning light, gentle pastel colors, no text"
      },
      {
        ko: "화장실에 가도 돼요?",
        situation: "수업 중 화장실에 가고 싶을 때 선생님께 허락 구하기",
        imagePrompt: "A child raising their hand urgently at their desk, looking at the teacher with a requesting expression, a small restroom sign visible near the classroom door, soft watercolor illustration style, Korean elementary classroom, gentle pastel colors, no text"
      },
      {
        ko: "같이 도서관에 가자!",
        situation: "쉬는 시간에 친구에게 도서관 가자고 제안할 때",
        imagePrompt: "Two children walking together down a school hallway toward a library door, one child is excitedly pulling the other's hand, books visible through library window, soft watercolor illustration style, Korean school hallway, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple pair of small shoes with a forward arrow, round frame, warm green and yellow tones, soft watercolor style, child-friendly, minimal design, no text"
  },

  {
    id: "big",
    ko: "크다",
    category: "adjective",
    subcategory: "일상형용사",
    level: 1,
    conjugations: ["커", "큰", "커요", "큽니다", "컸어요"],
    sentences: [
      {
        ko: "우리 학교는 커요.",
        situation: "전학 와서 학교가 크다고 느낄 때",
        imagePrompt: "A small child standing in front of a large Korean elementary school building, looking up at it with wide eyes of amazement, the building appearing grand from the child's perspective, soft watercolor illustration style, sunny day, gentle pastel colors, no text"
      },
      {
        ko: "큰 소리로 읽어요.",
        situation: "국어 시간에 큰 소리로 교과서를 읽을 때",
        imagePrompt: "A child standing at their desk holding a textbook open, reading aloud with mouth open wide, other children listening, a speech volume icon showing loudness, soft watercolor illustration style, Korean elementary classroom, gentle pastel colors, no text"
      },
      {
        ko: "이 종이가 더 커요.",
        situation: "미술 시간에 큰 도화지를 고를 때",
        imagePrompt: "A child holding up two sheets of drawing paper of different sizes, comparing them, pointing to the larger one, art supplies on the desk, soft watercolor illustration style, art classroom setting, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple large circle next to a tiny circle for size comparison, round frame, warm red and orange tones, soft watercolor style, child-friendly, minimal design, no text"
  },

  {
    id: "hello",
    ko: "안녕하세요",
    category: "expression",
    subcategory: "인사",
    level: 1,
    conjugations: ["안녕", "안녕하세요", "안녕하십니까"],
    sentences: [
      {
        ko: "선생님, 안녕하세요!",
        situation: "아침에 교실에 들어가며 선생님께 인사할 때",
        imagePrompt: "A young child bowing slightly with a bright smile at the classroom door, greeting the teacher who is standing nearby with a warm smile, morning sunlight coming through windows, soft watercolor illustration style, Korean elementary classroom entrance, gentle pastel colors, no text"
      },
      {
        ko: "새 친구에게 안녕! 하고 인사해요.",
        situation: "전학 온 친구에게 처음 인사할 때",
        imagePrompt: "A child waving cheerfully at a new student who just entered the classroom, the new student looking slightly shy but smiling back, other children watching with curiosity, soft watercolor illustration style, welcoming classroom atmosphere, gentle pastel colors, no text"
      },
      {
        ko: "안녕하세요, 저는 ○○○이에요.",
        situation: "자기소개 시간에 앞에 나가서 인사하며 이름을 말할 때",
        imagePrompt: "A child standing at the front of the classroom facing other seated students, one hand raised in a wave, introducing themselves with a confident but slightly nervous smile, soft watercolor illustration style, Korean elementary classroom with blackboard, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple waving hand icon, round frame, warm yellow and sky blue tones, soft watercolor style, child-friendly, minimal design, no text"
  },

  {
    id: "toilet",
    ko: "화장실",
    category: "noun",
    subcategory: "학교생활",
    level: 1,
    conjugations: ["화장실에", "화장실이", "화장실을", "화장실은"],
    sentences: [
      {
        ko: "화장실에 가고 싶어요.",
        situation: "수업 중 급하게 화장실에 가야 할 때",
        imagePrompt: "A child at their desk raising one hand with an urgent expression, other hand on tummy, looking toward the teacher, a small clock on the wall showing class time, soft watercolor illustration style, Korean elementary classroom, gentle pastel colors, no text"
      },
      {
        ko: "화장실이 어디에 있어요?",
        situation: "처음 온 학교에서 화장실 위치를 물을 때",
        imagePrompt: "A child standing in a school hallway looking around with a confused expression, asking an older student who is pointing down the hallway toward a restroom sign, soft watercolor illustration style, Korean school hallway with doors, gentle pastel colors, no text"
      },
      {
        ko: "화장실을 깨끗하게 써요.",
        situation: "학교 규칙을 배울 때",
        imagePrompt: "A child washing hands at a sink in a clean school restroom, soap dispenser and paper towels visible, a small poster about cleanliness on the wall, soft watercolor illustration style, clean bright restroom, gentle pastel colors, no text"
      }
    ],
    imagePrompt: "A simple restroom door sign icon, round frame, clean blue and white tones, soft watercolor style, child-friendly, minimal design, no text"
  }
];
```

> **나머지 90개 단어도 동일한 구조와 품질로 작성한다.** 각 단어마다 학교 상황에 맞는 3개 예문 + 예문별 이미지 프롬프트 + 단어 대표 이미지 프롬프트를 포함.

---

## 5. UI 컴포넌트 설계

### 5-1. VocabHub.tsx — 메인 화면

```
┌─────────────────────────────────────────┐
│  ← 뒤로    📚 단어 카드    🏆 32/100    │  ← 헤더 (학습한 단어 수 / 전체)
├─────────────────────────────────────────┤
│  [오늘의 단어]  [단어장]                 │  ← 탭 2개
├─────────────────────────────────────────┤
│                                         │
│  🔍 소통창에서 찾은 단어                 │  ← 섹션 제목
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ 😊   │ │ 😢   │ │ 👫   │            │  ← 추출된 단어 카드 가로 스크롤
│  │기쁘다│ │슬프다│ │친구  │            │
│  │ ★★★ │ │ ★★☆ │ │ ★★★ │            │  ← 관련도 표시
│  └──────┘ └──────┘ └──────┘            │
│                                         │
│  📖 오늘 배울 단어                      │  ← 미학습 단어 추천 (5개)
│  ┌─────────────────────────────┐       │
│  │  😊 기쁘다                   │       │  ← 터치하면 카드 학습 진입
│  │  "상을 받아서 정말 기뻐요"    │       │
│  │  ○ ○ ○  (예문 3개 진행도)    │       │
│  └─────────────────────────────┘       │
│  ┌─────────────────────────────┐       │
│  │  😢 슬프다                   │       │
│  │  "나는 슬퍼요"               │       │
│  │  ○ ○ ○                      │       │
│  └─────────────────────────────┘       │
│                 ...                     │
│                                         │
│  ┌─────────────────────────────┐       │
│  │  🎲 랜덤 단어 5개 뽑기       │       │  ← 소통창 없어도 학습 가능
│  └─────────────────────────────┘       │
└─────────────────────────────────────────┘
```

### 5-2. VocabCard.tsx — 단어 카드 (학습 모드)

단어를 터치하면 전체 화면 카드 학습 모드 진입:

```
┌─────────────────────────────────────────┐
│  ← 뒤로         1 / 3                   │  ← 예문 인덱스
├─────────────────────────────────────────┤
│                                         │
│         ┌───────────────────┐           │
│         │                   │           │
│         │   [예문 일러스트]   │           │  ← 이미지 (생성 or 플레이스홀더)
│         │                   │           │
│         └───────────────────┘           │
│                                         │
│     ╔═══════════════════════════╗       │
│     ║                           ║       │
│     ║   상을 받아서 정말 기뻐요.   ║       │  ← 한국어 예문 (큰 글씨)
│     ║                           ║       │
│     ╚═══════════════════════════╝       │
│                                         │
│     🔊 I'm so happy to receive         │  ← 모국어 번역 (터치로 표시/숨기기)
│         an award.                       │
│                                         │
│     📍 시상식에서 상을 받았을 때          │  ← 상황 설명 (모국어 번역)
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  👂      │ │  🎤      │ │  ✏️      │  │
│  │  듣기    │ │  말하기   │ │  쓰기   │  │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│        ◀ 이전        다음 ▶             │
│                                         │
└─────────────────────────────────────────┘
```

### 5-3. 듣기/말하기/쓰기 모드 상세

#### 👂 듣기 모드
```
┌─────────────────────────────────────┐
│  상을 받아서 정말 기뻐요.             │  ← 예문 표시
│                                     │
│         ┌──────────────┐            │
│         │   🔊 듣기     │            │  ← TTS 재생 (기존 /api/tts 사용)
│         └──────────────┘            │
│                                     │
│  재생 속도: [느리게] [보통] [빠르게]   │  ← 속도 조절
│                                     │
│  📝 따라 읽어 보세요!                │
│                                     │
│  [✓ 들었어요!]                       │  ← 완료 버튼 → listenCount++
└─────────────────────────────────────┘
```

#### 🎤 말하기 모드
```
┌─────────────────────────────────────┐
│  상을 받아서 정말 기뻐요.             │  ← 예문 표시
│                                     │
│  🔊 먼저 들어보기                    │  ← 원어민 TTS 재생
│                                     │
│         ┌──────────────┐            │
│         │   🎙️ 녹음     │            │  ← 녹음 시작 (MediaRecorder API)
│         │  (터치해서     │            │
│         │   녹음 시작)   │            │
│         └──────────────┘            │
│                                     │
│  녹음 중... ●━━━━━━━━━━ 0:03        │  ← 녹음 진행 표시
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ 🔊 원본   │  │ 🔊 내 녹음 │        │  ← 비교 재생
│  └──────────┘  └──────────┘        │
│                                     │
│  [다시 녹음]    [✓ 완료!]            │  ← speakCount++, 녹음 저장
└─────────────────────────────────────┘
```

**녹음 기술 스택:**
```typescript
// VocabRecorder.tsx 핵심 로직
const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
// 녹음 완료 → Blob → Firebase Storage 업로드
// 경로: recordings/{roomCode}/{clientId}/{wordId}_{sentenceIdx}.webm
// 재생: new Audio(URL.createObjectURL(blob)) 또는 Storage URL
```

#### ✏️ 쓰기 모드
```
┌─────────────────────────────────────┐
│  상을 받아서 정말 기뻐요.             │  ← 예문 표시 (3초 후 숨김)
│                                     │
│  아래에 따라 써 보세요:               │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │  ← 텍스트 입력 필드
│  │  (여기에 예문을 따라 쓰세요)  │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─── 또는 ───                       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │  ← 손글씨 캔버스 (DrawingCanvas 재사용)
│  │   [손으로 써 보기 캔버스]     │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [정답 보기]    [✓ 다 썼어요!]       │  ← writeCount++
└─────────────────────────────────────┘
```

### 5-4. VocabNotebook.tsx — 단어장 탭

```
┌─────────────────────────────────────────┐
│  📗 내 단어장                 정렬: 최신순 │
├─────────────────────────────────────────┤
│  🏆 학습 현황                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 32%      │
│  32 / 100 단어 완료                      │
│  🐝 스티커: 6개 획득                     │
├─────────────────────────────────────────┤
│                                         │
│  ✅ 기쁘다  ★★★  4/20 학습              │  ← 완료 (3예문 모두)
│     👂3 🎤2 ✏️3                         │     듣기/말하기/쓰기 횟수
│                                         │
│  ✅ 슬프다  ★★☆  4/19 학습              │
│     👂2 🎤1 ✏️3                         │
│                                         │
│  🔄 친구   ★★★  4/20 학습 중            │  ← 진행 중 (1-2예문 완료)
│     👂1 🎤0 ✏️1  [예문 2/3]             │
│                                         │
│  🔄 여기   ★☆☆  4/18 학습 중            │
│     👂1 🎤0 ✏️0  [예문 1/3]             │
│                                         │
│  ─── 아직 안 배운 단어 (68개) ───        │
│  ○ 원하다  ○ 먹다  ○ 가다  ...          │
│                                         │
│  [녹음 모아듣기 🎧]                      │  ← 내 녹음 전체 재생
└─────────────────────────────────────────┘
```

---

## 6. 스티커 연동 알고리즘

### 6-1. 보상 규칙

기존 PraiseHive 스티커 시스템과 연동. 교사가 수동으로 주는 것이 아니라 **자동 지급**.

```typescript
// lib/vocabRewards.ts

interface VocabRewardRule {
  id: string;
  condition: string;
  stickerType: StickerType;   // 기존 타입 재사용
  description: string;
}

export const VOCAB_REWARD_RULES: VocabRewardRule[] = [
  // ── 단어 수 기반 ──
  {
    id: "first_word",
    condition: "totalWordsStudied >= 1",
    stickerType: "curious",           // 호기심
    description: "첫 단어를 배웠어요!"
  },
  {
    id: "words_5",
    condition: "totalWordsStudied >= 5",
    stickerType: "persistent",        // 꾸준함
    description: "5개 단어를 배웠어요!"
  },
  {
    id: "words_10",
    condition: "totalWordsStudied >= 10",
    stickerType: "persistent",
    description: "10개 단어 달성!"
  },
  {
    id: "words_25",
    condition: "totalWordsStudied >= 25",
    stickerType: "brave",             // 용감함
    description: "25개 단어 돌파!"
  },
  {
    id: "words_50",
    condition: "totalWordsStudied >= 50",
    stickerType: "cooperative",       // 협동
    description: "반 이상 완료! 50개 단어!"
  },
  {
    id: "words_100",
    condition: "totalWordsStudied >= 100",
    stickerType: "creative",          // 창의력
    description: "모든 단어 마스터! 🎉"
  },

  // ── 녹음 기반 ──
  {
    id: "first_recording",
    condition: "totalRecordings >= 1",
    stickerType: "brave",
    description: "처음으로 녹음했어요!"
  },
  {
    id: "recordings_10",
    condition: "totalRecordings >= 10",
    stickerType: "brave",
    description: "10번 녹음 완료!"
  },
  {
    id: "recordings_30",
    condition: "totalRecordings >= 30",
    stickerType: "persistent",
    description: "30번 녹음! 발음 천재!"
  },

  // ── 연속 학습 (streak) ──
  {
    id: "streak_3",
    condition: "streak >= 3",
    stickerType: "persistent",
    description: "3일 연속 학습!"
  },
  {
    id: "streak_7",
    condition: "streak >= 7",
    stickerType: "helpful",           // 도움
    description: "일주일 연속 학습! 대단해요!"
  },

  // ── 예문 완료 기반 ──
  {
    id: "sentences_15",
    condition: "totalSentencesDone >= 15",
    stickerType: "curious",
    description: "15개 예문 완료!"
  },
  {
    id: "sentences_50",
    condition: "totalSentencesDone >= 50",
    stickerType: "creative",
    description: "50개 예문 달성!"
  }
];
```

### 6-2. 자동 지급 로직

```typescript
// 학습 완료 시마다 호출
async function checkAndAwardStickers(
  roomCode: string,
  clientId: string,
  stats: VocabStats
): Promise<AwardedSticker | null> {
  // 1. 이미 받은 스티커 목록 조회
  const awarded = await getAwardedVocabStickers(roomCode, clientId);

  // 2. 조건 충족 & 미지급 스티커 찾기
  for (const rule of VOCAB_REWARD_RULES) {
    if (awarded.includes(rule.id)) continue;
    if (evaluateCondition(rule.condition, stats)) {
      // 3. 스티커 지급 (기존 giveIndividualSticker 재사용)
      await giveIndividualSticker(
        roomCode,
        clientId,
        rule.stickerType,
        "단어카드 봇",         // fromTeacherName
        "vocab-bot"            // fromTeacherId (시스템 자동)
      );
      // 4. 지급 기록 저장
      await markVocabStickerAwarded(roomCode, clientId, rule.id);
      return { rule, sticker: rule.stickerType };
    }
  }
  return null;
}
```

### 6-3. Firebase 경로

```
rooms/{roomCode}/vocab/
  rewards/{clientId}/
    {ruleId}: true              ← 지급 완료된 보상 ID
```

---

## 7. 녹음 및 재생 시스템

### 7-1. VocabRecorder.tsx 컴포넌트

```typescript
interface VocabRecorderProps {
  wordId: string;
  sentenceIdx: number;        // 0, 1, 2
  sentenceText: string;       // 한국어 예문
  roomCode: string;
  clientId: string;
  onComplete: () => void;     // 녹음 완료 콜백
}

// 핵심 기능:
// 1. MediaRecorder API로 브라우저 녹음
// 2. 녹음 Blob → Firebase Storage 업로드
// 3. 저장된 녹음 URL을 Firebase RTDB에 기록
// 4. "내 녹음 듣기" + "원본 듣기" 비교 재생
// 5. 재녹음 지원 (기존 녹음 덮어쓰기)
```

### 7-2. 녹음 저장 경로

```
Firebase Storage:
  vocab-recordings/{roomCode}/{clientId}/{wordId}_{sentenceIdx}.webm

Firebase RTDB:
  rooms/{roomCode}/vocab/recordings/{clientId}/{wordId}_{sentenceIdx}/
    audioUrl: string
    timestamp: number
    duration: number
```

### 7-3. 이전 녹음 재생

단어장 탭에서 "녹음 모아듣기" 기능:
- 학습한 모든 예문의 녹음을 순서대로 재생
- 원본 TTS → 내 녹음 → 다음 예문 순서로 교차 재생
- 재생/일시정지/다음 컨트롤

---

## 8. 번역 연동

각 단어와 예문은 학생의 모국어로 자동 번역되어야 합니다.

### 8-1. 번역 시점

- **사전 번역 (빌드 타임)**: 100개 단어 × 3예문 × 15언어 = 4,500개 번역은 비현실적
- **온디맨드 번역 (런타임)**: 학생이 카드를 열 때 해당 언어로 번역 요청
- **캐싱**: 번역 결과를 Firebase에 캐시하여 같은 언어 학생은 재요청 불필요

### 8-2. Firebase 번역 캐시

```
rooms/{roomCode}/vocab/
  translations/{wordId}/
    word/{langCode}: string              ← 단어 번역
    sentence_0/{langCode}: string        ← 예문1 번역
    sentence_1/{langCode}: string        ← 예문2 번역
    sentence_2/{langCode}: string        ← 예문3 번역
    situation_0/{langCode}: string       ← 상황설명1 번역
    situation_1/{langCode}: string       ← 상황설명2 번역
    situation_2/{langCode}: string       ← 상황설명3 번역
```

### 8-3. 번역 API 호출

기존 `/api/translate` 엔드포인트의 "comment" 모드를 확장하거나, 별도 경량 엔드포인트 `/api/vocab-translate` 생성:

```typescript
// POST /api/vocab-translate
{
  texts: [                       // 배치 번역
    { key: "word", text: "기쁘다" },
    { key: "s0", text: "상을 받아서 정말 기뻐요." },
    { key: "s1", text: "새 친구가 생겨서 기뻐요." },
    { key: "s2", text: "기쁜 마음으로 노래해요." },
    { key: "sit0", text: "시상식에서 상을 받았을 때" },
    { key: "sit1", text: "전학생과 처음 친구가 되었을 때" },
    { key: "sit2", text: "음악 시간에 즐겁게 노래할 때" }
  ],
  targetLang: "vi",              // 학생 모국어
  roomCode: "1234"
}
```

---

## 9. 이미지 생성 프롬프트 스타일 가이드

### 9-1. 공통 스타일 프리픽스

모든 이미지 프롬프트에 아래 스타일 지시를 공통으로 적용:

```
Style prefix (모든 프롬프트 앞에 자동 추가):
"Soft watercolor illustration style, child-friendly, gentle pastel colors,
 Korean elementary school setting, warm and safe atmosphere,
 diverse children of different ethnicities, age 7-9 years old,
 simple clean composition, no text or letters in the image,
 16:9 aspect ratio, suitable for educational flashcard"
```

### 9-2. 카테고리별 이미지 특성

| 카테고리 | 배경 | 주요 요소 | 색상 톤 |
|---------|------|----------|---------|
| 감정 | 교실/운동장 | 표정이 뚜렷한 아이 1-2명 | 감정에 맞는 색 (기쁨=노랑, 슬픔=파랑 등) |
| 지칭어 | 교실/복도 | 손가락으로 가리키는 제스처 | 중립적 따뜻한 색 |
| 의사표현 | 교실 | 아이와 선생님/친구 대화 장면 | 밝고 활기찬 색 |
| 학교 명사 | 해당 장소/사물 | 사물이 중심, 아이가 사용하는 모습 | 사물의 자연색 |
| 일상 동사 | 행동이 일어나는 장소 | 동작 중인 아이 | 동적이고 밝은 색 |
| 일상 형용사 | 비교가 보이는 장면 | 대비되는 두 상황 | 형용사 느낌의 색 |
| 인사/표현 | 교실 입구/복도 | 인사하는 아이들 | 따뜻한 노랑/주황 |

### 9-3. 단어 아이콘 프롬프트 형식

```
"A simple [object/symbol] icon, round circular frame,
 [2-3 color descriptors] tones, soft watercolor style,
 child-friendly, minimal design, white background, no text"
```

### 9-4. 예문 장면 프롬프트 형식

```
"[Scene description with 1-2 children doing specific action],
 [specific location in Korean elementary school],
 [emotional atmosphere],
 soft watercolor illustration style,
 diverse children, age 7-9,
 gentle pastel colors, no text"
```

---

## 10. 에듀테크 품질 검토 체크리스트

구현 완료 후 아래 항목을 검토 에이전트로 평가:

### 10-1. 교육 설계 (Instructional Design)

- [ ] **학습 목표 명확성**: 각 카드가 하나의 어휘에 집중하는가
- [ ] **스캐폴딩**: 듣기 → 말하기 → 쓰기 순서의 난이도 증가 구조
- [ ] **반복 학습**: 같은 단어를 3개 예문으로 다른 맥락에서 반복
- [ ] **즉각적 피드백**: 완료 시 시각/청각 피드백 (체크마크, 효과음)
- [ ] **모국어 지원**: 번역이 학습 보조 도구로 적절히 활용되는가
- [ ] **맥락 학습**: 예문이 실제 학교생활에서 사용 가능한 상황인가

### 10-2. UX/접근성 (Accessibility)

- [ ] **터치 타겟**: 모든 버튼 최소 44×44px (모바일 WCAG 기준)
- [ ] **글꼴 크기**: 본문 최소 18px, 예문 22px 이상 (기존 TYPE 스케일 준수)
- [ ] **색상 대비**: WCAG AA 기준 4.5:1 이상
- [ ] **키보드 접근**: Tab 네비게이션 지원
- [ ] **로딩 상태**: 번역/녹음 중 스켈레톤 또는 스피너 표시
- [ ] **에러 복구**: 녹음 실패, 번역 실패 시 재시도 가능
- [ ] **오프라인 대응**: 이전 학습 기록은 localStorage에도 백업

### 10-3. 기술 안정성 (Technical Robustness)

- [ ] **Firebase 구독 패턴**: CLAUDE.md의 "첫 fire에만 draft 시딩" 패턴 준수
- [ ] **낙관적 UI**: 학습 완료 마킹은 즉시 반영, Firebase 쓰기는 백그라운드
- [ ] **녹음 권한**: `getUserMedia` 권한 거부 시 graceful 처리
- [ ] **메모리 관리**: 녹음 Blob, Audio 객체 적절히 해제
- [ ] **동시성**: 같은 학생이 여러 탭에서 학습해도 데이터 충돌 없음
- [ ] **TypeScript**: 모든 새 파일 strict 타입, 기존 types.ts 확장

### 10-4. 게이미피케이션 (Gamification)

- [ ] **진행도 시각화**: 진행 바, 숫자 카운터, 체크마크
- [ ] **보상 간격**: 스티커가 너무 자주/드물지 않게 (5, 10, 25, 50, 100 단어 간격)
- [ ] **축하 애니메이션**: 스티커 획득 시 축하 모달 (기존 StickerGiveModal 스타일)
- [ ] **소셜 비교**: 단어장에서 "반 평균 학습 단어 수" 표시 (선택적)
- [ ] **리텐션**: 3일 이상 미학습 시 HomeHub에 리마인더 뱃지

### 10-5. 데이터 보호 (Privacy)

- [ ] **녹음 데이터**: 방 내부에서만 접근, 다른 학생 녹음 접근 불가
- [ ] **학습 기록**: 본인 + 교사만 열람 가능
- [ ] **Firebase Rules**: vocab/ 경로에 적절한 read/write 규칙
- [ ] **녹음 삭제**: 시즌 리셋 시 녹음 파일도 함께 정리

---

## 11. 구현 순서 (권장)

```
Phase 1 — 데이터 & 코어 (2-3일)
  ├── lib/vocabWords.ts         ← 100개 단어 + 300개 예문 데이터
  ├── lib/vocabUtils.ts         ← 어휘 추출/매칭 유틸
  ├── lib/vocabRewards.ts       ← 스티커 보상 규칙
  └── lib/types.ts 확장         ← VocabWord, VocabProgress 등 타입

Phase 2 — API (1-2일)
  ├── app/api/vocab-extract/route.ts   ← Groq LLM 어휘 추출
  └── app/api/vocab-translate/route.ts ← 배치 번역 + 캐싱

Phase 3 — UI 컴포넌트 (3-4일)
  ├── components/VocabHub.tsx           ← 메인 (탭 구조)
  ├── components/VocabCard.tsx          ← 단어 카드 학습
  ├── components/VocabSentenceCard.tsx  ← 예문 카드 (듣기/말하기/쓰기)
  ├── components/VocabRecorder.tsx      ← 녹음/재생
  └── components/VocabNotebook.tsx      ← 단어장

Phase 4 — 통합 (1-2일)
  ├── HomeHub.tsx 수정          ← 5번째 섹션 카드 추가
  ├── [roomCode]/page.tsx 수정  ← hubView 라우팅
  └── 스티커 자동 지급 연동

Phase 5 — 검토 & 폴리시 (1-2일)
  ├── 에듀테크 체크리스트 검증
  ├── 모바일 반응형 테스트
  └── npm run build 통과 확인
```

---

## 12. 참고: 기존 코드 패턴 준수사항

1. **스타일**: 인라인 style 객체 사용 (이 프로젝트는 CSS 모듈/Tailwind 미사용)
2. **색상**: `HONEY` 팔레트 + `CARD_PALETTES` 활용, 새 기능은 보라색 계열(`#8B5CF6`)
3. **타이포**: `TYPE` 상수의 fontSize/fontWeight 준수 (본문 18px, 버튼 20px)
4. **Firebase**: `onValue` 구독 시 `useRef(false)` 플래그로 첫 fire 시딩 패턴
5. **낙관적 UI**: 저장 → UI 즉시 반영 → Firebase 백그라운드 쓰기
6. **Toast**: `components/Toast.tsx` 재사용 (success/error tone)
7. **모달**: 바텀시트 스타일, max-width 560px, 슬라이드업 애니메이션
8. **TTS**: 기존 `speakText()` 패턴 — Web Speech API 우선, `/api/tts` 폴백
9. **STT**: 기존 `/api/stt` (Groq Whisper) 사용
10. **빌드**: 기능 추가 후 반드시 `npm run build` 통과 확인
