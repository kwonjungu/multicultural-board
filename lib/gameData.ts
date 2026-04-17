// Game data: vocabulary, countries, greetings, emotions, situations
// All keyed by the 15 supported language codes. Missing langs fall back to English.

export type LangMap = Partial<Record<string, string>>;

export interface VocabItem {
  key: string;
  emoji: string;
  translations: LangMap;
}

export const VOCAB: VocabItem[] = [
  { key: "apple",   emoji: "🍎", translations: { ko: "사과",   en: "apple",    vi: "quả táo",    zh: "苹果",   ja: "りんご",  th: "แอปเปิ้ล",  id: "apel",     hi: "सेब",     ru: "яблоко",   ar: "تفاحة",   fil: "mansanas", km: "ផ្លែប៉ោម",  mn: "алим",    uz: "olma",    my: "ပန်းသီး" } },
  { key: "banana",  emoji: "🍌", translations: { ko: "바나나", en: "banana",   vi: "chuối",      zh: "香蕉",   ja: "バナナ",  th: "กล้วย",    id: "pisang",   hi: "केला",    ru: "банан",    ar: "موز",     fil: "saging",   km: "ចេក",        mn: "гадил",   uz: "banan",   my: "ငှက်ပျောသီး" } },
  { key: "dog",     emoji: "🐶", translations: { ko: "강아지", en: "dog",      vi: "con chó",    zh: "狗",     ja: "犬",      th: "สุนัข",     id: "anjing",   hi: "कुत्ता",  ru: "собака",   ar: "كلب",     fil: "aso",      km: "ឆ្កែ",        mn: "нохой",   uz: "it",      my: "ခွေး" } },
  { key: "cat",     emoji: "🐱", translations: { ko: "고양이", en: "cat",      vi: "con mèo",    zh: "猫",     ja: "猫",      th: "แมว",      id: "kucing",   hi: "बिल्ली",  ru: "кошка",    ar: "قطة",     fil: "pusa",     km: "ឆ្មា",         mn: "муур",    uz: "mushuk",  my: "ကြောင်" } },
  { key: "book",    emoji: "📖", translations: { ko: "책",     en: "book",     vi: "sách",       zh: "书",     ja: "本",      th: "หนังสือ",  id: "buku",     hi: "किताब",   ru: "книга",    ar: "كتاب",    fil: "libro",    km: "សៀវភៅ",    mn: "ном",     uz: "kitob",   my: "စာအုပ်" } },
  { key: "water",   emoji: "💧", translations: { ko: "물",     en: "water",    vi: "nước",       zh: "水",     ja: "水",      th: "น้ำ",       id: "air",      hi: "पानी",    ru: "вода",     ar: "ماء",     fil: "tubig",    km: "ទឹក",         mn: "ус",      uz: "suv",     my: "ရေ" } },
  { key: "school",  emoji: "🏫", translations: { ko: "학교",   en: "school",   vi: "trường",     zh: "学校",   ja: "学校",    th: "โรงเรียน", id: "sekolah",  hi: "स्कूल",   ru: "школа",    ar: "مدرسة",   fil: "paaralan", km: "សាលា",       mn: "сургууль",uz: "maktab",  my: "ကျောင်း" } },
  { key: "friend",  emoji: "🤝", translations: { ko: "친구",   en: "friend",   vi: "bạn",        zh: "朋友",   ja: "友達",    th: "เพื่อน",    id: "teman",    hi: "दोस्त",   ru: "друг",     ar: "صديق",    fil: "kaibigan", km: "មិត្ត",        mn: "найз",    uz: "doʻst",   my: "သူငယ်ချင်း" } },
  { key: "family",  emoji: "👨‍👩‍👧", translations: { ko: "가족", en: "family", vi: "gia đình", zh: "家人", ja: "家族", th: "ครอบครัว", id: "keluarga", hi: "परिवार", ru: "семья", ar: "عائلة", fil: "pamilya", km: "គ្រួសារ", mn: "гэр бүл", uz: "oila", my: "မိသားစု" } },
  { key: "house",   emoji: "🏠", translations: { ko: "집",     en: "house",    vi: "nhà",        zh: "家",     ja: "家",      th: "บ้าน",      id: "rumah",    hi: "घर",      ru: "дом",      ar: "بيت",     fil: "bahay",    km: "ផ្ទះ",         mn: "байшин", uz: "uy",      my: "အိမ်" } },
  { key: "sun",     emoji: "☀️", translations: { ko: "해",     en: "sun",      vi: "mặt trời",   zh: "太阳",   ja: "太陽",    th: "ดวงอาทิตย์",id: "matahari", hi: "सूरज",    ru: "солнце",   ar: "شمس",     fil: "araw",     km: "ព្រះអាទិត្យ",mn: "нар",    uz: "quyosh",  my: "နေ" } },
  { key: "moon",    emoji: "🌙", translations: { ko: "달",     en: "moon",     vi: "mặt trăng",  zh: "月亮",   ja: "月",      th: "ดวงจันทร์",id: "bulan",    hi: "चाँद",    ru: "луна",     ar: "قمر",     fil: "buwan",    km: "ព្រះចន្ទ",   mn: "сар",     uz: "oy",      my: "လ" } },
  { key: "rice",    emoji: "🍚", translations: { ko: "쌀밥",   en: "rice",     vi: "cơm",        zh: "米饭",   ja: "ごはん",  th: "ข้าว",      id: "nasi",     hi: "चावल",    ru: "рис",      ar: "أرز",     fil: "kanin",    km: "បាយ",         mn: "будаа",   uz: "guruch",  my: "ထမင်း" } },
  { key: "tea",     emoji: "🍵", translations: { ko: "차",     en: "tea",      vi: "trà",        zh: "茶",     ja: "お茶",    th: "ชา",        id: "teh",      hi: "चाय",     ru: "чай",      ar: "شاي",     fil: "tsaa",     km: "តែ",          mn: "цай",     uz: "choy",    my: "လက်ဖက်ရည်" } },
  { key: "thanks",  emoji: "🙏", translations: { ko: "고마워", en: "thanks",   vi: "cảm ơn",     zh: "谢谢",   ja: "ありがとう", th: "ขอบคุณ",  id: "terima kasih", hi: "धन्यवाद", ru: "спасибо", ar: "شكرا", fil: "salamat", km: "អរគុណ",     mn: "баярлалаа",uz: "rahmat",my: "ကျေးဇူးတင်ပါတယ်" } },
];

