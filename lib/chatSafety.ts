// Safety filter used both client-side (pre-block) and server-side (final check).
// Conservative list aimed at elementary school context. Uses lowercase substring match
// since most languages in scope render text in Unicode; obvious leetspeak/obfuscation
// is intentionally not handled (children are the user, not adversaries).

// === Tier 1: block immediately, don't forward to LLM ===
// Obvious profanity, sexual content, severe violence. Not exhaustive — the
// server-side LLM also has hardening in its system prompt.
const BLOCK_SUBSTRINGS: string[] = [
  // Korean — profanity
  "씨발", "시발", "씨빨", "시빨", "씨팔", "시팔",
  "개새끼", "개새", "개자식", "개놈", "개년", "개쓰레기",
  "병신", "븅신", "미친놈", "미친년",
  "좆", "좇", "존나", "졸라",
  "꺼져", "닥쳐",
  "죽어", "뒤져", "뒤질",
  "지랄", "지럴",
  "ㅅㅂ", "ㅆㅂ", "ㅂㅅ", "ㅄ", "ㅈㄹ",
  // Korean — sexual
  "섹스", "야동", "성관계", "포르노", "자지", "보지", "꼴리",
  // Korean — meta / jailbreak hints
  "욕해", "욕 해", "욕해봐", "욕해줘", "나쁜말", "나쁜 말",
  // English
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "cunt",
  "porn", "sex ", "nude", "naked", "bastard",
  // Vietnamese
  "đụ", "địt", "cặc", "lồn",
  // Chinese simplified / traditional
  "操你", "傻逼", "滚开", "去死", "混蛋",
  // Japanese
  "死ね", "馬鹿野郎", "くそ", "ちんこ", "まんこ",
  // Filipino/Tagalog
  "putang", "gago", "tanga ka", "bobo ka",
  // Arabic
  "كلب", "زبي", "عرص",
  // Generic test tokens we treat as blocked to keep demos clean
  "kill yourself",
];

