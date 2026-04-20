// 자동 생성됨 — scripts/generate-vocab.mjs
// 생성일: 2026-04-20T06:26:47.719Z
// 모델: gemini-2.5-flash-lite

export interface SentenceCard {
  ko: string;
  situation: string;
  imagePrompt: string;
}

export interface VocabWord {
  id: string;
  ko: string;
  category: "noun" | "adjective" | "verb" | "expression";
  subcategory: string;
  level: 1 | 2 | 3;
  conjugations: string[];
  sentences: [SentenceCard, SentenceCard, SentenceCard];
  imagePrompt: string;
}

export const VOCAB_WORDS: VocabWord[] = [
  {
    "id": "happy",
    "ko": "기쁘다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "기뻐요",
      "기쁩니다",
      "기쁜",
      "기뻤어요",
      "기뻐서"
    ],
    "sentences": [
      {
        "ko": "오늘 시험을 잘 봐서 정말 기뻐요.",
        "situation": "시험을 잘 본 것에 대한 기쁨 표현",
        "imagePrompt": "A young Korean elementary school student smiling brightly, holding a good test paper, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 생일 선물을 줘서 마음이 기뻤어요.",
        "situation": "친구에게 받은 선물에 대한 기쁨 표현",
        "imagePrompt": "A group of Korean elementary school children exchanging gifts, one child receiving a present with a big smile, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 칭찬해 주셔서 아주 기뻤습니다.",
        "situation": "선생님께 칭찬을 들었을 때의 기쁨 표현",
        "imagePrompt": "A Korean elementary school teacher praising a student, the student looking happy and proud, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple smiling face icon, round frame, yellow and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "sad",
    "ko": "슬프다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "슬퍼요",
      "슬픕니다",
      "슬픈",
      "슬펐어요",
      "슬퍼서"
    ],
    "sentences": [
      {
        "ko": "친구가 전학 가서 나는 슬퍼요.",
        "situation": "친구가 전학 가서 느끼는 슬픔 표현",
        "imagePrompt": "A young Korean elementary school student looking down with a sad expression, a school bus in the background, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "숙제를 잃어버려서 너무 슬펐어요.",
        "situation": "숙제를 잃어버린 것에 대한 슬픔 표현",
        "imagePrompt": "A Korean elementary school student searching for a lost notebook on the floor, a sad expression on their face, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "혼자 집에 가는 길에 슬퍼요.",
        "situation": "혼자 집에 가는 길에 느끼는 슬픔 표현",
        "imagePrompt": "A solitary Korean elementary school student walking home alone with a sad expression, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple crying face icon, round frame, blue and gray tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "angry",
    "ko": "화나다",
    "category": "verb",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "화나요",
      "화납니다",
      "화나는",
      "화났어요",
      "화나서"
    ],
    "sentences": [
      {
        "ko": "친구가 내 장난감을 망가뜨려서 화나요.",
        "situation": "친구가 장난감을 망가뜨렸을 때 느끼는 분노 표현",
        "imagePrompt": "A Korean elementary school student with a frustrated expression, looking at a broken toy, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "내 간식을 누가 먹어서 화났어요.",
        "situation": "자신의 간식을 누가 먹었을 때 느끼는 분노 표현",
        "imagePrompt": "A Korean elementary school student with an angry face, pointing at an empty snack bag, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님 말씀을 안 들어서 화가 났습니다.",
        "situation": "규칙을 어기거나 말을 듣지 않아 생긴 분노 표현",
        "imagePrompt": "A Korean elementary school student looking upset and a bit defiant, with a teacher in the background, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple angry face icon, round frame, red and dark orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "scared",
    "ko": "무섭다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "무서워요",
      "무섭습니다",
      "무서운",
      "무서웠어요",
      "무서워서"
    ],
    "sentences": [
      {
        "ko": "밤에 혼자 있으면 좀 무서워요.",
        "situation": "밤에 혼자 있을 때 느끼는 두려움 표현",
        "imagePrompt": "A young Korean elementary school student looking a little scared in a dimly lit room, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "큰 개가 짖어서 무서웠어요.",
        "situation": "큰 개를 보고 느낀 두려움 표현",
        "imagePrompt": "A Korean elementary school student holding onto a friend's arm, looking at a barking dog, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "천둥소리가 나서 무섭습니다.",
        "situation": "천둥소리를 듣고 느끼는 두려움 표현",
        "imagePrompt": "A Korean elementary school classroom with children looking a bit nervous as thunder sounds outside, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple scared face icon with wide eyes, round frame, purple and dark blue tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "fun",
    "ko": "재미있다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "재미있어요",
      "재미있습니다",
      "재미있는",
      "재미있었어요",
      "재미있어서"
    ],
    "sentences": [
      {
        "ko": "친구들과 노는 것은 정말 재미있어요.",
        "situation": "친구들과 노는 것에 대한 즐거움 표현",
        "imagePrompt": "A group of Korean elementary school children laughing and playing together in a playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "오늘 체육 시간은 아주 재미있었어요.",
        "situation": "체육 시간에 있었던 즐거운 경험 표현",
        "imagePrompt": "Korean elementary school students actively participating in a fun sports activity during physical education class, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 재미있는 이야기를 들려주셨어요.",
        "situation": "선생님이 들려준 재미있는 이야기에 대한 감상 표현",
        "imagePrompt": "A Korean elementary school teacher telling an engaging story to attentive students, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple smiling face with a star, round frame, bright yellow and pink tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "boring",
    "ko": "지루하다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 2,
    "conjugations": [
      "지루해요",
      "지루합니다",
      "지루한",
      "지루했어요",
      "지루해서"
    ],
    "sentences": [
      {
        "ko": "오늘 수학 시간이 조금 지루해요.",
        "situation": "수학 시간에 느끼는 지루함 표현",
        "imagePrompt": "A Korean elementary school student looking bored in a math class, doodling in a notebook, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "비가 와서 밖에 나가지 못하니 지루했어요.",
        "situation": "비 때문에 밖에 나가지 못해 느끼는 지루함 표현",
        "imagePrompt": "A Korean elementary school student looking out the window at the rain, feeling bored inside the classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "똑같은 공부만 해서 지루합니다.",
        "situation": "반복적인 학습에 대한 지루함 표현",
        "imagePrompt": "A Korean elementary school student with a bored expression, surrounded by textbooks, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple clock icon with a yawn, round frame, light gray and dull brown tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "lonely",
    "ko": "외롭다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 2,
    "conjugations": [
      "외로워요",
      "외롭습니다",
      "외로운",
      "외로웠어요",
      "외로워서"
    ],
    "sentences": [
      {
        "ko": "친구가 없어서 혼자 있으면 외로워요.",
        "situation": "친구가 없을 때 느끼는 외로움 표현",
        "imagePrompt": "A single Korean elementary school student sitting alone on a playground bench, looking sad, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "모두 친구와 같이 놀아서 나만 외로웠어요.",
        "situation": "다른 친구들이 모두 짝지어 놀 때 느끼는 외로움 표현",
        "imagePrompt": "A Korean elementary school student standing apart from a group of friends playing together, looking lonely, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "집에 혼자 있어서 외롭습니다.",
        "situation": "집에 혼자 있을 때 느끼는 외로움 표현",
        "imagePrompt": "A Korean elementary school student sitting alone at a table in an empty house, looking lonely, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple single cloud icon, round frame, light blue and gray tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "proud",
    "ko": "자랑스럽다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 2,
    "conjugations": [
      "자랑스러워요",
      "자랑스럽습니다",
      "자랑스러운",
      "자랑스러웠어요",
      "자랑스러워서"
    ],
    "sentences": [
      {
        "ko": "내가 그린 그림이 상을 타서 자랑스러워요.",
        "situation": "자신의 그림이 상을 받았을 때 느끼는 자랑스러움 표현",
        "imagePrompt": "A Korean elementary school student proudly holding up a certificate and a drawing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "동생이 공부를 잘하게 되어 자랑스러웠어요.",
        "situation": "동생의 성과에 대해 느끼는 자랑스러움 표현",
        "imagePrompt": "An older Korean elementary school student smiling proudly at their younger sibling who is showing good grades, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 반이 운동회에서 이겨서 자랑스럽습니다.",
        "situation": "반 친구들과 함께 이룬 성과에 대한 자랑스러움 표현",
        "imagePrompt": "A group of Korean elementary school students cheering and celebrating a victory at a sports day event, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple star with a medal icon, round frame, gold and bright yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "sorry",
    "ko": "미안하다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "미안해요",
      "미안합니다",
      "미안한",
      "미안했어요",
      "미안해서"
    ],
    "sentences": [
      {
        "ko": "제가 실수로 물건을 떨어뜨려서 미안해요.",
        "situation": "실수로 물건을 떨어뜨렸을 때 사과하는 표현",
        "imagePrompt": "A Korean elementary school student bowing apologetically after dropping a stack of books, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 아파서 놀지 못하게 해서 미안했어요.",
        "situation": "친구와 놀지 못하게 된 상황에 대한 미안함 표현",
        "imagePrompt": "A Korean elementary school student holding a toy and looking apologetically at a friend who is sick in bed, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께 늦어서 미안하다고 말했습니다.",
        "situation": "늦은 것에 대해 선생님께 사과하는 표현",
        "imagePrompt": "A Korean elementary school student apologizing to a teacher for being late, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple bowed head icon with a tear, round frame, light blue and soft gray tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "thankful",
    "ko": "고맙다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "고마워요",
      "고맙습니다",
      "고마운",
      "고마웠어요",
      "고마워서"
    ],
    "sentences": [
      {
        "ko": "선생님께서 도와주셔서 정말 고마워요.",
        "situation": "선생님의 도움에 대한 감사 표현",
        "imagePrompt": "A Korean elementary school student smiling and thanking a teacher who is helping them with their homework, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 내 물건을 찾아줘서 고마웠어요.",
        "situation": "친구가 잃어버린 물건을 찾아줬을 때의 감사 표현",
        "imagePrompt": "A Korean elementary school student receiving a lost item back from a friend with a grateful smile, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "엄마가 맛있는 저녁을 해주셔서 고맙습니다.",
        "situation": "부모님의 수고에 대한 감사 표현",
        "imagePrompt": "A Korean elementary school student happily eating dinner prepared by their parent, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple heart icon with a handshake, round frame, warm pink and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "worried",
    "ko": "걱정되다",
    "category": "verb",
    "subcategory": "감정",
    "level": 2,
    "conjugations": [
      "걱정돼요",
      "걱정됩니다",
      "걱정하는",
      "걱정했어요",
      "걱정될 거예요",
      "걱정돼"
    ],
    "sentences": [
      {
        "ko": "내일 시험 때문에 조금 걱정돼요.",
        "situation": "학생이 내일 있을 시험에 대해 걱정하는 상황",
        "imagePrompt": "A child looking slightly worried, holding a textbook, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 아프다고 해서 걱정돼서 전화했어요.",
        "situation": "학생이 아픈 친구를 걱정하며 전화를 거는 상황",
        "imagePrompt": "A child on the phone with a worried expression, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제가 숙제를 잃어버려서 걱정돼요.",
        "situation": "학생이 숙제를 잃어버려 선생님께 걱정하는 마음을 표현하는 상황",
        "imagePrompt": "A child talking to a teacher with a worried expression, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple worried face icon, round frame, muted blue and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "excited",
    "ko": "신나다",
    "category": "verb",
    "subcategory": "감정",
    "level": 1,
    "conjugations": [
      "신나요",
      "신납니다",
      "신나는",
      "신났어요",
      "신날 거예요",
      "신나"
    ],
    "sentences": [
      {
        "ko": "내일 현장 학습 가서 정말 신나요!",
        "situation": "학생이 내일 있을 현장 학습에 대한 기대감으로 신나는 상황",
        "imagePrompt": "A child jumping with excitement, holding a backpack, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "새로운 장난감을 받아서 너무 신나서 소리 질렀어요.",
        "situation": "학생이 새 장난감을 받고 기뻐하며 소리를 지르는 상황",
        "imagePrompt": "A child cheering and holding a new toy, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구들과 함께 게임을 하니 정말 신나요!",
        "situation": "학생이 친구들과 함께 게임을 하며 즐거워하는 상황",
        "imagePrompt": "Children playing a game together with excited expressions, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple excited face with stars icon, round frame, bright yellow and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "shy",
    "ko": "부끄럽다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 2,
    "conjugations": [
      "부끄러워요",
      "부끄럽습니다",
      "부끄러운",
      "부끄러웠어요",
      "부끄러울 거예요",
      "부끄러워"
    ],
    "sentences": [
      {
        "ko": "칭찬을 받으니 얼굴이 빨개져서 부끄러워요.",
        "situation": "학생이 칭찬을 듣고 쑥스러워하는 상황",
        "imagePrompt": "A child blushing and covering their face slightly, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "처음 보는 친구 앞에서 말하기가 조금 부끄러웠어요.",
        "situation": "학생이 처음 보는 친구 앞에서 말하는 것을 쑥스러워하는 상황",
        "imagePrompt": "A child looking down and shyly holding hands, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제가 발표를 해야 하는데 너무 부끄러워요.",
        "situation": "학생이 발표를 해야 하는 상황에서 선생님께 부끄럽다고 말하는 상황",
        "imagePrompt": "A child with a shy expression talking to a teacher, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple shy face with rosy cheeks icon, round frame, soft pink and peach tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "surprised",
    "ko": "놀라다",
    "category": "verb",
    "subcategory": "감정",
    "level": 2,
    "conjugations": [
      "놀라요",
      "놀랍니다",
      "놀라는",
      "놀랐어요",
      "놀랄 거예요",
      "놀라"
    ],
    "sentences": [
      {
        "ko": "갑자기 큰 소리가 나서 깜짝 놀랐어요.",
        "situation": "학생이 예상치 못한 큰 소리에 놀라는 상황",
        "imagePrompt": "A child with wide eyes and an open mouth in surprise, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 몰래 준 선물에 정말 놀랐어요.",
        "situation": "학생이 친구의 깜짝 선물에 놀라는 상황",
        "imagePrompt": "A child receiving a surprise gift with a surprised expression, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제 그림을 보고 정말 놀라셨어요!",
        "situation": "학생이 자신의 그림을 본 선생님의 놀란 표정을 보고 말하는 상황",
        "imagePrompt": "A teacher looking surprised at a child's drawing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple surprised face with wide eyes icon, round frame, light yellow and blue tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "comfortable",
    "ko": "편하다",
    "category": "adjective",
    "subcategory": "감정",
    "level": 2,
    "conjugations": [
      "편해요",
      "편합니다",
      "편한",
      "편했어요",
      "편할 거예요",
      "편해"
    ],
    "sentences": [
      {
        "ko": "이 의자에 앉으니 정말 편해요.",
        "situation": "학생이 의자에 앉아 편안함을 느끼는 상황",
        "imagePrompt": "A child sitting comfortably on a chair, smiling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "집에 와서 포근한 이불 속에 있으니 편했어요.",
        "situation": "학생이 집에 돌아와 편안한 이불 속에서 쉬는 상황",
        "imagePrompt": "A child snuggled in a cozy blanket, looking relaxed, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 이야기하니 마음이 편해졌어요.",
        "situation": "학생이 친구와 대화하며 마음이 편안해지는 상황",
        "imagePrompt": "Two children talking comfortably and smiling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple comfortable armchair icon, round frame, light beige and soft brown tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "here",
    "ko": "여기",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "여기가",
      "여기를",
      "여기에",
      "여기와",
      "여기는",
      "여기"
    ],
    "sentences": [
      {
        "ko": "제가 그린 그림을 여기 벽에 붙여 주세요.",
        "situation": "학생이 자신의 그림을 특정 장소에 붙여달라고 요청하는 상황",
        "imagePrompt": "A child pointing to a wall where a drawing is being placed, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 반은 교실 맨 앞줄에 있어요.",
        "situation": "학생이 자신의 반이 교실의 특정 위치에 있음을 설명하는 상황",
        "imagePrompt": "A classroom with children sitting in the front row, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 이쪽으로 와서 여기 앉아.",
        "situation": "학생이 친구를 특정 자리로 부르는 상황",
        "imagePrompt": "A child gesturing to a friend to come and sit in a specific spot, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple location pin icon pointing downwards, round frame, bright red and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "there",
    "ko": "저기",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "저기가",
      "저기를",
      "저기에",
      "저기와",
      "저기는",
      "저기"
    ],
    "sentences": [
      {
        "ko": "운동장 저기에서 친구들이 축구를 하고 있어요.",
        "situation": "학생이 운동장 특정 지점에서 친구들이 축구하는 것을 보고 설명하는 상황",
        "imagePrompt": "Children playing soccer in the distance on a playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "책꽂이 저기에 있는 책 좀 가져다줄래?",
        "situation": "학생이 책꽂이의 특정 책을 가져다달라고 부탁하는 상황",
        "imagePrompt": "A child pointing to a bookshelf in the distance, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 저기 창문 밖으로 예쁜 새가 날아가요.",
        "situation": "학생이 창문 밖 멀리 날아가는 새를 선생님께 보여주며 말하는 상황",
        "imagePrompt": "A child pointing out a window at a bird flying in the distance, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple pointing finger icon towards a distant object, round frame, muted green and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "that_place",
    "ko": "거기",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "거기가",
      "거기를",
      "거기에",
      "거기와",
      "거기는",
      "거기"
    ],
    "sentences": [
      {
        "ko": "우리 학교 뒤편에 작은 숲이 있는데, 거기가 정말 좋아요.",
        "situation": "학생이 학교 뒤편의 특정 장소를 좋아한다고 말하는 상황",
        "imagePrompt": "A small forest behind a school building, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "점심시간에 급식실이 정말 붐비는데, 거기 말고 다른 곳에서 먹고 싶어요.",
        "situation": "학생이 급식실이 붐벼서 다른 장소에서 먹고 싶다고 말하는 상황",
        "imagePrompt": "A crowded cafeteria and a child looking for a quiet spot, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 저희 반이 만든 작품을 복도에 전시했는데, 거기 구경 오세요.",
        "situation": "학생이 복도에 전시된 반의 작품을 보러 오라고 선생님께 권유하는 상황",
        "imagePrompt": "Children's artwork displayed in a school hallway, a teacher and a child looking at it, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple map marker icon for a specific place, round frame, warm orange and brown tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "this",
    "ko": "이것",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "이것이",
      "이것을",
      "이것에",
      "이것과",
      "이것은",
      "이것"
    ],
    "sentences": [
      {
        "ko": "이것은 제가 오늘 그린 그림이에요.",
        "situation": "학생이 자신이 그린 그림을 가리키며 소개하는 상황",
        "imagePrompt": "A child proudly showing their drawing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이것 좀 보세요, 정말 신기한 돌멩이를 찾았어요!",
        "situation": "학생이 신기한 돌멩이를 발견하고 친구에게 보여주는 상황",
        "imagePrompt": "A child holding up a unique stone with excitement, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 이것이 제가 가장 좋아하는 책입니다.",
        "situation": "학생이 가장 좋아하는 책을 선생님께 소개하는 상황",
        "imagePrompt": "A child presenting a book to a teacher, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple hand pointing at an object icon, round frame, light blue and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "that",
    "ko": "저것",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "저것이",
      "저것을",
      "저것에",
      "저것과",
      "저것은",
      "저것"
    ],
    "sentences": [
      {
        "ko": "저것은 선생님이 쓰시는 멋진 칠판이에요.",
        "situation": "학생이 선생님의 칠판을 가리키며 설명하는 상황",
        "imagePrompt": "A child pointing at a teacher's blackboard, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "운동장 저것 좀 봐, 친구가 연을 날리고 있어!",
        "situation": "학생이 운동장 멀리서 연을 날리는 친구를 보며 말하는 상황",
        "imagePrompt": "A child pointing towards a kite flying in the distance on a playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 저것 좀 빌려줄 수 있니?",
        "situation": "학생이 친구에게 멀리 있는 물건을 빌려달라고 요청하는 상황",
        "imagePrompt": "A child asking a friend to lend an object in the distance, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple pointing finger icon towards a distant object, round frame, muted purple and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "i_me",
    "ko": "나",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "나",
      "나는",
      "내가",
      "나를",
      "나와",
      "나에게",
      "나의"
    ],
    "sentences": [
      {
        "ko": "나는 지금 그림을 그리고 싶어요.",
        "situation": "쉬는 시간에 그림을 그리는 상황",
        "imagePrompt": "A young Korean elementary school student, age 7, happily drawing with crayons at a desk, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "나의 이름은 지수입니다. 만나서 반가워요.",
        "situation": "새로운 친구에게 자신을 소개하는 상황",
        "imagePrompt": "A friendly Korean elementary school teacher greeting a new student, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제가 발표해도 될까요?",
        "situation": "수업 시간에 발표 기회를 얻고 싶어 하는 상황",
        "imagePrompt": "A young Korean elementary school student raising their hand eagerly in a classroom, asking the teacher a question, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple 'I' icon made of colorful building blocks, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "you",
    "ko": "너",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "너",
      "너는",
      "네가",
      "너를",
      "너와",
      "너에게",
      "너의"
    ],
    "sentences": [
      {
        "ko": "너는 오늘 무엇을 배웠니?",
        "situation": "친구에게 오늘 배운 내용을 묻는 상황",
        "imagePrompt": "Two young Korean elementary school students talking and smiling at each other during recess, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "네가 만든 작품 정말 멋지다!",
        "situation": "친구의 작품을 칭찬하는 상황",
        "imagePrompt": "A child admiring a colorful artwork displayed on a classroom wall, made by a friend, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 너에게 칭찬하셨어.",
        "situation": "선생님께 칭찬받은 친구에 대해 이야기하는 상황",
        "imagePrompt": "A teacher giving a sticker to a happy student in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple 'You' icon represented by two speech bubbles pointing at each other, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "we",
    "ko": "우리",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "우리",
      "우리는",
      "우리가",
      "우리를",
      "우리와",
      "우리에게",
      "우리의"
    ],
    "sentences": [
      {
        "ko": "우리는 함께 축구를 할 거예요.",
        "situation": "쉬는 시간에 친구들과 함께 할 활동을 계획하는 상황",
        "imagePrompt": "A group of young Korean elementary school students playing soccer together on a sunny playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리가 만든 노래를 발표할 시간이에요.",
        "situation": "함께 만든 노래를 발표하는 음악 수업 시간",
        "imagePrompt": "A group of children singing together on a small stage in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 모두 힘을 합쳐서 이 문제를 풀어보자.",
        "situation": "어려운 문제를 친구들과 함께 해결하려는 상황",
        "imagePrompt": "A teacher pointing at a math problem on a blackboard while students look on attentively, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple 'We' icon showing a group of diverse stick figures holding hands, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "who",
    "ko": "누구",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "누구",
      "누구는",
      "누가",
      "누구를",
      "누구와",
      "누구에게",
      "누구의"
    ],
    "sentences": [
      {
        "ko": "이 가방은 누구의 것인가요?",
        "situation": "잃어버린 물건의 주인을 찾는 상황",
        "imagePrompt": "A young Korean elementary school student looking at a lost backpack with a confused expression, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "오늘 누가 제일 먼저 왔는지 궁금해요.",
        "situation": "아침 등교 시간에 누가 제일 먼저 왔는지 궁금해하는 상황",
        "imagePrompt": "Children arriving at the school gate, one child is already there, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 반에서 누가 가장 달리기를 잘하는지 알아?",
        "situation": "체육 시간에 반 친구들의 운동 능력에 대해 이야기하는 상황",
        "imagePrompt": "Children running in a race on a school track, one student is ahead, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple question mark icon with a small silhouette inside, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "what",
    "ko": "뭐",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "뭐",
      "뭐는",
      "뭐가",
      "뭐를",
      "뭐와",
      "뭐에게",
      "뭐의"
    ],
    "sentences": [
      {
        "ko": "점심 시간에 무엇을 먹을지 기대돼요.",
        "situation": "점심 메뉴를 기다리며 기대하는 상황",
        "imagePrompt": "Young students excitedly looking at a lunch menu board in a school cafeteria, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 오늘 무엇을 배울 건가요?",
        "situation": "수업 시작 전 오늘 배울 내용을 묻는 상황",
        "imagePrompt": "A curious student asking a teacher a question at the beginning of a class, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이 책은 무엇에 관한 이야기인지 궁금해요.",
        "situation": "흥미로운 책을 보고 내용이 무엇인지 궁금해하는 상황",
        "imagePrompt": "A child holding an open book with colorful illustrations, looking intrigued, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple 'What' icon represented by a question mark inside a lightbulb, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "where",
    "ko": "어디",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "어디",
      "어디는",
      "어디가",
      "어디를",
      "어디와",
      "어디에게",
      "어디의"
    ],
    "sentences": [
      {
        "ko": "다음 주에 우리는 어디로 현장 학습을 가나요?",
        "situation": "현장 학습 장소에 대해 기대하며 묻는 상황",
        "imagePrompt": "A group of excited students looking at a map of a park or museum, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "체육복을 어디에 두었는지 잊어버렸어요.",
        "situation": "체육복을 찾지 못해 당황하는 상황",
        "imagePrompt": "A child looking around a locker room or classroom with a worried expression, searching for something, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 화장실은 어디에 있어요?",
        "situation": "학교 건물 내에서 길을 묻는 상황",
        "imagePrompt": "A student asking a teacher for directions in a school hallway, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple compass icon pointing north, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "when",
    "ko": "언제",
    "category": "noun",
    "subcategory": "지칭어",
    "level": 1,
    "conjugations": [
      "언제",
      "언제는",
      "언제가",
      "언제를",
      "언제와",
      "언제에게",
      "언제의"
    ],
    "sentences": [
      {
        "ko": "오늘 방과 후에 우리 같이 놀자.",
        "situation": "친구에게 방과 후 함께 놀자고 제안하는 상황",
        "imagePrompt": "Two young Korean elementary school students making plans to play after school, one pointing at a calendar, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "시험은 언제부터 시작하나요?",
        "situation": "시험 일정을 묻는 학생들의 모습",
        "imagePrompt": "A group of students looking at a notice board displaying a school schedule, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 숙제는 언제까지 제출해야 하나요?",
        "situation": "숙제 제출 기한을 확인하는 상황",
        "imagePrompt": "A teacher explaining homework to students at the end of a class, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple clock icon with hands pointing to a specific time, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "want",
    "ko": "원하다",
    "category": "verb",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "원하다",
      "원해요",
      "원합니다",
      "원하는",
      "원했다",
      "원하고"
    ],
    "sentences": [
      {
        "ko": "나는 오늘 맛있는 간식을 먹고 싶어요.",
        "situation": "쉬는 시간에 간식을 먹고 싶어 하는 상황",
        "imagePrompt": "A young Korean elementary school student looking longingly at a vending machine filled with snacks, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 함께 그림을 그리고 싶어요.",
        "situation": "친구가 미술 시간에 함께 그림 그리기를 제안하는 상황",
        "imagePrompt": "Two friends sitting side-by-side at an art table, one holding up a crayon to the other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제가 저 그림을 완성하고 싶어요.",
        "situation": "미술 시간에 더 그리고 싶은 마음을 표현하는 상황",
        "imagePrompt": "A student pointing to a partially finished drawing on an easel, expressing a desire to continue, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a shining star with a heart inside, representing a wish, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "dislike",
    "ko": "싫다",
    "category": "adjective",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "싫다",
      "싫어요",
      "싫습니다",
      "싫은",
      "싫었다",
      "싫고"
    ],
    "sentences": [
      {
        "ko": "저는 매운 음식을 먹는 것이 싫어요.",
        "situation": "급식 시간에 싫어하는 음식이 나왔을 때",
        "imagePrompt": "A young Korean elementary school student making a disgusted face at a plate of spicy food in the cafeteria, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "시끄러운 소리는 듣기 싫어요.",
        "situation": "수업 시간에 옆반의 큰 소리를 듣고 불편해하는 상황",
        "imagePrompt": "A student covering their ears with a displeased expression due to loud noise from outside the classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 저는 이 놀이는 재미없어서 하기 싫어요.",
        "situation": "친구들과 하는 놀이가 재미없어 참여하고 싶지 않을 때",
        "imagePrompt": "A child sitting apart from a group of children playing a game, looking bored or unhappy, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a frowning face with a red cross over it, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "like",
    "ko": "좋다",
    "category": "adjective",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "좋다",
      "좋아요",
      "좋습니다",
      "좋은",
      "좋았다",
      "좋고"
    ],
    "sentences": [
      {
        "ko": "저는 오늘 학교 오는 것이 좋아요.",
        "situation": "아침에 학교에 오는 것이 즐거운 상황",
        "imagePrompt": "A young Korean elementary school student walking to school with a big smile, holding a backpack, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 반 친구들과 함께 노는 것이 제일 좋아요.",
        "situation": "쉬는 시간에 친구들과 어울리는 즐거움",
        "imagePrompt": "A group of happy Korean elementary school students playing and laughing together during recess, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제가 그린 그림을 선생님도 좋아해 주셔서 기뻐요.",
        "situation": "자신의 작품을 선생님이 좋아해 주셔서 기쁜 상황",
        "imagePrompt": "A student proudly showing their drawing to a smiling teacher who is giving a thumbs-up, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a smiling face with a heart above it, round frame, pastel tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "need",
    "ko": "필요하다",
    "category": "adjective",
    "subcategory": "의사표현",
    "level": 2,
    "conjugations": [
      "필요해요",
      "필요합니다",
      "필요한",
      "필요했어요",
      "필요한데",
      "필요하니"
    ],
    "sentences": [
      {
        "ko": "저는 지금 연필이 필요해요.",
        "situation": "수업 시간에 필기구가 필요한 상황",
        "imagePrompt": "A young Korean boy holding up his hand, looking like he needs something, in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 이 책이 정말 필요해요.",
        "situation": "도서관에서 특정 책을 찾고 있는 상황",
        "imagePrompt": "A teacher handing a book to a student in a library, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 네 도움이 정말 필요해.",
        "situation": "어려운 숙제를 친구에게 도움을 요청하는 상황",
        "imagePrompt": "Two Korean elementary school friends working on homework together, one looking thoughtful and the other offering help, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple pencil icon, round frame, light blue tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "ok",
    "ko": "괜찮다",
    "category": "adjective",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "괜찮아요",
      "괜찮습니다",
      "괜찮은",
      "괜찮았어요",
      "괜찮은데",
      "괜찮으니"
    ],
    "sentences": [
      {
        "ko": "제가 도와줄게요, 괜찮아요.",
        "situation": "넘어진 친구를 보며 괜찮다고 안심시키는 상황",
        "imagePrompt": "A young Korean girl patting a classmate on the shoulder, both smiling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 이것은 괜찮은가요?",
        "situation": "만든 작품을 선생님께 보여주며 확인받는 상황",
        "imagePrompt": "A teacher looking at a student's artwork with a smile, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "걱정하지 마, 나도 괜찮아.",
        "situation": "친구가 걱정할 때 자신도 괜찮다고 말해주는 상황",
        "imagePrompt": "Two Korean elementary school friends hugging, one comforting the other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple thumbs-up icon, round frame, green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "help",
    "ko": "도와주다",
    "category": "verb",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "도와줘요",
      "도와줍니다",
      "도와주는",
      "도와줬어요",
      "도와주는데",
      "도와주니"
    ],
    "sentences": [
      {
        "ko": "선생님, 제가 좀 도와줄게요.",
        "situation": "무거운 짐을 든 선생님을 어린이가 도와주려는 상황",
        "imagePrompt": "A young Korean boy reaching out to help a teacher carry books, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 이 무거운 상자를 같이 도와줄까?",
        "situation": "친구와 함께 무거운 물건을 옮기는 상황",
        "imagePrompt": "Two Korean elementary school friends lifting a box together, smiling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "혼자 하기 어려운데, 누가 좀 도와줄래요?",
        "situation": "혼자서 어려운 활동을 할 때 도움을 요청하는 상황",
        "imagePrompt": "A Korean elementary school student struggling with a task, looking around for help, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple helping hands icon, round frame, yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "dunno",
    "ko": "모르다",
    "category": "verb",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "몰라요",
      "모릅니다",
      "모르는",
      "몰랐어요",
      "모르는데",
      "모르니"
    ],
    "sentences": [
      {
        "ko": "선생님, 이 문제는 제가 잘 모르겠어요.",
        "situation": "수학 문제를 풀다가 어려운 부분에서 선생님께 질문하는 상황",
        "imagePrompt": "A young Korean student looking confused at a math problem, raising their hand to ask the teacher, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 내일 날씨가 어떨지 나도 모르겠어.",
        "situation": "친구와 내일 날씨에 대해 이야기하지만 답을 모르는 상황",
        "imagePrompt": "Two Korean elementary school friends looking up at the sky, one shrugging, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이 물건 이름이 뭐예요? 저는 잘 모르겠어요.",
        "situation": "처음 보는 물건의 이름을 알지 못하는 상황",
        "imagePrompt": "A Korean elementary school student looking curiously at an unfamiliar object, with a question mark above their head, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple question mark icon, round frame, purple tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "know",
    "ko": "알다",
    "category": "verb",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "알아요",
      "압니다",
      "아는",
      "알았어요",
      "아는데",
      "아니"
    ],
    "sentences": [
      {
        "ko": "저는 이 동물의 이름을 알아요.",
        "situation": "동물 그림을 보고 이름을 정확히 아는 상황",
        "imagePrompt": "A young Korean girl pointing at a picture of an animal and smiling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 이것은 이렇게 하는 것을 알아요.",
        "situation": "새로운 것을 배우고 방법을 정확히 이해한 상황",
        "imagePrompt": "A teacher demonstrating an activity, and a student nodding with understanding, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 내가 너의 비밀을 알고 있어.",
        "situation": "친구의 작은 비밀을 알고 있지만 말해주지 않는 상황",
        "imagePrompt": "Two Korean elementary school friends sharing a secret smile, one whispering to the other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple lightbulb icon, round frame, orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "yes",
    "ko": "네",
    "category": "expression",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "네"
    ],
    "sentences": [
      {
        "ko": "네, 선생님! 제가 할 수 있어요.",
        "situation": "선생님의 질문에 자신감 있게 대답하는 상황",
        "imagePrompt": "A young Korean boy enthusiastically raising his hand and saying 'yes' to the teacher, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 같이 놀래? 네, 좋아요!",
        "situation": "친구가 같이 놀자고 제안했을 때 흔쾌히 수락하는 상황",
        "imagePrompt": "Two Korean elementary school friends smiling and agreeing to play together, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 이것을 도와드릴까요? 네, 부탁해요.",
        "situation": "선생님의 도움 요청에 긍정적으로 응하는 상황",
        "imagePrompt": "A teacher asking for help with some materials, and a student happily agreeing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple checkmark icon, round frame, bright green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "no",
    "ko": "아니요",
    "category": "expression",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "아니요"
    ],
    "sentences": [
      {
        "ko": "아니요, 선생님. 저는 아직 다 못했어요.",
        "situation": "숙제를 아직 끝내지 못했을 때 선생님께 솔직하게 말하는 상황",
        "imagePrompt": "A young Korean girl looking a little sad, shaking her head 'no' to the teacher about finishing her homework, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이것은 제 것이 아니에요. 아니요, 잘못 가져왔어요.",
        "situation": "자신의 물건이 아닌 것을 잘못 가져왔을 때 돌려주는 상황",
        "imagePrompt": "A Korean elementary school student returning a lost item to the teacher, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 이 게임은 재미없어. 아니, 다른 거 하자.",
        "situation": "친구가 제안한 게임이 재미없어서 다른 것을 하자고 하는 상황",
        "imagePrompt": "Two Korean elementary school friends looking at a game board, one shaking their head 'no' and pointing to another game, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple 'X' mark icon, round frame, red tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "please",
    "ko": "주세요",
    "category": "expression",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "주세요",
      "주십시오",
      "주는",
      "줬어요",
      "주는데",
      "주니"
    ],
    "sentences": [
      {
        "ko": "선생님, 이 크레파스를 하나 주세요.",
        "situation": "수업 시간에 필요한 미술 도구를 선생님께 요청하는 상황",
        "imagePrompt": "A young Korean girl politely asking the teacher for a crayon, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 이 책 좀 같이 봐줄래? 응, 그러자. 이 책 주세요.",
        "situation": "친구가 책을 보여달라고 할 때 기꺼이 건네주는 상황",
        "imagePrompt": "Two Korean elementary school friends looking at a book together, one holding the book out to the other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이 과자를 하나만 주세요.",
        "situation": "간식을 먹고 싶을 때 친구에게 나누어달라고 부탁하는 상황",
        "imagePrompt": "A Korean elementary school child offering a snack to another child, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple gift box icon, round frame, pink tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "wait",
    "ko": "기다리다",
    "category": "verb",
    "subcategory": "의사표현",
    "level": 2,
    "conjugations": [
      "기다려요",
      "기다립니다",
      "기다리는",
      "기다렸어요",
      "기다리는데",
      "기다리니"
    ],
    "sentences": [
      {
        "ko": "선생님, 제가 지금 금방 다녀올게요, 잠깐만 기다려 주세요.",
        "situation": "잠시 자리를 비워야 할 때 선생님께 양해를 구하는 상황",
        "imagePrompt": "A young Korean boy waving goodbye to the teacher, who is smiling and gesturing to wait, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 내가 먼저 줄을 설게. 너는 거기서 기다려.",
        "situation": "놀이기구를 타기 위해 줄을 설 때 친구에게 기다리라고 말하는 상황",
        "imagePrompt": "Two Korean elementary school friends in a playground queue, one pointing to a spot to wait, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "버스 기다리는 동안 심심해요.",
        "situation": "버스를 기다리는 동안 시간이 잘 가지 않는 상황",
        "imagePrompt": "A group of Korean elementary school children waiting at a bus stop, looking a bit bored, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple hourglass icon, round frame, light brown tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "again",
    "ko": "다시",
    "category": "expression",
    "subcategory": "의사표현",
    "level": 1,
    "conjugations": [
      "다시"
    ],
    "sentences": [
      {
        "ko": "선생님, 이것은 다시 한번 설명해 주세요.",
        "situation": "이해가 안 되는 부분을 다시 설명해달라고 요청하는 상황",
        "imagePrompt": "A young Korean girl with a thoughtful expression, asking the teacher to explain something again, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 우리 이 놀이를 다시 한번 해볼까?",
        "situation": "재미있었던 놀이를 다시 한번 하자는 제안을 하는 상황",
        "imagePrompt": "Two Korean elementary school friends looking excited about playing a game again, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이 그림이 마음에 안 들어서 다시 그릴 거예요.",
        "situation": "그린 그림이 마음에 들지 않아 다시 그리려는 상황",
        "imagePrompt": "A Korean elementary school student looking at their drawing with a critical eye, ready to start again, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple refresh icon, round frame, teal tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "friend",
    "ko": "친구",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "친구",
      "친구가",
      "친구를",
      "친구에",
      "친구와",
      "친구는"
    ],
    "sentences": [
      {
        "ko": "나는 내 친구와 같이 놀아요.",
        "situation": "쉬는 시간에 친구와 함께 노는 상황.",
        "imagePrompt": "A young boy playing with his friend in a schoolyard, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 오늘 생일이라서 선물을 주었어요.",
        "situation": "친구가 생일을 맞아 선물을 주고받는 상황.",
        "imagePrompt": "A child giving a gift to their friend in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 친구와 저를 칭찬해 주셨어요.",
        "situation": "선생님이 학생들의 좋은 행동을 칭찬하는 상황.",
        "imagePrompt": "A teacher praising two friends in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of two children holding hands, round frame, light blue and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "teacher",
    "ko": "선생님",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "선생님",
      "선생님이",
      "선생님을",
      "선생님께",
      "선생님과",
      "선생님은"
    ],
    "sentences": [
      {
        "ko": "저는 선생님을 정말 좋아해요.",
        "situation": "학생이 선생님에 대한 존경심을 표현하는 상황.",
        "imagePrompt": "A young girl smiling at her teacher in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 숙제를 내주셨어요.",
        "situation": "선생님이 학생들에게 숙제를 안내하는 상황.",
        "imagePrompt": "A teacher writing on a blackboard with students watching, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님과 함께 동화책을 읽었어요.",
        "situation": "선생님이 학생들에게 동화책을 읽어주는 상황.",
        "imagePrompt": "A teacher reading a book to a group of children in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a teacher holding a book, round frame, warm orange and brown tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "school",
    "ko": "학교",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "학교",
      "학교가",
      "학교를",
      "학교에",
      "학교와",
      "학교는"
    ],
    "sentences": [
      {
        "ko": "저는 학교 가는 것을 좋아해요.",
        "situation": "학교 가는 길에 대한 긍정적인 감정을 표현하는 상황.",
        "imagePrompt": "A young child happily walking towards a school building, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "학교 운동장에서 친구들과 신나게 뛰어놀았어요.",
        "situation": "학교 운동장에서 친구들과 뛰어노는 상황.",
        "imagePrompt": "Children playing energetically in a schoolyard, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "학교 앞에는 예쁜 꽃들이 많이 피었어요.",
        "situation": "학교 주변의 아름다운 풍경을 묘사하는 상황.",
        "imagePrompt": "A school building with colorful flowers blooming in front, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a school building, round frame, sky blue and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "classroom",
    "ko": "교실",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "교실",
      "교실이",
      "교실을",
      "교실에",
      "교실과",
      "교실은"
    ],
    "sentences": [
      {
        "ko": "저는 우리 교실이 참 좋아요.",
        "situation": "자신의 교실에 대한 애정을 표현하는 상황.",
        "imagePrompt": "A cheerful child sitting at their desk in a bright classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "교실 창문으로 햇살이 환하게 비춰요.",
        "situation": "교실 안으로 들어오는 햇살을 묘사하는 상황.",
        "imagePrompt": "Sunlight streaming through a classroom window onto desks, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 함께 교실에서 그림을 그렸어요.",
        "situation": "친구와 함께 교실에서 그림 그리기 활동을 하는 상황.",
        "imagePrompt": "Two friends drawing pictures together at a desk in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a classroom interior with desks, round frame, light green and beige tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "desk",
    "ko": "책상",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "책상",
      "책상이",
      "책상을",
      "책상에",
      "책상과",
      "책상은"
    ],
    "sentences": [
      {
        "ko": "나는 내 책상에 연필을 두었어요.",
        "situation": "자신의 책상에 연필을 정리하는 상황.",
        "imagePrompt": "A young child placing a pencil on their neat desk, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 책상 정리를 잘 하라고 하셨어요.",
        "situation": "선생님이 책상 정돈의 중요성을 강조하는 상황.",
        "imagePrompt": "A teacher looking at students' tidy desks, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 책상을 나란히 놓고 공부했어요.",
        "situation": "친구와 책상을 붙여 앉아 함께 공부하는 상황.",
        "imagePrompt": "Two friends studying side-by-side at their desks in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a school desk, round frame, wood brown and light yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "chair",
    "ko": "의자",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "의자",
      "의자가",
      "의자를",
      "의자에",
      "의자와",
      "의자는"
    ],
    "sentences": [
      {
        "ko": "나는 의자에 앉아서 책을 읽어요.",
        "situation": "의자에 편안하게 앉아 책을 읽는 상황.",
        "imagePrompt": "A young child sitting comfortably on a chair reading a book, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 의자를 바르게 앉으라고 하셨어요.",
        "situation": "선생님이 올바른 자세로 의자에 앉도록 지도하는 상황.",
        "imagePrompt": "A teacher demonstrating how to sit properly on a chair, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 함께 의자를 옮겨서 모둠 활동을 했어요.",
        "situation": "친구와 함께 의자를 옮겨 모둠 활동을 준비하는 상황.",
        "imagePrompt": "Two children moving chairs together in a classroom for group activity, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a school chair, round frame, light blue and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "book",
    "ko": "책",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "책",
      "책이",
      "책을",
      "책에",
      "책과",
      "책은"
    ],
    "sentences": [
      {
        "ko": "나는 재미있는 책을 읽고 있어요.",
        "situation": "흥미로운 책을 읽고 있는 상황.",
        "imagePrompt": "A young child engrossed in reading an interesting book, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "도서관에서 친구와 함께 책을 골랐어요.",
        "situation": "학교 도서관에서 친구와 함께 책을 고르는 상황.",
        "imagePrompt": "Two friends choosing books together in a school library, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 오늘 배울 내용이 담긴 책을 보여주셨어요.",
        "situation": "선생님이 수업에 사용할 책을 학생들에게 보여주는 상황.",
        "imagePrompt": "A teacher showing a book to students in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of an open book, round frame, red and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "pencil",
    "ko": "연필",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "연필",
      "연필이",
      "연필을",
      "연필에",
      "연필과",
      "연필은"
    ],
    "sentences": [
      {
        "ko": "나는 글씨를 쓰기 위해 연필을 잡았어요.",
        "situation": "글씨를 쓰기 위해 연필을 잡는 행동.",
        "imagePrompt": "A young child holding a pencil, ready to write, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 연필이 없어서 빌려주었어요.",
        "situation": "친구가 연필이 없어 빌려주는 상황.",
        "imagePrompt": "A child lending a pencil to their friend in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 연필을 깎는 방법을 알려주셨어요.",
        "situation": "선생님이 연필 깎는 방법을 시연하는 상황.",
        "imagePrompt": "A teacher showing students how to sharpen a pencil, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a pencil, round frame, yellow and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "eraser",
    "ko": "지우개",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "지우개",
      "지우개가",
      "지우개를",
      "지우개에",
      "지우개와",
      "지우개는"
    ],
    "sentences": [
      {
        "ko": "나는 틀린 글씨를 지우개로 지웠어요.",
        "situation": "틀린 글씨를 지우개로 지우는 상황.",
        "imagePrompt": "A young child using an eraser to correct writing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 연필심이 부러져서 지우개를 빌려달라고 했어요.",
        "situation": "친구가 연필심이 부러져 지우개를 빌리는 상황.",
        "imagePrompt": "A child asking to borrow an eraser from a friend, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 지우개똥을 잘 치우라고 말씀하셨어요.",
        "situation": "선생님이 지우개똥을 깨끗하게 치우도록 지도하는 상황.",
        "imagePrompt": "A teacher pointing to a clean desk after erasing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of an eraser, round frame, pink and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "notebook_item",
    "ko": "공책",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "공책",
      "공책이",
      "공책을",
      "공책에",
      "공책과",
      "공책은"
    ],
    "sentences": [
      {
        "ko": "나는 오늘 배운 내용을 공책에 적었어요.",
        "situation": "수업 내용을 공책에 필기하는 상황.",
        "imagePrompt": "A young child writing notes in a notebook, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 예쁜 공책을 선물해 주었어요.",
        "situation": "친구가 예쁜 공책을 선물로 주는 상황.",
        "imagePrompt": "A child receiving a pretty notebook as a gift from a friend, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 공책 검사를 하신다고 하셨어요.",
        "situation": "선생님이 학생들의 공책을 검사할 예정임을 알리는 상황.",
        "imagePrompt": "A teacher looking at students' notebooks for review, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a notebook, round frame, light green and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "bag",
    "ko": "가방",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "가방",
      "가방이",
      "가방을",
      "가방에",
      "가방과",
      "가방은",
      "가방도"
    ],
    "sentences": [
      {
        "ko": "저는 오늘 제 가방을 예쁘게 꾸몄어요.",
        "situation": "학생이 자신의 가방을 자랑하는 상황",
        "imagePrompt": "A young Korean elementary school student proudly showing off their decorated backpack, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 제 가방을 메고 사진을 찍었어요.",
        "situation": "친구가 학생의 가방을 빌려 사진을 찍는 상황",
        "imagePrompt": "A friend playfully wearing another student's backpack and posing for a photo, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제 가방 안에 준비물이 다 들어있어요.",
        "situation": "학생이 선생님께 가방 속 준비물을 확인시켜 주는 상황",
        "imagePrompt": "A student showing their teacher the contents of their backpack, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple backpack icon, round frame, blue and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "lunch",
    "ko": "급식",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "급식",
      "급식이",
      "급식을",
      "급식에",
      "급식과",
      "급식은",
      "급식도"
    ],
    "sentences": [
      {
        "ko": "저는 오늘 급식으로 나온 카레가 정말 맛있었어요.",
        "situation": "학생이 급식 메뉴에 대해 이야기하는 상황",
        "imagePrompt": "A young Korean elementary school student happily eating curry for lunch, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 반 친구들은 모두 줄을 서서 급식을 받아요.",
        "situation": "학생들이 급식 시간에 질서 있게 줄을 서는 모습",
        "imagePrompt": "A diverse group of Korean elementary school students lining up orderly to receive their lunch, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 오늘 급식 메뉴가 무엇인지 알려주세요.",
        "situation": "학생이 선생님께 급식 메뉴를 묻는 상황",
        "imagePrompt": "A student asking their teacher about the lunch menu, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple lunchbox icon with chopsticks, round frame, green and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "water",
    "ko": "물",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "물",
      "물이",
      "물을",
      "물에",
      "물과",
      "물은",
      "물도"
    ],
    "sentences": [
      {
        "ko": "저는 목이 마를 때마다 시원한 물을 마셔요.",
        "situation": "학생이 물을 마시는 습관에 대해 말하는 상황",
        "imagePrompt": "A young Korean elementary school student drinking a refreshing glass of water, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "운동장에서 신나게 뛰어놀고 나서 물을 마셨어요.",
        "situation": "학생들이 운동 후 물을 마시는 상황",
        "imagePrompt": "Korean elementary school children drinking water after playing energetically on the playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 네 물병을 나에게 빌려줄 수 있니?",
        "situation": "학생이 친구에게 물병을 빌려달라고 부탁하는 상황",
        "imagePrompt": "A student asking a friend to borrow their water bottle, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple water droplet icon, round frame, light blue tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "toilet",
    "ko": "화장실",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "화장실",
      "화장실이",
      "화장실을",
      "화장실에",
      "화장실과",
      "화장실은",
      "화장실도"
    ],
    "sentences": [
      {
        "ko": "쉬는 시간에 화장실에 다녀왔어요.",
        "situation": "학생이 쉬는 시간에 화장실에 간 상황",
        "imagePrompt": "A young Korean elementary school student walking to the restroom during break time, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "급식을 먹기 전에 손을 깨끗하게 씻으러 화장실에 갔어요.",
        "situation": "학생이 위생을 위해 화장실에 가는 상황",
        "imagePrompt": "Korean elementary school students washing their hands in the restroom before lunch, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 화장실에 가고 싶어요.",
        "situation": "학생이 선생님께 화장실에 가고 싶다고 말하는 상황",
        "imagePrompt": "A student politely asking their teacher for permission to go to the restroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple restroom sign icon, round frame, white and blue tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "playground",
    "ko": "운동장",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "운동장",
      "운동장이",
      "운동장을",
      "운동장에",
      "운동장과",
      "운동장은",
      "운동장도"
    ],
    "sentences": [
      {
        "ko": "저는 쉬는 시간에 친구들과 운동장에서 신나게 뛰어놀아요.",
        "situation": "학생들이 쉬는 시간에 운동장에서 노는 상황",
        "imagePrompt": "A group of Korean elementary school students joyfully running and playing on the school playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "오늘 체육 시간에 운동장에서 재미있는 게임을 했어요.",
        "situation": "체육 시간에 운동장에서 게임을 하는 상황",
        "imagePrompt": "Korean elementary school children playing a fun game on the playground during physical education class, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "점심시간이 되면 운동장에 학생들이 많이 모여요.",
        "situation": "점심시간에 운동장에 학생들이 모이는 모습",
        "imagePrompt": "Many Korean elementary school students gathering on the playground during lunchtime, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple playground slide and swing icon, round frame, green and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "gym",
    "ko": "체육관",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 2,
    "conjugations": [
      "체육관",
      "체육관이",
      "체육관을",
      "체육관에",
      "체육관과",
      "체육관은",
      "체육관도"
    ],
    "sentences": [
      {
        "ko": "저는 체육 시간에 농구하는 것을 좋아해요.",
        "situation": "학생이 체육관에서 농구하는 것을 좋아하는 상황",
        "imagePrompt": "A young Korean elementary school student enjoying playing basketball in the gymnasium, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "비가 오는 날에는 체육관에서 달리기를 해요.",
        "situation": "날씨 때문에 체육관에서 실내 활동을 하는 상황",
        "imagePrompt": "Korean elementary school children running inside the gymnasium on a rainy day, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 우리 체육관에서 같이 배드민턴 칠래?",
        "situation": "학생이 친구에게 체육관에서 배드민턴을 치자고 제안하는 상황",
        "imagePrompt": "A student inviting a friend to play badminton together in the gymnasium, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple basketball and net icon, round frame, red and blue tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "music_room",
    "ko": "음악실",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 2,
    "conjugations": [
      "음악실",
      "음악실이",
      "음악실을",
      "음악실에",
      "음악실과",
      "음악실은",
      "음악실도"
    ],
    "sentences": [
      {
        "ko": "저는 음악실에서 노래 부르는 것을 제일 좋아해요.",
        "situation": "학생이 음악실에서 노래 부르는 것을 즐기는 상황",
        "imagePrompt": "A young Korean elementary school student happily singing in the music room, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이번 음악 시간에는 다 같이 리코더를 불었어요.",
        "situation": "음악 수업 시간에 리코더를 연주하는 상황",
        "imagePrompt": "Korean elementary school children playing recorders together in the music room, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 음악실에 있는 피아노를 쳐봐도 되나요?",
        "situation": "학생이 선생님께 음악실의 피아노를 쳐봐도 되는지 묻는 상황",
        "imagePrompt": "A student asking their teacher if they can play the piano in the music room, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple musical note and piano icon, round frame, purple and pink tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "library",
    "ko": "도서관",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "도서관",
      "도서관이",
      "도서관을",
      "도서관에",
      "도서관과",
      "도서관은",
      "도서관도"
    ],
    "sentences": [
      {
        "ko": "저는 쉬는 시간에 도서관에서 재미있는 책을 빌려요.",
        "situation": "학생이 쉬는 시간에 도서관에서 책을 빌리는 상황",
        "imagePrompt": "A young Korean elementary school student borrowing an interesting book from the library during break time, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 함께 도서관에 가서 조용히 책을 읽었어요.",
        "situation": "학생들이 친구와 함께 도서관에서 책을 읽는 상황",
        "imagePrompt": "Two Korean elementary school students quietly reading books together in the library, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 이 책은 도서관에 반납하면 되나요?",
        "situation": "학생이 선생님께 책 반납에 대해 묻는 상황",
        "imagePrompt": "A student asking their teacher if they should return a book to the library, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple open book icon, round frame, brown and beige tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "homework",
    "ko": "숙제",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "숙제",
      "숙제가",
      "숙제를",
      "숙제에",
      "숙제와",
      "숙제는",
      "숙제도"
    ],
    "sentences": [
      {
        "ko": "저는 오늘 집에서 수학 숙제를 열심히 했어요.",
        "situation": "학생이 집에서 숙제를 하는 상황",
        "imagePrompt": "A young Korean elementary school student diligently doing math homework at home, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 내 숙제를 도와주어서 정말 고마웠어요.",
        "situation": "친구가 숙제를 도와주는 상황",
        "imagePrompt": "A student gratefully receiving help with their homework from a friend, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제가 숙제를 다 못했는데 어떻게 하죠?",
        "situation": "학생이 선생님께 숙제를 다 못했다고 말하며 도움을 구하는 상황",
        "imagePrompt": "A student looking worried as they tell their teacher they couldn't finish their homework, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple pencil and notebook icon, round frame, gray and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "test",
    "ko": "시험",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 2,
    "conjugations": [
      "시험",
      "시험이",
      "시험을",
      "시험에",
      "시험과",
      "시험은",
      "시험도"
    ],
    "sentences": [
      {
        "ko": "저는 내일 있을 과학 시험을 열심히 공부하고 있어요.",
        "situation": "학생이 시험을 위해 공부하는 상황",
        "imagePrompt": "A young Korean elementary school student studying hard for a science test tomorrow, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이번 시험은 쉬운 문제가 많이 나와서 다행이었어요.",
        "situation": "학생이 시험을 치르고 난 후 안도하는 상황",
        "imagePrompt": "A Korean elementary school student looking relieved after taking an easy test, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 시험 범위가 어디까지인지 다시 한번 알려주세요.",
        "situation": "학생이 선생님께 시험 범위를 다시 확인하는 상황",
        "imagePrompt": "A student asking their teacher to clarify the scope of the test, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple test paper and checkmark icon, round frame, blue and green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "class_hour",
    "ko": "수업",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "수업이에요",
      "수업입니다",
      "수업하는",
      "수업했어요",
      "수업 중",
      "수업시간"
    ],
    "sentences": [
      {
        "ko": "지금은 즐거운 수업이에요.",
        "situation": "학생이 현재 수업 시간임을 알리는 상황",
        "imagePrompt": "A young Korean student smiling in a classroom, sitting at a desk, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 수학 수업을 시작하셨어요.",
        "situation": "수업 시간에 선생님이 특정 과목을 가르치기 시작하는 상황",
        "imagePrompt": "A friendly Korean teacher standing at the front of a classroom, pointing to a blackboard, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "오늘 우리는 재미있는 수업을 했어요.",
        "situation": "학생이 친구와 어제 또는 오늘 있었던 수업에 대해 이야기하는 상황",
        "imagePrompt": "Two Korean elementary school students chatting happily after class, one pointing to a notebook, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple clock face icon representing class hour, round frame, light blue and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "break_time",
    "ko": "쉬는시간",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "쉬는시간이에요",
      "쉬는시간입니다",
      "쉬는시간을",
      "쉬는시간이었어요",
      "쉬는 시간"
    ],
    "sentences": [
      {
        "ko": "나는 쉬는시간에 친구와 놀아요.",
        "situation": "학생이 쉬는 시간 활동을 설명하는 상황",
        "imagePrompt": "Two Korean elementary school students playing tag in a school hallway during break time, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "종이 치자마자 아이들이 운동장으로 뛰어나갔어요.",
        "situation": "쉬는 시간이 시작되자 학생들이 활발하게 움직이는 상황",
        "imagePrompt": "A school bell ringing, and children rushing out of classrooms into a sunny schoolyard, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 쉬는 시간에 물 마셔도 돼요?",
        "situation": "학생이 선생님께 쉬는 시간에 음료 섭취 허락을 구하는 상황",
        "imagePrompt": "A Korean elementary school student politely asking a teacher a question in a classroom during break time, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple clock with an open door icon representing break time, round frame, orange and green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "art_supplies",
    "ko": "크레파스",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "크레파스예요",
      "크레파스입니다",
      "크레파스를",
      "크레파스였어요",
      "크레파스 상자"
    ],
    "sentences": [
      {
        "ko": "나는 미술 시간에 크레파스를 써요.",
        "situation": "학생이 미술 시간에 사용하는 도구를 설명하는 상황",
        "imagePrompt": "A Korean elementary school student drawing with crayons at a desk in an art class, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 예쁜 그림을 그리라고 크레파스를 빌려줬어요.",
        "situation": "친구가 미술 활동을 위해 크레파스를 빌려주는 상황",
        "imagePrompt": "Two Korean elementary school students sharing crayons during art class, one handing crayons to the other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "새 학년이 되니 새로운 크레파스를 샀어요.",
        "situation": "새 학년 시작을 맞아 새로운 미술 용품을 구매하는 상황",
        "imagePrompt": "A close-up of a new box of colorful crayons on a wooden desk, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple box of crayons icon, round frame, rainbow colors, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "scissors",
    "ko": "가위",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "가위예요",
      "가위입니다",
      "가위를",
      "가위였어요",
      "가위질"
    ],
    "sentences": [
      {
        "ko": "나는 종이 접기를 할 때 가위를 사용해요.",
        "situation": "학생이 특정 활동에 가위를 사용하는 방법을 설명하는 상황",
        "imagePrompt": "A Korean elementary school student carefully cutting paper with safety scissors during a craft lesson, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 안전 가위를 나눠주셨어요.",
        "situation": "선생님이 안전을 위해 특별히 제작된 가위를 학생들에게 나누어 주는 상황",
        "imagePrompt": "A Korean teacher handing out safety scissors to young students in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "조심해서 가위질 해야 해요, 친구야.",
        "situation": "친구가 가위를 사용할 때 안전하게 사용하도록 주의를 주는 상황",
        "imagePrompt": "Two Korean elementary school students working on a craft, one gently reminding the other to be careful with scissors, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple pair of safety scissors icon, round frame, blue and red tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "glue",
    "ko": "풀",
    "category": "noun",
    "subcategory": "학교생활",
    "level": 1,
    "conjugations": [
      "풀이에요",
      "풀입니다",
      "풀을",
      "풀이었어요",
      "풀칠"
    ],
    "sentences": [
      {
        "ko": "나는 만들기 시간에 풀을 사용해요.",
        "situation": "학생이 미술 활동에 풀을 사용하는 상황",
        "imagePrompt": "A Korean elementary school student applying glue to paper for a craft project, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "종이를 잘 붙이기 위해 풀을 듬뿍 발랐어요.",
        "situation": "만들기 활동에서 종이를 튼튼하게 붙이기 위해 풀을 충분히 사용하는 상황",
        "imagePrompt": "A close-up of a child's hands using a glue stick to attach paper for a craft, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "풀이 부족하면 선생님께 더 달라고 할 수 있어요.",
        "situation": "학생이 만들기 재료가 부족할 때 선생님께 도움을 요청하는 상황",
        "imagePrompt": "A Korean elementary school student asking a teacher for more glue during a craft activity, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple glue stick icon, round frame, white and green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "eat",
    "ko": "먹다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "먹어요",
      "먹습니다",
      "먹는",
      "먹었어요",
      "먹을 거예요",
      "먹자"
    ],
    "sentences": [
      {
        "ko": "나는 급식 시간에 맛있는 밥을 먹어요.",
        "situation": "학생이 점심 식사 시간에 음식을 먹는 상황",
        "imagePrompt": "A group of Korean elementary school students happily eating lunch in a cafeteria, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "점심으로 김치찌개를 먹었는데 정말 맛있었어요.",
        "situation": "학생이 특정 음식을 먹고 느낀 점을 이야기하는 상황",
        "imagePrompt": "A close-up of a bowl of steaming kimchi jjigae on a school lunch tray, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 같이 간식으로 과자 먹을래?",
        "situation": "친구가 함께 간식을 먹자고 제안하는 상황",
        "imagePrompt": "Two Korean elementary school friends sharing a bag of snacks during recess, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple fork and knife icon representing eating, round frame, brown and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "drink",
    "ko": "마시다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "마셔요",
      "마십니다",
      "마시는",
      "마셨어요",
      "마실 거예요",
      "마시자"
    ],
    "sentences": [
      {
        "ko": "나는 목이 마르면 물을 마셔요.",
        "situation": "학생이 갈증을 느낄 때 하는 행동을 설명하는 상황",
        "imagePrompt": "A Korean elementary school student drinking water from a water bottle after playing outside, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "점심 시간에 우유를 마셨는데 시원했어요.",
        "situation": "학생이 점심 시간에 우유를 마시고 느낀 점을 이야기하는 상황",
        "imagePrompt": "A Korean elementary school student drinking milk from a carton during lunch, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 같이 시원한 주스 마시자!",
        "situation": "친구가 함께 음료를 마시자고 권유하는 상황",
        "imagePrompt": "Two Korean elementary school friends toasting with juice boxes during a break, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple cup with a straw icon representing drinking, round frame, light blue and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "go",
    "ko": "가다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "가요",
      "갑니다",
      "가는",
      "갔어요",
      "갈 거예요",
      "가자"
    ],
    "sentences": [
      {
        "ko": "나는 학교에 매일 걸어서 가요.",
        "situation": "학생이 통학하는 방법을 설명하는 상황",
        "imagePrompt": "A Korean elementary school student walking to school with a backpack, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "점심 시간에 운동장으로 달려갔어요.",
        "situation": "학생이 특정 장소로 이동하는 상황",
        "imagePrompt": "A group of Korean elementary school students running towards the playground during break time, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 같이 미술관에 가자!",
        "situation": "친구가 함께 특정 장소로 가자고 제안하는 상황",
        "imagePrompt": "Two Korean elementary school friends holding hands and walking towards a museum entrance, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple arrow pointing forward icon representing going, round frame, red and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "come",
    "ko": "오다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "와요",
      "옵니다",
      "오는",
      "왔어요",
      "올 거예요",
      "오자"
    ],
    "sentences": [
      {
        "ko": "친구가 우리 집으로 놀러 와요.",
        "situation": "친구가 방문하는 상황을 설명하는 상황",
        "imagePrompt": "A Korean elementary school student welcoming a friend at their front door, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 교실로 들어오셨어요.",
        "situation": "선생님이 교실로 들어오는 상황",
        "imagePrompt": "A Korean teacher entering a classroom with a smile, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 제가 도와드리러 왔어요.",
        "situation": "학생이 선생님을 돕기 위해 다가가는 상황",
        "imagePrompt": "A Korean elementary school student offering help to a teacher in the classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple arrow pointing towards the viewer icon representing coming, round frame, green and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "sit",
    "ko": "앉다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "앉아요",
      "앉습니다",
      "앉는",
      "앉았어요",
      "앉을 거예요",
      "앉자"
    ],
    "sentences": [
      {
        "ko": "나는 책상에 바르게 앉아요.",
        "situation": "학생이 올바른 자세로 앉는 것을 설명하는 상황",
        "imagePrompt": "A Korean elementary school student sitting upright at a desk, focusing on their book, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "수업 시작 전에 모두 자리에 앉았어요.",
        "situation": "수업 시작 전에 학생들이 각자의 자리에 앉는 상황",
        "imagePrompt": "A classroom of Korean elementary school students sitting quietly at their desks, waiting for class to begin, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 내 옆에 앉을래?",
        "situation": "친구가 옆자리에 앉으라고 권유하는 상황",
        "imagePrompt": "Two Korean elementary school friends sitting next to each other at a table, one gesturing for the other to sit down, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple chair icon representing sitting, round frame, brown and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "stand",
    "ko": "서다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "서요",
      "섭니다",
      "서는",
      "섰어요",
      "서겠습니다",
      "서서"
    ],
    "sentences": [
      {
        "ko": "나는 아침마다 키가 더 크려고 쭉 서요.",
        "situation": "아침 자습 시간에 키 재기를 하는 상황",
        "imagePrompt": "A group of diverse Korean elementary school children standing tall in a classroom, reaching for the sky with their hands, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "줄을 설 때에는 키 순서대로 서야 해요.",
        "situation": "점심시간 급식 줄을 서는 상황",
        "imagePrompt": "Children lining up by height in a school cafeteria, one child pointing to the next in line, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 '차렷!' 하고 말씀하시자 모두 꼿꼿이 섰어요.",
        "situation": "체육 시간에 선생님의 지시에 따라 서는 상황",
        "imagePrompt": "A teacher in uniform standing at the front of a gymnasium, students standing at attention with straight backs, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a person standing with one leg slightly forward, round frame, blue and green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "read",
    "ko": "읽다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "읽어요",
      "읽습니다",
      "읽는",
      "읽었어요",
      "읽겠습니다",
      "읽고"
    ],
    "sentences": [
      {
        "ko": "나는 매일 밤 잠들기 전에 재미있는 책을 읽어요.",
        "situation": "잠자리에 들기 전 독서하는 상황",
        "imagePrompt": "A young Korean boy lying in bed with a book, a soft lamp casting a warm glow, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "도서관에서 친구와 함께 그림책을 소리 내어 읽었어요.",
        "situation": "학교 도서관에서 친구와 함께 책을 읽는 상황",
        "imagePrompt": "Two Korean elementary school friends sitting on the floor in a bright library, pointing at pictures in a large book, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 오늘 배울 내용을 미리 읽어보라고 하셨어요.",
        "situation": "수업 시작 전 교과서를 읽는 상황",
        "imagePrompt": "A teacher standing by a whiteboard, pointing to a textbook, students looking down at their open books, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of an open book with lines of text, round frame, yellow and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "write",
    "ko": "쓰다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "써요",
      "씁니다",
      "쓰는",
      "썼어요",
      "쓰겠습니다",
      "써서"
    ],
    "sentences": [
      {
        "ko": "나는 오늘 일기를 예쁜 글씨로 또박또박 써요.",
        "situation": "매일 일기를 쓰는 상황",
        "imagePrompt": "A Korean girl sitting at a desk, carefully writing in a diary with a colorful pen, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "미술 시간에 선생님께 이름을 예쁘게 써달라고 부탁했어요.",
        "situation": "미술 작품에 이름을 쓰는 상황",
        "imagePrompt": "A teacher helping a student write their name neatly on a drawing with a paintbrush, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친한 친구에게 생일 축하 편지를 정성껏 썼어요.",
        "situation": "친구에게 편지를 쓰는 상황",
        "imagePrompt": "A child writing a heartfelt letter with a smiley face on the envelope, sitting at a small table, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a pencil writing on a piece of paper, round frame, brown and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "speak",
    "ko": "말하다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "말해요",
      "말합니다",
      "말하는",
      "말했어요",
      "말하겠습니다",
      "말하고"
    ],
    "sentences": [
      {
        "ko": "나는 친구들과 신나게 떠들고 이야기하는 것을 좋아해요.",
        "situation": "친구들과 즐겁게 대화하는 상황",
        "imagePrompt": "A group of diverse Korean elementary school children laughing and talking animatedly together on the playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "발표 시간에 떨렸지만 용기를 내서 또박또박 말했어요.",
        "situation": "수업 시간에 발표하는 상황",
        "imagePrompt": "A young Korean boy standing in front of the class, holding a small card and speaking with a determined expression, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "궁금한 것이 있을 때는 선생님께 언제든지 물어보고 말해요.",
        "situation": "선생님께 질문하고 답하는 상황",
        "imagePrompt": "A teacher smiling kindly at a student who is raising their hand to ask a question, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a speech bubble with sound waves coming out, round frame, light blue and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "listen",
    "ko": "듣다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "들어요",
      "듣습니다",
      "듣는",
      "들었어요",
      "듣겠습니다",
      "듣고"
    ],
    "sentences": [
      {
        "ko": "나는 음악 시간에 선생님 노래를 귀 기울여 잘 들어요.",
        "situation": "음악 시간에 노래를 듣는 상황",
        "imagePrompt": "A Korean girl with closed eyes, wearing headphones and smiling slightly, listening to music in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이야기 시간마다 친구들의 재미있는 이야기를 집중해서 들었어요.",
        "situation": "이야기 시간에 친구들의 이야기를 듣는 상황",
        "imagePrompt": "A group of Korean elementary school children sitting in a circle on the floor, listening attentively to a classmate telling a story, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 설명을 하실 때는 눈을 반짝이며 열심히 들어요.",
        "situation": "수업 시간에 선생님의 설명을 듣는 상황",
        "imagePrompt": "A teacher enthusiastically explaining something on the board, students looking up with bright eyes, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of an ear with sound waves approaching, round frame, light purple and pink tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "play",
    "ko": "놀다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "놀아요",
      "놉니다",
      "노는",
      "놀았어요",
      "놀겠습니다",
      "놀고"
    ],
    "sentences": [
      {
        "ko": "나는 쉬는 시간에 친구들과 운동장에서 신나게 놀아요.",
        "situation": "쉬는 시간에 친구들과 노는 상황",
        "imagePrompt": "Diverse Korean elementary school children running and laughing on a sunny playground, playing with a ball, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "방과 후에는 집에서 장난감으로 재미있게 놀았어요.",
        "situation": "방과 후에 집에서 장난감을 가지고 노는 상황",
        "imagePrompt": "A young Korean child sitting on the floor of their room, surrounded by colorful toys, happily playing with building blocks, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "주말에는 가족들과 함께 공원에서 즐겁게 놀고 싶어요.",
        "situation": "주말에 가족과 공원에서 노는 상황",
        "imagePrompt": "A happy family playing frisbee in a park on a sunny day, with trees and flowers in the background, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of children holding hands and jumping in a circle, round frame, bright yellow and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "study",
    "ko": "공부하다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "공부해요",
      "공부합니다",
      "공부하는",
      "공부했어요",
      "공부하겠습니다",
      "공부하고"
    ],
    "sentences": [
      {
        "ko": "나는 매일 학교에서 배운 내용을 집에서 열심히 공부해요.",
        "situation": "집에서 숙제를 하거나 복습하는 상황",
        "imagePrompt": "A Korean child sitting at a desk with books and papers, concentrating on their homework, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "다음 주 시험을 위해 친구들과 함께 도서관에서 밤늦게까지 공부했어요.",
        "situation": "친구들과 함께 시험공부를 하는 상황",
        "imagePrompt": "A group of Korean elementary school students studying together in a library, pointing at books and whispering, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 어려운 문제는 옆 친구와 함께 도와가며 공부하라고 하셨어요.",
        "situation": "선생님의 지도 아래 친구와 함께 공부하는 상황",
        "imagePrompt": "A teacher observing two students working together on a math problem at their desks, one student explaining to the other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a graduation cap on top of an open book, round frame, deep blue and gold tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "draw",
    "ko": "그리다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "그려요",
      "그립니다",
      "그리는",
      "그렸어요",
      "그리겠습니다",
      "그리고"
    ],
    "sentences": [
      {
        "ko": "나는 상상력을 발휘해서 알록달록 예쁜 그림을 그려요.",
        "situation": "자유 시간에 그림을 그리는 상황",
        "imagePrompt": "A Korean girl with a colorful crayon, happily drawing a fantastical creature on a large piece of paper, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "미술 시간에 선생님께서 추천하신 동물을 멋지게 그려봤어요.",
        "situation": "미술 시간에 특정 주제로 그림을 그리는 상황",
        "imagePrompt": "A boy proudly showing his drawing of a majestic lion to the art teacher, who is smiling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 함께 우리 학교를 상상해서 재미있는 만화 그림을 그렸어요.",
        "situation": "친구와 협동하여 그림을 그리는 상황",
        "imagePrompt": "Two Korean elementary school friends sitting side-by-side, drawing a cartoon of their school with exaggerated features, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a paintbrush and a palette, round frame, rainbow colors, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "sing",
    "ko": "노래하다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "불러요",
      "부릅니다",
      "부르는",
      "불렀어요",
      "부르겠습니다",
      "부르고"
    ],
    "sentences": [
      {
        "ko": "나는 신나는 동요를 들으며 혼자서도 곧잘 불러요.",
        "situation": "혼자서 노래를 부르는 상황",
        "imagePrompt": "A young Korean boy standing in his room, singing with a joyful expression and his eyes closed, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "음악 시간에 친구들과 다 같이 우리가 좋아하는 노래를 신나게 불렀어요.",
        "situation": "음악 시간에 다 같이 노래를 부르는 상황",
        "imagePrompt": "A class of Korean elementary school children standing and singing together with microphones and musical notes floating around them, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 생일 축하 노래를 불러주시자 모두 함께 따라 불렀어요.",
        "situation": "선생님과 함께 생일 축하 노래를 부르는 상황",
        "imagePrompt": "A teacher smiling and singing 'Happy Birthday' to a student, with other students joining in, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a musical note with sound waves, round frame, bright pink and red tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "run",
    "ko": "달리다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "달려요",
      "달립니다",
      "달리는",
      "달렸어요",
      "달리겠습니다",
      "달리고"
    ],
    "sentences": [
      {
        "ko": "나는 넓은 운동장에서 친구들과 함께 신나게 달려요.",
        "situation": "운동장에서 친구들과 함께 달리는 상황",
        "imagePrompt": "Diverse Korean elementary school children enthusiastically running on a green field, their arms pumping, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "점심시간에 늦지 않으려고 교실까지 쏜살같이 달려갔어요.",
        "situation": "시간을 맞추기 위해 급하게 달려가는 상황",
        "imagePrompt": "A child running quickly down a school hallway, looking at their watch, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "체육 시간에 선생님께서 '시작!' 하자 모두 힘차게 달려갔어요.",
        "situation": "체육 시간에 달리기를 시작하는 상황",
        "imagePrompt": "A teacher holding a starting flag, children in a starting position, ready to sprint, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a runner in motion, with motion lines, round frame, vibrant blue and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "wash",
    "ko": "씻다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "씻어요",
      "씻습니다",
      "씻는",
      "씻었어요",
      "씻고",
      "씻어서"
    ],
    "sentences": [
      {
        "ko": "저는 손을 깨끗하게 씻어요.",
        "situation": "손을 씻는 상황",
        "imagePrompt": "A child washing their hands at a sink, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "점심 먹기 전에 손을 꼭 씻어야 해요.",
        "situation": "점심 식사 전 위생 습관",
        "imagePrompt": "Children lining up to wash their hands before lunch, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 우리에게 손 씻기의 중요성을 알려주셨어요.",
        "situation": "선생님의 위생 교육",
        "imagePrompt": "A teacher explaining handwashing to young students, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of hands under running water, round frame, blue and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "sleep",
    "ko": "자다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "자요",
      "잡니다",
      "자는",
      "잤어요",
      "자고",
      "자서"
    ],
    "sentences": [
      {
        "ko": "저는 밤에 푹 자요.",
        "situation": "숙면을 취하는 상황",
        "imagePrompt": "A child sleeping soundly in bed, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "낮잠을 자면 오후에 힘이 나요.",
        "situation": "낮잠 후 활력",
        "imagePrompt": "A child taking a nap on a mat, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 졸려서 꾸벅꾸벅 졸고 있었어요.",
        "situation": "친구가 졸린 모습",
        "imagePrompt": "A child dozing off in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a crescent moon and stars, round frame, blue and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "give",
    "ko": "주다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "줘요",
      "줍니다",
      "주는",
      "줬어요",
      "주고",
      "줘서"
    ],
    "sentences": [
      {
        "ko": "저는 친구에게 연필을 줘요.",
        "situation": "연필을 빌려주는 상황",
        "imagePrompt": "A child giving a pencil to another child, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 숙제를 다 한 친구에게 칭찬 스티커를 주셨어요.",
        "situation": "칭찬 스티커를 받는 상황",
        "imagePrompt": "A teacher giving a sticker to a student, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "생일 선물로 동생에게 멋진 장난감을 줬어요.",
        "situation": "동생에게 생일 선물을 주는 상황",
        "imagePrompt": "A child giving a toy to their younger sibling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of an open hand with an arrow pointing out, round frame, orange and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "receive",
    "ko": "받다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "받아요",
      "받습니다",
      "받는",
      "받았어요",
      "받고",
      "받아서"
    ],
    "sentences": [
      {
        "ko": "저는 생일 선물을 받아서 기뻐요.",
        "situation": "생일 선물을 받는 상황",
        "imagePrompt": "A child happily receiving a birthday gift, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구에게서 맛있는 간식을 받았어요.",
        "situation": "친구에게 간식을 받는 상황",
        "imagePrompt": "A child receiving a snack from a friend, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께 칭찬을 받으면 정말 신나요.",
        "situation": "선생님께 칭찬을 받는 상황",
        "imagePrompt": "A child receiving praise from a teacher, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of an open hand with an arrow pointing in, round frame, green and blue tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "make",
    "ko": "만들다",
    "category": "verb",
    "subcategory": "일상동사",
    "level": 1,
    "conjugations": [
      "만들어요",
      "만듭니다",
      "만드는",
      "만들었어요",
      "만들고",
      "만들어서"
    ],
    "sentences": [
      {
        "ko": "저는 그림을 멋지게 만들어요.",
        "situation": "그림을 그리는 상황",
        "imagePrompt": "A child creating a drawing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "미술 시간에 종이접기로 비행기를 만들었어요.",
        "situation": "종이접기 활동",
        "imagePrompt": "Children making paper airplanes in art class, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구와 함께 맛있는 쿠키를 만들 거예요.",
        "situation": "친구와 요리 활동",
        "imagePrompt": "Two children making cookies together, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of hands shaping clay or dough, round frame, brown and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "big",
    "ko": "크다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "커요",
      "큽니다",
      "큰",
      "컸어요",
      "크고",
      "커서"
    ],
    "sentences": [
      {
        "ko": "이 공룡은 아주 커요.",
        "situation": "공룡 장난감을 보고 하는 말",
        "imagePrompt": "A child looking at a large dinosaur toy, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 학교에는 큰 운동장이 있어요.",
        "situation": "학교 운동장을 묘사하는 상황",
        "imagePrompt": "A wide school playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 큰 목소리로 우리를 불러주셨어요.",
        "situation": "선생님의 큰 목소리",
        "imagePrompt": "A teacher speaking with a loud voice to students, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of an upward-pointing arrow expanding, round frame, red and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "small",
    "ko": "작다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "작아요",
      "작습니다",
      "작은",
      "작았어요",
      "작고",
      "작아서"
    ],
    "sentences": [
      {
        "ko": "이 강아지는 아주 작아요.",
        "situation": "작은 강아지를 보고 하는 말",
        "imagePrompt": "A child looking at a small puppy, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "책상 위에 작은 연필이 있어요.",
        "situation": "책상 위 물건 묘사",
        "imagePrompt": "A small pencil on a school desk, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 작은 목소리로 속삭였어요.",
        "situation": "친구가 작은 목소리로 말하는 상황",
        "imagePrompt": "A child whispering to another child, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a downward-pointing arrow contracting, round frame, blue and green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "hot",
    "ko": "덥다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "더워요",
      "덥습니다",
      "더운",
      "더웠어요",
      "덥고",
      "더워서"
    ],
    "sentences": [
      {
        "ko": "오늘 날씨가 아주 더워요.",
        "situation": "더운 날씨에 대한 묘사",
        "imagePrompt": "Children feeling hot on a sunny day, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "더워서 아이스크림을 먹고 싶어요.",
        "situation": "더위를 식히고 싶은 상황",
        "imagePrompt": "A child wanting to eat ice cream on a hot day, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 더울 때는 물을 많이 마시라고 하셨어요.",
        "situation": "더울 때 건강 관리 조언",
        "imagePrompt": "A teacher advising students to drink water on a hot day, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a sun with heat waves, round frame, yellow and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "cold",
    "ko": "춥다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "추워요",
      "춥습니다",
      "추운",
      "추웠어요",
      "춥고",
      "추워서"
    ],
    "sentences": [
      {
        "ko": "겨울에는 날씨가 정말 추워요.",
        "situation": "추운 겨울 날씨 묘사",
        "imagePrompt": "Children bundled up in winter clothes, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "추워서 따뜻한 국물을 먹었어요.",
        "situation": "추운 날 따뜻한 음식을 먹는 상황",
        "imagePrompt": "A child eating warm soup on a cold day, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구가 추워서 몸을 웅크리고 있었어요.",
        "situation": "친구가 추위에 떨고 있는 모습",
        "imagePrompt": "A child shivering from the cold, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a snowflake, round frame, blue and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "pretty",
    "ko": "예쁘다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "예뻐요",
      "예쁩니다",
      "예쁜",
      "예뻤어요",
      "예쁘고",
      "예뻐서"
    ],
    "sentences": [
      {
        "ko": "이 꽃은 정말 예뻐요.",
        "situation": "아름다운 꽃을 보고 하는 말",
        "imagePrompt": "A child admiring a beautiful flower, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "새로 산 옷이 아주 예뻐서 마음에 들어요.",
        "situation": "새 옷에 대한 만족감 표현",
        "imagePrompt": "A child smiling at their new, pretty clothes, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구의 그림이 너무 예뻐서 칭찬해 주었어요.",
        "situation": "친구의 그림을 칭찬하는 상황",
        "imagePrompt": "A child complimenting a friend's pretty drawing, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a smiling flower, round frame, pink and purple tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "delicious",
    "ko": "맛있다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "맛있어요",
      "맛있습니다",
      "맛있는",
      "맛있었던",
      "맛없어요",
      "맛없습니다"
    ],
    "sentences": [
      {
        "ko": "이 떡볶이가 정말 맛있어요.",
        "situation": "점심 시간에 급식으로 나온 떡볶이를 먹으며",
        "imagePrompt": "A student happily eating tteokbokki in a school cafeteria, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님께서 주신 간식이 아주 맛있었습니다.",
        "situation": "선생님이 간식을 나눠주셨을 때",
        "imagePrompt": "A teacher handing out snacks to smiling students in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 엄마가 만들어준 김밥은 세상에서 제일 맛있어!",
        "situation": "친구에게 엄마가 싸준 김밥에 대해 이야기하며",
        "imagePrompt": "Two young friends sharing lunchboxes at a school picnic table, one pointing enthusiastically at their food, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a steaming bowl of food, round frame, warm orange and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "difficult",
    "ko": "어렵다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 2,
    "conjugations": [
      "어려워요",
      "어렵습니다",
      "어려운",
      "어려웠던",
      "쉽지 않아요",
      "쉽지 않습니다"
    ],
    "sentences": [
      {
        "ko": "오늘 수학 문제가 좀 어려워요.",
        "situation": "수업 시간에 수학 문제를 풀다가",
        "imagePrompt": "A student looking puzzled at a math problem on a blackboard in a classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이 글씨는 너무 어려워서 잘 읽을 수가 없어요.",
        "situation": "칠판에 쓰인 글씨가 작거나 복잡할 때",
        "imagePrompt": "A child squinting at small, complex handwriting on a classroom whiteboard, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 이 숙제 좀 어렵지 않아?",
        "situation": "친구와 함께 숙제를 하다가",
        "imagePrompt": "Two friends sitting together at a desk, one pointing to a homework sheet with a questioning look, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a tangled knot, round frame, muted purple and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "easy",
    "ko": "쉽다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "쉬워요",
      "쉽습니다",
      "쉬운",
      "쉬웠던",
      "어렵지 않아요",
      "어렵지 않습니다"
    ],
    "sentences": [
      {
        "ko": "이 그림 그리기는 정말 쉬워요.",
        "situation": "미술 시간에 그림을 그리며",
        "imagePrompt": "A child smiling while easily drawing a picture in art class, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 이 문제는 정말 쉬운 것 같아요.",
        "situation": "선생님께 퀴즈의 난이도에 대해 이야기할 때",
        "imagePrompt": "A student raising their hand with a confident smile to answer a teacher's question, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 같이 하면 이 놀이 정말 쉽겠지?",
        "situation": "새로운 놀이를 시작하기 전에 친구에게 물어보며",
        "imagePrompt": "Two friends high-fiving before starting a simple game on the playground, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a feather, round frame, light blue and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "fast",
    "ko": "빠르다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 1,
    "conjugations": [
      "빨라요",
      "빠릅니다",
      "빠른",
      "빨랐던",
      "느리지 않아요",
      "느리지 않습니다"
    ],
    "sentences": [
      {
        "ko": "나는 달리기 시합에서 아주 빨라요.",
        "situation": "운동장에서 달리기 시합을 하며",
        "imagePrompt": "A child running very fast in a school race, leaving others behind, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "이 로봇은 움직임이 정말 빠르네요.",
        "situation": "과학 시간에 만든 로봇의 작동 모습을 보며",
        "imagePrompt": "Children gathered around a table watching a robot move quickly, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "우리 반이 퀴즈에서 제일 빠른 답을 맞혔어요!",
        "situation": "반 친구들과 함께 퀴즈 대회에서 우승했을 때",
        "imagePrompt": "A group of excited students celebrating a quiz victory, one holding up a trophy, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a lightning bolt, round frame, bright yellow and orange tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "slow",
    "ko": "느리다",
    "category": "adjective",
    "subcategory": "일상형용사",
    "level": 2,
    "conjugations": [
      "느려요",
      "느립니다",
      "느린",
      "느렸던",
      "빠르지 않아요",
      "빠르지 않습니다"
    ],
    "sentences": [
      {
        "ko": "이 거북이는 정말 느려요.",
        "situation": "과학 시간에 동물을 관찰하며",
        "imagePrompt": "A child observing a very slow-moving turtle in a classroom terrarium, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "버스 안에서는 모든 것이 느리게 느껴져요.",
        "situation": "학교 가는 버스 안에서 창밖을 보며",
        "imagePrompt": "A child looking out the window of a slow-moving school bus at passing scenery, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "천천히 해도 괜찮아요, 우리 아직 시간이 많아요.",
        "situation": "친구에게 서두르지 않아도 된다고 말하며",
        "imagePrompt": "Two friends working together on a craft project at a slow pace, one reassuring the other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a snail, round frame, earthy brown and green tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "hello",
    "ko": "안녕하세요",
    "category": "expression",
    "subcategory": "인사",
    "level": 1,
    "conjugations": [
      "안녕하세요",
      "안녕하십니다",
      "안녕하셨어요",
      "안녕하셨습니다"
    ],
    "sentences": [
      {
        "ko": "선생님, 안녕하세요!",
        "situation": "아침에 교실에 들어오며 선생님께 인사할 때",
        "imagePrompt": "A student cheerfully greeting their teacher with a wave at the classroom door, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "새로운 친구야, 반가워! 안녕하세요?",
        "situation": "새로 전학 온 친구에게 다가가며",
        "imagePrompt": "A friendly student approaching a new classmate with a smile and outstretched hand, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "안녕하세요, 친구들! 오늘 날씨가 정말 좋네요.",
        "situation": "운동장에서 친구들을 만나며",
        "imagePrompt": "A group of children meeting on the schoolyard, waving and smiling at each other, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a waving hand, round frame, bright pink and yellow tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "goodbye",
    "ko": "안녕히 가세요",
    "category": "expression",
    "subcategory": "인사",
    "level": 1,
    "conjugations": [
      "안녕히 가세요",
      "안녕히 계세요",
      "안녕히 갔습니다",
      "안녕히 있었습니다"
    ],
    "sentences": [
      {
        "ko": "선생님, 안녕히 가세요!",
        "situation": "하교 시간에 선생님께 인사하며",
        "imagePrompt": "Students waving goodbye to their teacher at the school gate, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "친구야, 내일 보자! 안녕히 가!",
        "situation": "하교길에 친구와 헤어지며",
        "imagePrompt": "Two friends waving goodbye to each other on the sidewalk outside the school, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "오늘 즐거웠어요, 안녕히 계세요!",
        "situation": "방과 후 활동이 끝나고 집으로 돌아가며",
        "imagePrompt": "A child leaving a classroom after an after-school club, waving to remaining students, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a waving hand with a small suitcase, round frame, soft blue and grey tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "thanks",
    "ko": "감사합니다",
    "category": "expression",
    "subcategory": "인사",
    "level": 1,
    "conjugations": [
      "감사합니다",
      "고맙습니다",
      "감사했어요",
      "고마웠어요",
      "감사해요",
      "고마워요"
    ],
    "sentences": [
      {
        "ko": "도와주셔서 정말 감사합니다, 친구야.",
        "situation": "친구가 어려운 문제를 도와줬을 때",
        "imagePrompt": "A student receiving help with a book from a friend, both smiling, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선생님, 오늘 좋은 가르침 감사합니다.",
        "situation": "수업이 끝난 후 선생님께 감사 인사를 전하며",
        "imagePrompt": "A student bowing respectfully to their teacher at the front of the classroom, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "선물 정말 고마워요! 아주 마음에 들어요.",
        "situation": "생일 선물을 받았을 때",
        "imagePrompt": "A child happily opening a birthday present, looking delighted, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of clasped hands with a heart, round frame, warm red and gold tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "excuse_me",
    "ko": "잠깐만요",
    "category": "expression",
    "subcategory": "인사",
    "level": 1,
    "conjugations": [
      "잠깐만요",
      "잠시만요",
      "잠깐만 기다려 주세요",
      "잠시만 기다려 주세요"
    ],
    "sentences": [
      {
        "ko": "선생님, 잠깐만요. 제가 일어나서 대답하겠습니다.",
        "situation": "수업 중에 질문을 받기 위해 자리에서 일어날 때",
        "imagePrompt": "A student raising their hand and saying 'excuse me' to the teacher before standing up, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "죄송해요, 친구야. 잠깐만 지나갈게요.",
        "situation": "좁은 복도에서 친구를 지나치기 위해",
        "imagePrompt": "A child politely asking a friend to move aside to pass in a crowded school hallway, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "잠깐만요, 제가 먼저 가서 문을 열어줄게요.",
        "situation": "친구가 짐을 들고 있을 때 문을 열어주며",
        "imagePrompt": "A child holding a door open for a friend carrying books, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a person gently tapping a shoulder, round frame, light green and white tones, soft watercolor, child-friendly, minimal, no text"
  },
  {
    "id": "congrats",
    "ko": "축하해요",
    "category": "expression",
    "subcategory": "인사",
    "level": 1,
    "conjugations": [
      "축하해요",
      "축하합니다",
      "축하했어요",
      "축하했습니다"
    ],
    "sentences": [
      {
        "ko": "우승한 너를 정말 축하해!",
        "situation": "친구의 운동회 우승을 축하하며",
        "imagePrompt": "A student hugging a friend who just won a race on the school sports day, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "발표를 멋지게 마친 친구, 축하해요!",
        "situation": "발표를 성공적으로 마친 친구에게",
        "imagePrompt": "A group of students clapping enthusiastically for a classmate who finished a presentation, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      },
      {
        "ko": "생일 진심으로 축하해요, 나의 소중한 친구!",
        "situation": "친구의 생일을 축하하며",
        "imagePrompt": "A child holding a birthday cake with candles for a friend, both smiling warmly, soft watercolor illustration, Korean elementary school, diverse children age 7-9, gentle pastel colors, warm atmosphere, no text, 16:9"
      }
    ],
    "imagePrompt": "A simple icon of a party popper with confetti, round frame, vibrant multi-colored tones, soft watercolor, child-friendly, minimal, no text"
  }
] as VocabWord[];

export const VOCAB_BY_ID: Record<string, VocabWord> = Object.fromEntries(
  VOCAB_WORDS.map(w => [w.id, w])
);

export const VOCAB_BY_CATEGORY: Record<string, VocabWord[]> = {};
for (const w of VOCAB_WORDS) {
  (VOCAB_BY_CATEGORY[w.subcategory] ??= []).push(w);
}