// For country-guess game
export interface CountryItem {
  code: string; // ISO-ish key
  flag: string;
  names: LangMap;
}

export const COUNTRIES: CountryItem[] = [
  { code: "KR", flag: "🇰🇷", names: { ko: "대한민국",      en: "South Korea",  vi: "Hàn Quốc",   zh: "韩国",     ja: "韓国",    th: "เกาหลีใต้", id: "Korea Selatan", hi: "दक्षिण कोरिया", ru: "Южная Корея", ar: "كوريا الجنوبية", fil: "Timog Korea", km: "កូរ៉េខាងត្បូង", mn: "Өмнөд Солонгос", uz: "Janubiy Koreya", my: "တောင်ကိုရီးယား" } },
  { code: "VN", flag: "🇻🇳", names: { ko: "베트남",        en: "Vietnam",      vi: "Việt Nam",   zh: "越南",     ja: "ベトナム",th: "เวียดนาม",  id: "Vietnam",     hi: "वियतनाम",  ru: "Вьетнам",     ar: "فيتنام",        fil: "Biyetnam",  km: "វៀតណាម",     mn: "Вьетнам",         uz: "Vetnam",         my: "ဗီယက်နမ်" } },
  { code: "CN", flag: "🇨🇳", names: { ko: "중국",          en: "China",        vi: "Trung Quốc", zh: "中国",     ja: "中国",    th: "จีน",        id: "Tiongkok",   hi: "चीन",       ru: "Китай",        ar: "الصين",          fil: "Tsina",      km: "ចិន",           mn: "Хятад",           uz: "Xitoy",          my: "တရုတ်" } },
  { code: "JP", flag: "🇯🇵", names: { ko: "일본",          en: "Japan",        vi: "Nhật Bản",   zh: "日本",     ja: "日本",    th: "ญี่ปุ่น",     id: "Jepang",     hi: "जापान",     ru: "Япония",       ar: "اليابان",        fil: "Hapon",      km: "ជប៉ុន",         mn: "Япон",            uz: "Yaponiya",       my: "ဂျပန်" } },
  { code: "PH", flag: "🇵🇭", names: { ko: "필리핀",        en: "Philippines",  vi: "Philippines",zh: "菲律宾",   ja: "フィリピン",th: "ฟิลิปปินส์", id: "Filipina", hi: "फिलीपींस",  ru: "Филиппины",     ar: "الفلبين",       fil: "Pilipinas",  km: "ហ្វីលីពីន",    mn: "Филиппин",        uz: "Filippin",       my: "ဖိလစ်ပိုင်" } },
  { code: "TH", flag: "🇹🇭", names: { ko: "태국",          en: "Thailand",     vi: "Thái Lan",   zh: "泰国",     ja: "タイ",    th: "ประเทศไทย",id: "Thailand",    hi: "थाईलैंड",   ru: "Таиланд",      ar: "تايلاند",       fil: "Thailand",   km: "ថៃ",            mn: "Тайланд",         uz: "Tayland",        my: "ထိုင်း" } },
  { code: "KH", flag: "🇰🇭", names: { ko: "캄보디아",      en: "Cambodia",     vi: "Campuchia",  zh: "柬埔寨",   ja: "カンボジア",th: "กัมพูชา",  id: "Kamboja",    hi: "कंबोडिया",  ru: "Камбоджа",     ar: "كمبوديا",       fil: "Kambodiya",  km: "កម្ពុជា",       mn: "Камбож",          uz: "Kambodja",       my: "ကမ္ဘောဒီးယား" } },
  { code: "MN", flag: "🇲🇳", names: { ko: "몽골",          en: "Mongolia",     vi: "Mông Cổ",    zh: "蒙古",     ja: "モンゴル",th: "มองโกเลีย", id: "Mongolia",   hi: "मंगोलिया",  ru: "Монголия",     ar: "منغوليا",       fil: "Mongolia",   km: "ម៉ុងហ្គោលី",   mn: "Монгол",          uz: "Moʻgʻuliston",   my: "မွန်ဂိုလီးယား" } },
  { code: "RU", flag: "🇷🇺", names: { ko: "러시아",        en: "Russia",       vi: "Nga",        zh: "俄罗斯",   ja: "ロシア",  th: "รัสเซีย",   id: "Rusia",      hi: "रूस",       ru: "Россия",       ar: "روسيا",          fil: "Rusya",      km: "រុស្ស៊ី",       mn: "Орос",            uz: "Rossiya",        my: "ရုရှား" } },
  { code: "UZ", flag: "🇺🇿", names: { ko: "우즈베키스탄",  en: "Uzbekistan",   vi: "Uzbekistan", zh: "乌兹别克斯坦", ja: "ウズベキスタン", th: "อุซเบกิสถาน", id: "Uzbekistan", hi: "उज़्बेकिस्तान", ru: "Узбекистан", ar: "أوزبكستان", fil: "Uzbekistan", km: "អ៊ូសបេគីស្ថាន", mn: "Узбекистан",      uz: "Oʻzbekiston",    my: "ဥဇဘက်ကစ္စတန်" } },
  { code: "IN", flag: "🇮🇳", names: { ko: "인도",          en: "India",        vi: "Ấn Độ",      zh: "印度",     ja: "インド",  th: "อินเดีย",  id: "India",      hi: "भारत",      ru: "Индия",        ar: "الهند",         fil: "India",      km: "ឥណ្ឌា",         mn: "Энэтхэг",         uz: "Hindiston",      my: "အိန္ဒိယ" } },
  { code: "ID", flag: "🇮🇩", names: { ko: "인도네시아",    en: "Indonesia",    vi: "Indonesia",  zh: "印度尼西亚",ja: "インドネシア", th: "อินโดนีเซีย",id: "Indonesia", hi: "इंडोनेशिया", ru: "Индонезия", ar: "إندونيسيا", fil: "Indonesya", km: "ឥណ្ឌូណេស៊ី", mn: "Индонез",         uz: "Indoneziya",     my: "အင်ဒိုနီးရှား" } },
  { code: "SA", flag: "🇸🇦", names: { ko: "사우디아라비아",en: "Saudi Arabia", vi: "Ả Rập Xê Út",zh: "沙特阿拉伯", ja: "サウジアラビア", th: "ซาอุดิอาระเบีย", id: "Arab Saudi", hi: "सऊदी अरब", ru: "Саудовская Аравия", ar: "السعودية", fil: "Saudi Arabia", km: "អារ៉ាប៊ីសាអូឌី", mn: "Саудын Араб",     uz: "Saudiya Arabistoni", my: "ဆော်ဒီအာရေးဗီးယား" } },
  { code: "MM", flag: "🇲🇲", names: { ko: "미얀마",        en: "Myanmar",      vi: "Myanmar",    zh: "缅甸",     ja: "ミャンマー",th: "เมียนมา",  id: "Myanmar",    hi: "म्यांमार",   ru: "Мьянма",       ar: "ميانمار",       fil: "Myanmar",    km: "មីយ៉ាន់ម៉ា",   mn: "Мьянмар",         uz: "Myanma",         my: "မြန်မာ" } },
  { code: "US", flag: "🇺🇸", names: { ko: "미국",          en: "United States",vi: "Hoa Kỳ",     zh: "美国",     ja: "アメリカ",th: "สหรัฐอเมริกา",id: "Amerika Serikat", hi: "अमेरिका", ru: "США",       ar: "الولايات المتحدة", fil: "Estados Unidos", km: "សហរដ្ឋអាមេរិក", mn: "АНУ",             uz: "AQSH",           my: "အမေရိကန်" } },
];

