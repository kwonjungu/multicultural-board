/**
 * BookStudy 샘플 데이터 — 기존 그림책 에셋에서 가져온 캐릭터 + 질문 프리셋
 */

export interface BookStudySample {
  id: string;
  bookTitle: Record<string, string>;
  character: {
    name: Record<string, string>;
    imageUrl: string;
    emoji: string;
  };
  questions: {
    id: string;
    text: Record<string, string>;
    tier: string;
  }[];
}

export const BOOK_STUDY_SAMPLES: BookStudySample[] = [
  {
    id: "curious-worlds-buzzy",
    bookTitle: {
      ko: "붕붕이의 궁금 여행",
      en: "Buzzy's Curious Trip",
      vi: "Chuyến Du Hành Tò Mò Của Buzzy",
      zh: "小蜜蜂的好奇之旅",
      fil: "Ang Mausisang Paglalakbay ni Buzzy",
      ja: "ブンブンの ふしぎなたび",
    },
    character: {
      name: { ko: "붕붕이", en: "Buzzy", vi: "Buzzy", zh: "布兹", fil: "Buzzy", ja: "ブンブン" },
      imageUrl: "/storybooks/curious-worlds/char-buzzy.png",
      emoji: "🐝",
    },
    questions: [
      {
        id: "q-intro-1",
        tier: "intro",
        text: {
          ko: "표지의 붕붕이는 어디로 가려는 것 같나요?",
          en: "Where do you think Buzzy on the cover is going?",
          vi: "Bạn nghĩ Buzzy trên bìa sẽ đi đâu?",
          zh: "你觉得封面上的小蜜蜂要去哪里?",
          fil: "Saan sa tingin mo pupunta si Buzzy sa pabalat?",
          ja: "ひょうしの ブンブンは どこへ いこうと しているのかな?",
        },
      },
      {
        id: "q-intro-2",
        tier: "intro",
        text: {
          ko: "여러분이 가장 가보고 싶은 곳은 어디인가요?",
          en: "Where would you most like to go?",
          vi: "Bạn muốn đến đâu nhất?",
          zh: "你最想去的地方是哪里?",
          fil: "Saan mo pinaka-gustong pumunta?",
          ja: "いちばん いってみたい ところは どこですか?",
        },
      },
      {
        id: "q-core-1",
        tier: "core",
        text: {
          ko: "붕붕이는 왜 여러 곳을 탐험했을까요?",
          en: "Why did Buzzy explore so many places?",
          vi: "Vì sao Buzzy khám phá nhiều nơi đến vậy?",
          zh: "小蜜蜂为什么要去这么多地方?",
          fil: "Bakit maraming lugar na pinuntahan si Buzzy?",
          ja: "ブンブンは どうして いろんな ばしょを たんけんしたのでしょう?",
        },
      },
      {
        id: "q-deep-1",
        tier: "deep",
        text: {
          ko: "내가 가장 궁금한 세계는 어디인가요? 어떤 방법(책·영상·VR 등)으로 알아볼 수 있을까요?",
          en: "What world are you most curious about? How could you explore it — books, videos, VR?",
          vi: "Bạn tò mò nhất về thế giới nào? Bạn sẽ khám phá bằng cách nào — sách, video, VR?",
          zh: "你最好奇的世界是哪里?你会用什么方法(书、视频、VR…)去了解?",
          fil: "Anong mundo ang pinaka-gusto mong alamin? Paano mo ito tuklasin — sa libro, video, VR?",
          ja: "いちばん きになる せかいは どこですか? どんな ほうほう(ほん・どうが・VRなど)で しらべますか?",
        },
      },
      {
        id: "q-concept-2",
        tier: "concept",
        text: {
          ko: "탐험을 하고 나서 붕붕이에게는 어떤 '변화'가 생겼을까요?",
          en: "What 'change' happened to Buzzy after exploring?",
          vi: "Buzzy có 'thay đổi' gì sau chuyến khám phá?",
          zh: "探险之后,小蜜蜂发生了什么「变化」?",
          fil: "Anong 'pagbabago' ang nangyari kay Buzzy pagkatapos?",
          ja: "たんけんの あとで ブンブンには どんな『へんか』が ありましたか?",
        },
      },
    ],
  },
  {
    id: "curious-worlds-star-grandpa",
    bookTitle: {
      ko: "붕붕이의 궁금 여행",
      en: "Buzzy's Curious Trip",
      vi: "Chuyến Du Hành Tò Mò Của Buzzy",
      zh: "小蜜蜂的好奇之旅",
      fil: "Ang Mausisang Paglalakbay ni Buzzy",
      ja: "ブンブンの ふしぎなたび",
    },
    character: {
      name: { ko: "별 할아버지", en: "Grandpa Star", vi: "Ông Sao", zh: "星爷爷", fil: "Lolo Bituin", ja: "ほしじいさん" },
      imageUrl: "/storybooks/curious-worlds/char-star-grandpa.png",
      emoji: "🌟",
    },
    questions: [
      {
        id: "q-star-1",
        tier: "intro",
        text: {
          ko: "별은 왜 반짝일까요? 여러분의 생각을 말해보세요.",
          en: "Why do stars twinkle? Tell us what you think!",
          vi: "Tại sao các ngôi sao lấp lánh? Hãy nói suy nghĩ của bạn!",
          zh: "星星为什么会闪闪发光?说说你的想法!",
          fil: "Bakit kumikislap ang mga bituin? Sabihin ang iyong iniisip!",
          ja: "ほしは どうして きらきら するのかな? みんなの かんがえを おしえて!",
        },
      },
      {
        id: "q-star-2",
        tier: "deep",
        text: {
          ko: "별 할아버지처럼 누군가에게 무언가를 알려준 적이 있나요? 그때 어떤 기분이었나요?",
          en: "Have you ever taught someone something, like Grandpa Star? How did that feel?",
          vi: "Bạn đã bao giờ dạy ai đó điều gì, giống Ông Sao? Cảm giác thế nào?",
          zh: "你有没有像星爷爷一样教别人什么?那时候心情如何?",
          fil: "May naturo ka na ba sa iba tulad ni Lolo Bituin? Ano ang naramdaman mo?",
          ja: "ほしじいさんみたいに だれかに なにかを おしえたこと ありますか? そのとき どんな きもちでしたか?",
        },
      },
    ],
  },
  {
    id: "seasons-beauty-buzzy",
    bookTitle: {
      ko: "사계절 아름다운 세상",
      en: "Beautiful World of Seasons",
      vi: "Thế Giới Tuyệt Đẹp Bốn Mùa",
      zh: "四季美丽的世界",
      fil: "Magandang Mundo ng Panahon",
      ja: "きせつの うつくしい せかい",
    },
    character: {
      name: { ko: "붕붕이", en: "Buzzy", vi: "Buzzy", zh: "布兹", fil: "Buzzy", ja: "ブンブン" },
      imageUrl: "/storybooks/seasons-beauty/char-buzzy.png",
      emoji: "🐝",
    },
    questions: [
      {
        id: "q-seasons-1",
        tier: "intro",
        text: {
          ko: "여러분이 가장 좋아하는 계절은 무엇인가요? 왜 좋아해요?",
          en: "What is your favorite season? Why do you like it?",
          vi: "Bạn thích mùa nào nhất? Vì sao?",
          zh: "你最喜欢什么季节?为什么?",
          fil: "Anong panahon ang paborito mo? Bakit?",
          ja: "いちばん すきな きせつは なんですか? なぜ すきですか?",
        },
      },
      {
        id: "q-seasons-2",
        tier: "core",
        text: {
          ko: "계절이 바뀌면 우리 생활에서 어떤 것들이 달라지나요?",
          en: "What changes in our daily life when the season changes?",
          vi: "Khi đổi mùa, những gì thay đổi trong cuộc sống hàng ngày của bạn?",
          zh: "季节变化时,我们的生活会有什么不同?",
          fil: "Ano ang nagbabago sa buhay natin kapag nagpalit ang panahon?",
          ja: "きせつが かわると せいかつで なにが かわりますか?",
        },
      },
      {
        id: "q-seasons-3",
        tier: "deep",
        text: {
          ko: "나라마다 계절이 다를까요? 친구들의 나라에서는 지금 어떤 계절인가요?",
          en: "Are seasons different in every country? What season is it now in your friends' countries?",
          vi: "Mỗi nước có mùa khác nhau không? Nước bạn đang mùa gì?",
          zh: "每个国家的季节都一样吗?朋友们的国家现在是什么季节?",
          fil: "Magkaiba ba ang panahon sa bawat bansa? Anong panahon ngayon sa bansa ng iyong mga kaibigan?",
          ja: "くにによって きせつは ちがうのかな? ともだちの くにでは いま どんな きせつ?",
        },
      },
    ],
  },
];