// === Tier 2: distress signals. Fire teacher alert AND respond with safe template. ===
// We bias toward false-positives here — a momentary alert to the teacher is
// cheap, a missed one is not.
const DISTRESS_SUBSTRINGS: string[] = [
  // Self-harm / suicide (Korean)
  "자살", "죽고싶", "죽고 싶", "죽어버리", "나를 해치", "자해",
  // Korean — abuse / fear at home
  "아빠가 때려", "엄마가 때려", "맞았어", "무서워서 집에", "집이 무서",
  "학대", "성추행", "성폭행",
  // English
  "kill myself", "want to die", "suicide", "end my life", "hurt myself",
  "self harm", "self-harm",
  "being abused", "he hit me", "she hit me", "beat me up", "scared at home",
  // Vietnamese
  "tự tử", "muốn chết", "bị đánh",
  // Chinese
  "想死", "自杀", "被打",
  // Japanese
  "死にたい", "自殺", "殴られ",
  // Filipino
  "gusto kong mamatay", "papatayin ko sarili",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface SafetyCheck {
  blocked: boolean;
  distress: boolean;
  reason?: string;
}

export function checkSafety(text: string): SafetyCheck {
  if (!text) return { blocked: false, distress: false };
  const n = normalize(text);

  for (const kw of DISTRESS_SUBSTRINGS) {
    if (n.includes(kw.toLowerCase())) {
      return { blocked: false, distress: true, reason: kw };
    }
  }

  for (const kw of BLOCK_SUBSTRINGS) {
    if (n.includes(kw.toLowerCase())) {
      return { blocked: true, distress: false, reason: kw };
    }
  }

  return { blocked: false, distress: false };
}

// Fixed safe response when distress is detected.
// Returned in the student's own language; falls back to Korean then English.
export const DISTRESS_REPLY: Record<string, string> = {
  ko: "그런 이야기는 선생님이나 가족에게 꼭 말해줘. 너는 정말 소중한 사람이야.",
  en: "Please tell your teacher or a family member about this. You are very important.",
  vi: "Hãy kể điều này với thầy cô hoặc gia đình nhé. Bạn rất quan trọng.",
  zh: "请一定告诉老师或家人,你是非常重要的人。",
  fil: "Mahalagang sabihin ito sa guro o pamilya mo. Napakahalaga mo.",
  ja: "そのことは せんせいや かぞくに かならず はなしてね。あなたは とても たいせつな ひとだよ。",
  th: "กรุณาบอกครูหรือครอบครัวนะ เธอสำคัญมาก",
  km: "សូមប្រាប់គ្រូ ឬគ្រួសារ។ អ្នកមានតម្លៃណាស់។",
  mn: "Энэ тухай багштайгаа эсвэл гэр бүлтэйгээ ярилцаарай. Чи маш үнэ цэнэтэй.",
  ru: "Пожалуйста, расскажи об этом учителю или семье. Ты очень важен.",
  uz: "Bu haqda o'qituvchingizga yoki oilangizga ayting. Siz juda muhimsiz.",
  hi: "कृपया यह बात अपने शिक्षक या परिवार को बताएं। आप बहुत महत्वपूर्ण हैं।",
  id: "Tolong ceritakan ini kepada gurumu atau keluargamu. Kamu sangat berharga.",
  ar: "من فضلك أخبر معلمك أو عائلتك بذلك. أنت مهم جدًا.",
  my: "ဒါကိုဆရာ သို့မဟုတ် မိသားစုကိုပြောပြပါ။ သင်အရမ်းအရေးကြီးပါတယ်။",
};

// First-offense warning when a block is detected. Explicitly tells the student
// that continuing will notify the teacher.
export const BLOCK_WARNING: Record<string, string> = {
  ko: "그런 말은 우리 이야기에 어울리지 않아. 계속하면 선생님께 알림이 가요. 다른 이야기를 해볼까?",
  en: "That word doesn't fit our story. If you keep saying it, your teacher will be notified. Let's talk about something else!",
  vi: "Lời đó không hợp với câu chuyện của chúng ta. Nếu bạn tiếp tục, thầy cô sẽ được thông báo. Hãy nói chuyện khác nhé!",
  zh: "这样的话不适合我们的故事哦。如果继续说,老师会收到通知。我们聊点别的吧!",
  fil: "Hindi bagay ang salitang iyon sa kwento natin. Kung magpapatuloy ka, aabisuhan ang guro mo. Mag-usap tayo ng iba!",
  ja: "その ことばは おはなしに あわないよ。つづけたら せんせいに しらせが いくよ。 ほかの おはなしを しよう!",
  th: "คำนั้นไม่เหมาะกับเรื่องของเรา ถ้ายังพูดต่อ ครูจะได้รับแจ้ง คุยเรื่องอื่นกันดีกว่า!",
  km: "ពាក្យនេះមិនសមនឹងរឿងយើងទេ។ បើបន្ត គ្រូនឹងទទួលការជូនដំណឹង។ តោះនិយាយរឿងផ្សេង!",
  mn: "Энэ үг манай түүхэнд тохиромжгүй. Үргэлжлүүлбэл багшид мэдэгдэнэ. Өөр юм ярьцгаая!",
  ru: "Такое слово не подходит к нашей истории. Если продолжишь, учителю придёт уведомление. Давай о другом!",
  uz: "Bu so'z bizning ertagimizga mos emas. Davom etsangiz, o'qituvchingizga xabar boradi. Boshqa narsa haqida gaplashaylik!",
  hi: "ऐसा शब्द हमारी कहानी में नहीं चलता। अगर फिर कहोगे तो शिक्षक को सूचना जाएगी। कुछ और बात करें!",
  id: "Kata itu tidak cocok untuk cerita kita. Kalau diteruskan, guru akan mendapat pemberitahuan. Ayo bicarakan hal lain!",
  ar: "هذه الكلمة لا تناسب قصتنا. إذا استمريت فسيتم إخطار معلمك. لنتحدث في موضوع آخر!",
  my: "ဒီစကားက ကျွန်တော်တို့ပုံပြင်နဲ့ မဆီလျော်ဘူး။ ဆက်ပြောရင် ဆရာကို အသိပေးလိုက်မယ်။ တခြားစကားပြောရအောင်!",
};

// Shown when input is blocked but not distress (e.g. profanity).
// Soft redirect — stays in character flavor if possible.
export const BLOCK_REPLY: Record<string, string> = {
  ko: "음… 그건 우리 이야기랑 잘 안 맞는 말 같아. 다른 걸 물어봐줘!",
  en: "Hmm… that doesn't really fit our story. Try asking something else!",
  vi: "Ừm… câu đó không hợp với câu chuyện của chúng ta. Hỏi điều khác nhé!",
  zh: "嗯…那不太符合我们的故事哦。问点别的吧!",
  fil: "Hmm… hindi bagay sa kwento natin 'yon. Subukan nating magtanong ng iba!",
  ja: "うーん… それは ぼくたちの おはなしと ちょっと ちがうみたい。 ほかの ことを きいてね!",
  th: "อืม… คำนั้นไม่ค่อยเข้ากับเรื่องของเรา ลองถามอย่างอื่นดูนะ!",
  km: "អូ... វាមិនស្របនឹងរឿងយើងទេ។ សូមសួរអ្វីផ្សេងទៀត!",
  mn: "Хмм… энэ бол манай түүхэнд таарахгүй юм шиг. Өөр юм асуугаад үз!",
  ru: "Хм… это не подходит к нашей истории. Спроси что-нибудь другое!",
  uz: "Hmm… bu bizning ertagimizga mos kelmaydi. Boshqa narsa so'rang!",
  hi: "हम्म… यह हमारी कहानी से मेल नहीं खाता। कुछ और पूछें!",
  id: "Hmm… itu tidak cocok dengan cerita kita. Coba tanya yang lain!",
  ar: "حسنًا... هذا لا يناسب قصتنا. اسأل شيئًا آخر!",
  my: "ဟမ်… အဲဒါ ကျွန်တော်တို့ရဲ့ပုံပြင်နဲ့ အဆင်မပြေဘူး။ တခြားမေးပါ!",
};

export function replyForSafety(lang: string, kind: "distress" | "block" | "warning"): string {
  const table =
    kind === "distress" ? DISTRESS_REPLY
    : kind === "warning" ? BLOCK_WARNING
    : BLOCK_REPLY;
  return table[lang] || table.ko || table.en;
}