// Emotion-situation pairs
export interface EmotionItem {
  emoji: string;
  situation: LangMap;
}

export const EMOTIONS: EmotionItem[] = [
  { emoji: "😊", situation: { ko: "친구가 생일 축하해줬어요.", en: "My friend wished me happy birthday.", vi: "Bạn chúc tôi sinh nhật vui vẻ.", zh: "朋友祝我生日快乐。", ja: "友達が誕生日を祝ってくれました。", th: "เพื่อนอวยพรวันเกิดให้ฉัน", id: "Teman mengucapkan selamat ulang tahun.", hi: "मेरे दोस्त ने जन्मदिन की बधाई दी।", ru: "Друг поздравил меня с днём рождения.", ar: "صديقي هنأني بعيد ميلادي.", fil: "Binati ako ng kaibigan ko.", km: "មិត្តជូនពរខួបកំណើតខ្ញុំ។", mn: "Найз төрсөн өдрөөр маань баяр хүргэсэн.", uz: "Doʻstim tugʻilgan kunim bilan tabrikladi.", my: "သူငယ်ချင်းက မွေးနေ့ဆုတောင်း ပေးတယ်။" } },
  { emoji: "😢", situation: { ko: "소중한 물건을 잃어버렸어요.", en: "I lost a precious item.", vi: "Tôi đánh mất một vật quý giá.", zh: "我弄丢了重要的东西。", ja: "大切な物を失くしました。", th: "ฉันทำของสำคัญหาย", id: "Saya kehilangan barang berharga.", hi: "मैंने कीमती चीज़ खो दी।", ru: "Я потерял ценную вещь.", ar: "فقدت شيئًا ثمينًا.", fil: "Nawala ko ang mahalagang bagay.", km: "ខ្ញុំបាត់របស់មានតម្លៃ។", mn: "Би үнэт эд зүйлээ гээсэн.", uz: "Men qimmatli narsamni yoʻqotdim.", my: "အရေးကြီးတဲ့ ပစ္စည်းပျောက်သွားတယ်။" } },
  { emoji: "😠", situation: { ko: "누가 내 그림을 망가뜨렸어요.", en: "Someone ruined my drawing.", vi: "Ai đó làm hỏng bức tranh của tôi.", zh: "有人毁了我的画。", ja: "誰かが私の絵を台無しにしました。", th: "มีคนทำลายภาพวาดของฉัน", id: "Seseorang merusak gambar saya.", hi: "किसी ने मेरी तस्वीर बिगाड़ दी।", ru: "Кто-то испортил мой рисунок.", ar: "أحدهم أفسد رسمتي.", fil: "May sumira sa drawing ko.", km: "មានគេធ្វើឲ្យរូបខ្ញុំខូច។", mn: "Хэн нэгэн миний зургийг муутгасан.", uz: "Kimdir rasmimni buzdi.", my: "တစ်ယောက်ယောက်က ငါ့ပုံကို ဖျက်လိုက်တယ်။" } },
  { emoji: "😨", situation: { ko: "캄캄한 방에 혼자 있어요.", en: "I am alone in a dark room.", vi: "Tôi ở một mình trong phòng tối.", zh: "我独自一人在黑暗的房间里。", ja: "暗い部屋に一人でいます。", th: "ฉันอยู่คนเดียวในห้องมืด", id: "Saya sendirian di kamar gelap.", hi: "मैं अंधेरे कमरे में अकेला हूँ।", ru: "Я один в тёмной комнате.", ar: "أنا وحدي في غرفة مظلمة.", fil: "Mag-isa ako sa madilim na kuwarto.", km: "ខ្ញុំនៅម្នាក់ឯងក្នុងបន្ទប់ងងឹត។", mn: "Би харанхуй өрөөнд ганцаараа.", uz: "Men qorongʻi xonada yolgʻizman.", my: "မှောင်နေတဲ့အခန်းထဲ တစ်ယောက်တည်း ရှိနေတယ်။" } },
  { emoji: "😳", situation: { ko: "많은 사람 앞에서 발표했어요.", en: "I presented in front of many people.", vi: "Tôi thuyết trình trước nhiều người.", zh: "我在很多人面前演讲。", ja: "大勢の前で発表しました。", th: "ฉันนำเสนอต่อหน้าคนมากมาย", id: "Saya presentasi di depan banyak orang.", hi: "मैंने बहुत से लोगों के सामने प्रस्तुति दी।", ru: "Я выступал перед многими.", ar: "قدمت أمام كثير من الناس.", fil: "Nag-presenta ako sa maraming tao.", km: "ខ្ញុំធ្វើបទបង្ហាញនៅមុខមនុស្សច្រើន។", mn: "Би олон хүний өмнө илтгэсэн.", uz: "Men koʻp odam oldida taqdimot qildim.", my: "လူအများရှေ့မှာ စကားပြောခဲ့တယ်။" } },
  { emoji: "🤗", situation: { ko: "오랜만에 친구를 만났어요.", en: "I met my friend after a long time.", vi: "Tôi gặp lại bạn sau thời gian dài.", zh: "我久违地见到了朋友。", ja: "久しぶりに友達に会いました。", th: "ฉันได้เจอเพื่อนหลังจากไม่เจอกันนาน", id: "Saya bertemu teman setelah lama.", hi: "मैंने लंबे समय बाद दोस्त से मुलाकात की।", ru: "Я встретил друга после долгого времени.", ar: "قابلت صديقي بعد فترة طويلة.", fil: "Nagkita kami ng kaibigan ko ulit.", km: "ខ្ញុំជួបមិត្តបន្ទាប់ពីយូរណាស់។", mn: "Би найзтайгаа удаан уулзлаа.", uz: "Doʻstim bilan uzoq vaqtdan soʻng uchrashdim.", my: "သူငယ်ချင်းနဲ့ ကြာကြာမတွေ့ဘူးမှ တွေ့လိုက်တယ်။" } },
  { emoji: "😴", situation: { ko: "늦게까지 공부해서 피곤해요.", en: "I studied late and feel tired.", vi: "Tôi học khuya và mệt.", zh: "我学习到很晚，很累。", ja: "遅くまで勉強して疲れました。", th: "ฉันเรียนดึกและรู้สึกเหนื่อย", id: "Saya belajar sampai larut dan lelah.", hi: "मैंने देर तक पढ़ाई की और थक गया।", ru: "Я устал, учился допоздна.", ar: "درست حتى وقت متأخر وأنا متعب.", fil: "Pagod ako dahil nag-aral ako hanggang gabi.", km: "ខ្ញុំរៀនយប់ហើយហត់។", mn: "Би орой хүртэл хичээл хийж ядарсан.", uz: "Men kech tungacha oʻqidim va charchadim.", my: "ညနက်တဲ့အထိ စာလုပ်တော့ မောတယ်။" } },
  { emoji: "😮", situation: { ko: "갑자기 큰 소리가 났어요.", en: "There was a sudden loud noise.", vi: "Có tiếng động lớn bất ngờ.", zh: "突然有很大的声音。", ja: "突然大きな音がしました。", th: "มีเสียงดังขึ้นทันที", id: "Tiba-tiba ada suara keras.", hi: "अचानक तेज़ आवाज़ आई।", ru: "Внезапно раздался громкий звук.", ar: "سمعت صوتًا عاليًا فجأة.", fil: "May biglaang malakas na ingay.", km: "មានសំឡេងខ្លាំងភ្លាមៗ។", mn: "Гэнэт чанга дуу гарсан.", uz: "Toʻsatdan qattiq ovoz chiqdi.", my: "ရုတ်တရက် အသံကျယ်ကျယ် ထွက်လာတယ်။" } },
];

// Greetings (for 인사말 릴레이)
export const GREETINGS: LangMap[] = [
  { ko: "안녕하세요", en: "Hello", vi: "Xin chào", zh: "你好", ja: "こんにちは", th: "สวัสดี", id: "Halo", hi: "नमस्ते", ru: "Привет", ar: "مرحبا", fil: "Kumusta", km: "សួស្ដី", mn: "Сайн байна уу", uz: "Salom", my: "မင်္ဂလာပါ" },
  { ko: "감사합니다", en: "Thank you", vi: "Cảm ơn", zh: "谢谢", ja: "ありがとう", th: "ขอบคุณ", id: "Terima kasih", hi: "धन्यवाद", ru: "Спасибо", ar: "شكرا", fil: "Salamat", km: "អរគុណ", mn: "Баярлалаа", uz: "Rahmat", my: "ကျေးဇူးတင်ပါတယ်" },
  { ko: "미안해요", en: "Sorry", vi: "Xin lỗi", zh: "对不起", ja: "ごめんなさい", th: "ขอโทษ", id: "Maaf", hi: "माफ़ करें", ru: "Извините", ar: "آسف", fil: "Pasensya", km: "សុំទោស", mn: "Уучлаарай", uz: "Kechirasiz", my: "တောင်းပန်ပါတယ်" },
  { ko: "잘 자요", en: "Good night", vi: "Chúc ngủ ngon", zh: "晚安", ja: "おやすみ", th: "ราตรีสวัสดิ์", id: "Selamat tidur", hi: "शुभ रात्रि", ru: "Спокойной ночи", ar: "تصبح على خير", fil: "Magandang gabi", km: "រាត្រីសួស្ដី", mn: "Сайхан амраарай", uz: "Hayrli tun", my: "ညချမ်းသာပါစေ" },
  { ko: "만나서 반가워요", en: "Nice to meet you", vi: "Rất vui được gặp bạn", zh: "很高兴见到你", ja: "はじめまして", th: "ยินดีที่ได้รู้จัก", id: "Senang bertemu", hi: "मिलकर खुशी हुई", ru: "Приятно познакомиться", ar: "تشرفت بلقائك", fil: "Ikinagagalak kita", km: "រីករាយដែលបានជួប", mn: "Танилцсандаа баяртай байна", uz: "Tanishganimdan xursandman", my: "တွေ့ရတာ ဝမ်းသာပါတယ်" },
];

export function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export function tr(map: LangMap, lang: string, fallback = "en"): string {
  return map[lang] ?? map[fallback] ?? Object.values(map)[0] ?? "";
}
