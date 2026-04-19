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

// ============================================================
// Twenty Questions (스무고개)
// ============================================================

export type TwentyQCategory = "country" | "food" | "person";

export interface HintFlags {
  // region / location
  isAsian?: boolean;
  isEuropean?: boolean;
  isAmerican?: boolean;
  // taste / temperature
  isHot?: boolean;
  isCold?: boolean;
  isSweet?: boolean;
  isSpicy?: boolean;
  // nature / composition
  isDrink?: boolean;
  isFood?: boolean;
  hasRice?: boolean;
  hasFlour?: boolean;
  hasMeat?: boolean;
  isFried?: boolean;
  // living / man-made
  livingThing?: boolean;
  manMade?: boolean;
  // job-specific
  wearsUniform?: boolean;
  helpsPeople?: boolean;
  worksIndoors?: boolean;
  worksWithKids?: boolean;
  famous?: boolean;
}

export type HintFlag = keyof HintFlags;
export type HintGroup = "region" | "taste" | "use" | "form" | "misc";

export interface TwentyQItem {
  id: string;
  category: TwentyQCategory;
  emoji: string;
  names: LangMap;
  hints: HintFlags;
}

export interface HintCard {
  flag: HintFlag;
  emoji: string;
  group: HintGroup;
  label: LangMap; // question shown to the guesser in langA (kid-friendly)
}

export const TWENTYQ_ITEMS: TwentyQItem[] = [
  // ----- country (10) -----
  { id: "c-kr", category: "country", emoji: "🇰🇷", names: { ko: "대한민국", en: "South Korea", vi: "Hàn Quốc", zh: "韩国", ja: "韓国", th: "เกาหลีใต้", id: "Korea Selatan", hi: "कोरिया", ru: "Корея", ar: "كوريا", fil: "Korea", km: "កូរ៉េ", mn: "Солонгос", uz: "Koreya", my: "ကိုရီးယား" }, hints: { isAsian: true, famous: true, manMade: false, livingThing: false } },
  { id: "c-vn", category: "country", emoji: "🇻🇳", names: { ko: "베트남", en: "Vietnam", vi: "Việt Nam", zh: "越南", ja: "ベトナム", th: "เวียดนาม", id: "Vietnam", hi: "वियतनाम", ru: "Вьетнам", ar: "فيتنام", fil: "Biyetnam", km: "វៀតណាម", mn: "Вьетнам", uz: "Vetnam", my: "ဗီယက်နမ်" }, hints: { isAsian: true, famous: true } },
  { id: "c-cn", category: "country", emoji: "🇨🇳", names: { ko: "중국", en: "China", vi: "Trung Quốc", zh: "中国", ja: "中国", th: "จีน", id: "Tiongkok", hi: "चीन", ru: "Китай", ar: "الصين", fil: "Tsina", km: "ចិន", mn: "Хятад", uz: "Xitoy", my: "တရုတ်" }, hints: { isAsian: true, famous: true } },
  { id: "c-jp", category: "country", emoji: "🇯🇵", names: { ko: "일본", en: "Japan", vi: "Nhật Bản", zh: "日本", ja: "日本", th: "ญี่ปุ่น", id: "Jepang", hi: "जापान", ru: "Япония", ar: "اليابان", fil: "Hapon", km: "ជប៉ុន", mn: "Япон", uz: "Yaponiya", my: "ဂျပန်" }, hints: { isAsian: true, famous: true } },
  { id: "c-th", category: "country", emoji: "🇹🇭", names: { ko: "태국", en: "Thailand", vi: "Thái Lan", zh: "泰国", ja: "タイ", th: "ประเทศไทย", id: "Thailand", hi: "थाईलैंड", ru: "Таиланд", ar: "تايلاند", fil: "Thailand", km: "ថៃ", mn: "Тайланд", uz: "Tayland", my: "ထိုင်း" }, hints: { isAsian: true, famous: true } },
  { id: "c-ph", category: "country", emoji: "🇵🇭", names: { ko: "필리핀", en: "Philippines", vi: "Philippines", zh: "菲律宾", ja: "フィリピン", th: "ฟิลิปปินส์", id: "Filipina", hi: "फिलीपींस", ru: "Филиппины", ar: "الفلبين", fil: "Pilipinas", km: "ហ្វីលីពីន", mn: "Филиппин", uz: "Filippin", my: "ဖိလစ်ပိုင်" }, hints: { isAsian: true } },
  { id: "c-us", category: "country", emoji: "🇺🇸", names: { ko: "미국", en: "United States", vi: "Hoa Kỳ", zh: "美国", ja: "アメリカ", th: "สหรัฐฯ", id: "Amerika", hi: "अमेरिका", ru: "США", ar: "أمريكا", fil: "Amerika", km: "អាមេរិក", mn: "АНУ", uz: "AQSH", my: "အမေရိကန်" }, hints: { isAmerican: true, famous: true } },
  { id: "c-ru", category: "country", emoji: "🇷🇺", names: { ko: "러시아", en: "Russia", vi: "Nga", zh: "俄罗斯", ja: "ロシア", th: "รัสเซีย", id: "Rusia", hi: "रूस", ru: "Россия", ar: "روسيا", fil: "Rusya", km: "រុស្ស៊ី", mn: "Орос", uz: "Rossiya", my: "ရုရှား" }, hints: { isEuropean: true, isCold: true, famous: true } },
  { id: "c-id", category: "country", emoji: "🇮🇩", names: { ko: "인도네시아", en: "Indonesia", vi: "Indonesia", zh: "印度尼西亚", ja: "インドネシア", th: "อินโดนีเซีย", id: "Indonesia", hi: "इंडोनेशिया", ru: "Индонезия", ar: "إندونيسيا", fil: "Indonesia", km: "ឥណ្ឌូណេស៊ី", mn: "Индонез", uz: "Indoneziya", my: "အင်ဒိုနီးရှား" }, hints: { isAsian: true } },
  { id: "c-in", category: "country", emoji: "🇮🇳", names: { ko: "인도", en: "India", vi: "Ấn Độ", zh: "印度", ja: "インド", th: "อินเดีย", id: "India", hi: "भारत", ru: "Индия", ar: "الهند", fil: "India", km: "ឥណ្ឌា", mn: "Энэтхэг", uz: "Hindiston", my: "အိန္ဒိယ" }, hints: { isAsian: true, famous: true } },

  // ----- food (10) -----
  { id: "f-rice", category: "food", emoji: "🍚", names: { ko: "쌀밥", en: "rice", vi: "cơm", zh: "米饭", ja: "ごはん", th: "ข้าว", id: "nasi", hi: "चावल", ru: "рис", ar: "أرز", fil: "kanin", km: "បាយ", mn: "будаа", uz: "guruch", my: "ထမင်း" }, hints: { isFood: true, hasRice: true, isHot: true, manMade: true } },
  { id: "f-ramen", category: "food", emoji: "🍜", names: { ko: "라면", en: "ramen", vi: "mì ăn liền", zh: "拉面", ja: "ラーメン", th: "ราเมง", id: "ramen", hi: "रामेन", ru: "рамэн", ar: "رامين", fil: "ramen", km: "រ៉ាមេន", mn: "рамен", uz: "ramen", my: "ရာမိန်" }, hints: { isFood: true, hasFlour: true, isHot: true, isSpicy: true, manMade: true } },
  { id: "f-kimchi", category: "food", emoji: "🥬", names: { ko: "김치", en: "kimchi", vi: "kim chi", zh: "泡菜", ja: "キムチ", th: "กิมจิ", id: "kimchi", hi: "किमची", ru: "кимчи", ar: "كيمتشي", fil: "kimchi", km: "គីមឈី", mn: "кимчи", uz: "kimchi", my: "ကင်မ်ချီ" }, hints: { isFood: true, isSpicy: true, manMade: true } },
  { id: "f-pizza", category: "food", emoji: "🍕", names: { ko: "피자", en: "pizza", vi: "pizza", zh: "披萨", ja: "ピザ", th: "พิซซ่า", id: "pizza", hi: "पिज्जा", ru: "пицца", ar: "بيتزا", fil: "pizza", km: "ភីហ្សា", mn: "пицца", uz: "pitsa", my: "ပီဇာ" }, hints: { isFood: true, hasFlour: true, hasMeat: true, isHot: true, manMade: true } },
  { id: "f-sushi", category: "food", emoji: "🍣", names: { ko: "초밥", en: "sushi", vi: "sushi", zh: "寿司", ja: "寿司", th: "ซูชิ", id: "sushi", hi: "सुशी", ru: "суши", ar: "سوشي", fil: "sushi", km: "ស៊ូស៊ី", mn: "суши", uz: "sushi", my: "ဆူရှီ" }, hints: { isFood: true, hasRice: true, isCold: true, manMade: true } },
  { id: "f-pho", category: "food", emoji: "🍲", names: { ko: "쌀국수", en: "pho", vi: "phở", zh: "越南河粉", ja: "フォー", th: "เฝอ", id: "pho", hi: "फो", ru: "фо", ar: "فو", fil: "pho", km: "ផូ", mn: "фо", uz: "pho", my: "ဖိုး" }, hints: { isFood: true, hasRice: true, isHot: true, manMade: true } },
  { id: "f-curry", category: "food", emoji: "🍛", names: { ko: "카레", en: "curry", vi: "cà ri", zh: "咖喱", ja: "カレー", th: "แกง", id: "kari", hi: "करी", ru: "карри", ar: "كاري", fil: "kari", km: "ខារី", mn: "карри", uz: "karri", my: "ကာရီ" }, hints: { isFood: true, isSpicy: true, isHot: true, manMade: true } },
  { id: "f-tea", category: "food", emoji: "🍵", names: { ko: "차", en: "tea", vi: "trà", zh: "茶", ja: "お茶", th: "ชา", id: "teh", hi: "चाय", ru: "чай", ar: "شاي", fil: "tsaa", km: "តែ", mn: "цай", uz: "choy", my: "လက်ဖက်ရည်" }, hints: { isDrink: true, isHot: true, manMade: true } },
  { id: "f-ice", category: "food", emoji: "🍦", names: { ko: "아이스크림", en: "ice cream", vi: "kem", zh: "冰淇淋", ja: "アイスクリーム", th: "ไอศกรีม", id: "es krim", hi: "आइसक्रीम", ru: "мороженое", ar: "آيس كريم", fil: "ice cream", km: "ការ៉េម", mn: "зайрмаг", uz: "muzqaymoq", my: "ရေခဲမုန့်" }, hints: { isFood: true, isSweet: true, isCold: true, manMade: true } },
  { id: "f-banana", category: "food", emoji: "🍌", names: { ko: "바나나", en: "banana", vi: "chuối", zh: "香蕉", ja: "バナナ", th: "กล้วย", id: "pisang", hi: "केला", ru: "банан", ar: "موز", fil: "saging", km: "ចេក", mn: "гадил", uz: "banan", my: "ငှက်ပျောသီး" }, hints: { isFood: true, isSweet: true, livingThing: true } },

  // ----- person (profession) (10) -----
  { id: "p-teacher", category: "person", emoji: "👩‍🏫", names: { ko: "선생님", en: "teacher", vi: "giáo viên", zh: "老师", ja: "先生", th: "ครู", id: "guru", hi: "शिक्षक", ru: "учитель", ar: "معلم", fil: "guro", km: "គ្រូ", mn: "багш", uz: "oʻqituvchi", my: "ဆရာ" }, hints: { helpsPeople: true, worksIndoors: true, worksWithKids: true, livingThing: true } },
  { id: "p-doctor", category: "person", emoji: "👨‍⚕️", names: { ko: "의사", en: "doctor", vi: "bác sĩ", zh: "医生", ja: "医者", th: "หมอ", id: "dokter", hi: "डॉक्टर", ru: "врач", ar: "طبيب", fil: "doktor", km: "វេជ្ជបណ្ឌិត", mn: "эмч", uz: "shifokor", my: "ဆရာဝန်" }, hints: { wearsUniform: true, helpsPeople: true, worksIndoors: true, livingThing: true } },
  { id: "p-chef", category: "person", emoji: "👨‍🍳", names: { ko: "요리사", en: "chef", vi: "đầu bếp", zh: "厨师", ja: "料理人", th: "เชฟ", id: "koki", hi: "रसोइया", ru: "повар", ar: "طاهي", fil: "kusinero", km: "ចុងភៅ", mn: "тогооч", uz: "oshpaz", my: "စားဖိုမှူး" }, hints: { wearsUniform: true, worksIndoors: true, livingThing: true } },
  { id: "p-police", category: "person", emoji: "👮", names: { ko: "경찰관", en: "police officer", vi: "cảnh sát", zh: "警察", ja: "警察官", th: "ตำรวจ", id: "polisi", hi: "पुलिस", ru: "полицейский", ar: "شرطي", fil: "pulis", km: "ប៉ូលីស", mn: "цагдаа", uz: "politsiyachi", my: "ရဲ" }, hints: { wearsUniform: true, helpsPeople: true, livingThing: true } },
  { id: "p-firefighter", category: "person", emoji: "🧑‍🚒", names: { ko: "소방관", en: "firefighter", vi: "lính cứu hỏa", zh: "消防员", ja: "消防士", th: "นักดับเพลิง", id: "pemadam", hi: "अग्निशमक", ru: "пожарный", ar: "إطفائي", fil: "bumbero", km: "អ្នកពន្លត់អគ្គីភ័យ", mn: "гал сөнөөгч", uz: "oʻt oʻchiruvchi", my: "မီးသတ်" }, hints: { wearsUniform: true, helpsPeople: true, livingThing: true } },
  { id: "p-farmer", category: "person", emoji: "🧑‍🌾", names: { ko: "농부", en: "farmer", vi: "nông dân", zh: "农民", ja: "農家", th: "ชาวนา", id: "petani", hi: "किसान", ru: "фермер", ar: "مزارع", fil: "magsasaka", km: "កសិករ", mn: "тариаланч", uz: "dehqon", my: "လယ်သမား" }, hints: { worksIndoors: false, livingThing: true } },
  { id: "p-driver", category: "person", emoji: "🧑‍✈️", names: { ko: "운전사", en: "driver", vi: "tài xế", zh: "司机", ja: "運転手", th: "คนขับ", id: "supir", hi: "ड्राइवर", ru: "водитель", ar: "سائق", fil: "drayber", km: "អ្នកបើកបរ", mn: "жолооч", uz: "haydovchi", my: "ကားမောင်းသူ" }, hints: { livingThing: true, worksIndoors: false } },
  { id: "p-nurse", category: "person", emoji: "🧑‍⚕️", names: { ko: "간호사", en: "nurse", vi: "y tá", zh: "护士", ja: "看護師", th: "พยาบาล", id: "perawat", hi: "नर्स", ru: "медсестра", ar: "ممرض", fil: "nars", km: "គិលានុបដ្ឋាយិកា", mn: "сувилагч", uz: "hamshira", my: "သူနာပြု" }, hints: { wearsUniform: true, helpsPeople: true, worksIndoors: true, livingThing: true } },
  { id: "p-artist", category: "person", emoji: "🧑‍🎨", names: { ko: "화가", en: "artist", vi: "họa sĩ", zh: "画家", ja: "画家", th: "ศิลปิน", id: "pelukis", hi: "कलाकार", ru: "художник", ar: "فنان", fil: "pintor", km: "វិចិត្រករ", mn: "зураач", uz: "rassom", my: "ပန်းချီသူ" }, hints: { livingThing: true, worksIndoors: true } },
  { id: "p-singer", category: "person", emoji: "🧑‍🎤", names: { ko: "가수", en: "singer", vi: "ca sĩ", zh: "歌手", ja: "歌手", th: "นักร้อง", id: "penyanyi", hi: "गायक", ru: "певец", ar: "مغني", fil: "mang-aawit", km: "អ្នកច្រៀង", mn: "дуучин", uz: "qoʻshiqchi", my: "အဆိုတော်" }, hints: { livingThing: true, famous: true } },
];

export const HINT_CARDS: HintCard[] = [
  // region
  { flag: "isAsian",    emoji: "🌏", group: "region", label: { ko: "아시아에 있나요?", en: "Is it in Asia?", vi: "Có ở châu Á không?", zh: "在亚洲吗?", ja: "アジアにありますか?", th: "อยู่ในเอเชียไหม?", id: "Ada di Asia?", hi: "क्या एशिया में है?", ru: "Это в Азии?", ar: "هل في آسيا؟", fil: "Nasa Asya ba?", km: "នៅអាស៊ី?", mn: "Азид уу?", uz: "Osiyoda?", my: "အာရှမှာလား?" } },
  { flag: "isEuropean", emoji: "🏰", group: "region", label: { ko: "유럽에 있나요?", en: "Is it in Europe?", vi: "Có ở châu Âu không?", zh: "在欧洲吗?", ja: "ヨーロッパにありますか?", th: "อยู่ในยุโรปไหม?", id: "Ada di Eropa?", hi: "क्या यूरोप में है?", ru: "Это в Европе?", ar: "هل في أوروبا؟", fil: "Nasa Europa ba?", km: "នៅអឺរ៉ុប?", mn: "Европт уу?", uz: "Yevropada?", my: "ဥရောပမှာလား?" } },
  { flag: "isAmerican", emoji: "🌎", group: "region", label: { ko: "아메리카에 있나요?", en: "Is it in America?", vi: "Có ở châu Mỹ không?", zh: "在美洲吗?", ja: "アメリカ大陸にありますか?", th: "อยู่ในอเมริกาไหม?", id: "Ada di Amerika?", hi: "क्या अमेरिका में है?", ru: "Это в Америке?", ar: "هل في أمريكا؟", fil: "Nasa Amerika ba?", km: "នៅអាមេរិក?", mn: "Америкт уу?", uz: "Amerikada?", my: "အမေရိကမှာလား?" } },
  // taste
  { flag: "isHot",      emoji: "🔥", group: "taste",  label: { ko: "뜨거운가요?", en: "Is it hot?", vi: "Nó có nóng không?", zh: "是热的吗?", ja: "熱いですか?", th: "ร้อนไหม?", id: "Panas?", hi: "क्या गर्म है?", ru: "Оно горячее?", ar: "هل ساخن؟", fil: "Mainit ba?", km: "ក្តៅ?", mn: "Халуун уу?", uz: "Issiqmi?", my: "ပူလား?" } },
  { flag: "isCold",     emoji: "❄️", group: "taste",  label: { ko: "차가운가요?", en: "Is it cold?", vi: "Nó có lạnh không?", zh: "是冷的吗?", ja: "冷たいですか?", th: "เย็นไหม?", id: "Dingin?", hi: "क्या ठंडा है?", ru: "Оно холодное?", ar: "هل بارد؟", fil: "Malamig ba?", km: "ត្រជាក់?", mn: "Хүйтэн үү?", uz: "Sovuqmi?", my: "အေးလား?" } },
  { flag: "isSweet",    emoji: "🍯", group: "taste",  label: { ko: "달콤한가요?", en: "Is it sweet?", vi: "Nó có ngọt không?", zh: "是甜的吗?", ja: "甘いですか?", th: "หวานไหม?", id: "Manis?", hi: "क्या मीठा है?", ru: "Оно сладкое?", ar: "هل حلو؟", fil: "Matamis ba?", km: "ផ្អែម?", mn: "Чихэрлэг үү?", uz: "Shirinmi?", my: "ချိုလား?" } },
  { flag: "isSpicy",    emoji: "🌶️", group: "taste",  label: { ko: "매운가요?", en: "Is it spicy?", vi: "Nó có cay không?", zh: "是辣的吗?", ja: "辛いですか?", th: "เผ็ดไหม?", id: "Pedas?", hi: "क्या तीखा है?", ru: "Оно острое?", ar: "هل حار؟", fil: "Maanghang ba?", km: "ហឹរ?", mn: "Халуун ногоотой юу?", uz: "Achchiqmi?", my: "စပ်လား?" } },
  // use / composition
  { flag: "isDrink",    emoji: "🥤", group: "use",    label: { ko: "마시는 건가요?", en: "Do you drink it?", vi: "Bạn có uống nó không?", zh: "是喝的吗?", ja: "飲むものですか?", th: "ดื่มได้ไหม?", id: "Diminum?", hi: "क्या पीते हैं?", ru: "Это пьют?", ar: "هل تشرب؟", fil: "Iniinom ba?", km: "ផឹក?", mn: "Уудаг уу?", uz: "Ichiladi?", my: "သောက်တာလား?" } },
  { flag: "hasRice",    emoji: "🌾", group: "form",   label: { ko: "쌀이 들어있나요?", en: "Does it have rice?", vi: "Có gạo không?", zh: "里面有米吗?", ja: "お米が入っていますか?", th: "มีข้าวไหม?", id: "Ada nasinya?", hi: "क्या चावल है?", ru: "Есть ли рис?", ar: "هل فيه أرز؟", fil: "May bigas ba?", km: "មានអង្ករ?", mn: "Цагаан будаатай юу?", uz: "Guruchmi?", my: "ဆန်ပါလား?" } },
  { flag: "hasFlour",   emoji: "🍞", group: "form",   label: { ko: "밀가루가 들어있나요?", en: "Does it have flour?", vi: "Có bột mì không?", zh: "里面有面粉吗?", ja: "小麦が入っていますか?", th: "มีแป้งไหม?", id: "Ada tepungnya?", hi: "क्या आटा है?", ru: "Есть ли мука?", ar: "هل فيه دقيق؟", fil: "May harina ba?", km: "មានម្សៅ?", mn: "Гурилтай юу?", uz: "Un?", my: "မုန့်ညက်ပါလား?" } },
  { flag: "hasMeat",    emoji: "🍖", group: "form",   label: { ko: "고기가 들어있나요?", en: "Does it have meat?", vi: "Có thịt không?", zh: "里面有肉吗?", ja: "肉が入っていますか?", th: "มีเนื้อไหม?", id: "Ada dagingnya?", hi: "क्या मांस है?", ru: "Есть ли мясо?", ar: "هل فيه لحم؟", fil: "May karne ba?", km: "មានសាច់?", mn: "Махтай юу?", uz: "Goʻshti bormi?", my: "အသားပါလား?" } },
  // form / person
  { flag: "livingThing", emoji: "🌱", group: "misc",  label: { ko: "살아있는 것인가요?", en: "Is it alive?", vi: "Có phải sinh vật không?", zh: "是活的吗?", ja: "生き物ですか?", th: "มีชีวิตไหม?", id: "Makhluk hidup?", hi: "क्या जीवित है?", ru: "Это живое?", ar: "هل كائن حي؟", fil: "May buhay ba?", km: "មានជីវិត?", mn: "Амьд уу?", uz: "Tirikmi?", my: "အသက်ရှိလား?" } },
  { flag: "wearsUniform", emoji: "👔", group: "form", label: { ko: "유니폼을 입나요?", en: "Does it wear a uniform?", vi: "Có mặc đồng phục không?", zh: "穿制服吗?", ja: "制服を着ますか?", th: "ใส่เครื่องแบบไหม?", id: "Pakai seragam?", hi: "क्या वर्दी पहनते हैं?", ru: "Носит форму?", ar: "يرتدي زياً؟", fil: "May uniporme?", km: "ពាក់ឯកសណ្ឋាន?", mn: "Дүрэмт хувцастай юу?", uz: "Formakiyamda?", my: "ယူနီဖောင်းဝတ်လား?" } },
  { flag: "helpsPeople", emoji: "🤝", group: "use",   label: { ko: "사람을 도와주나요?", en: "Do they help people?", vi: "Có giúp đỡ mọi người không?", zh: "帮助别人吗?", ja: "人を助けますか?", th: "ช่วยคนไหม?", id: "Membantu orang?", hi: "लोगों की मदद करता है?", ru: "Помогает людям?", ar: "يساعد الناس؟", fil: "Tumutulong sa tao?", km: "ជួយមនុស្ស?", mn: "Хүмүүст тусладаг уу?", uz: "Odamlarga yordam beradi?", my: "လူတွေကိုကူညီလား?" } },
  { flag: "worksIndoors", emoji: "🏢", group: "use",  label: { ko: "실내에서 일하나요?", en: "Do they work indoors?", vi: "Làm việc trong nhà không?", zh: "在室内工作吗?", ja: "室内で働きますか?", th: "ทำงานในร่มไหม?", id: "Kerja di dalam ruangan?", hi: "क्या अंदर काम करते हैं?", ru: "Работает в помещении?", ar: "يعمل داخلاً؟", fil: "Nagtatrabaho sa loob?", km: "ធ្វើការខាងក្នុង?", mn: "Дотор ажилладаг уу?", uz: "Ichkarida ishlaydi?", my: "အိမ်တွင်းမှာအလုပ်လုပ်လား?" } },
  { flag: "famous",      emoji: "🌟", group: "misc",  label: { ko: "유명한가요?", en: "Is it famous?", vi: "Có nổi tiếng không?", zh: "有名吗?", ja: "有名ですか?", th: "มีชื่อเสียงไหม?", id: "Terkenal?", hi: "क्या प्रसिद्ध है?", ru: "Оно знаменитое?", ar: "هل مشهور؟", fil: "Sikat ba?", km: "ល្បី?", mn: "Алдартай юу?", uz: "Mashhurmi?", my: "ထင်ရှားလား?" } },
];

// ============================================================
// Honey Taboo (꿀벌 금칙어)
// ============================================================

export type TabooCategory = "school" | "food" | "animal" | "daily";

export interface TabooCard {
  id: string;
  category: TabooCategory;
  answer: LangMap;
  taboos: [LangMap, LangMap, LangMap]; // exactly 3 forbidden words
}

// Helper: shrink translation authoring — fallback to en if a locale omitted.
function m(partial: LangMap): LangMap { return partial; }

export const TABOO_CARDS: TabooCard[] = [
  // ----- school (8) -----
  { id: "s-teacher",  category: "school", answer: m({ ko: "선생님", en: "teacher", vi: "giáo viên", zh: "老师", ja: "先生", th: "ครู", id: "guru", hi: "शिक्षक", ru: "учитель", ar: "معلم", fil: "guro", km: "គ្រូ", mn: "багш", uz: "oʻqituvchi", my: "ဆရာ" }),
    taboos: [ m({ ko: "학교", en: "school", vi: "trường", zh: "学校", ja: "学校" }), m({ ko: "수업", en: "class", vi: "lớp học", zh: "课", ja: "授業" }), m({ ko: "학생", en: "student", vi: "học sinh", zh: "学生", ja: "生徒" }) ] },
  { id: "s-pencil",   category: "school", answer: m({ ko: "연필", en: "pencil", vi: "bút chì", zh: "铅笔", ja: "鉛筆", th: "ดินสอ", id: "pensil", hi: "पेंसिल", ru: "карандаш", ar: "قلم رصاص", fil: "lapis", km: "ខ្មៅដៃ", mn: "харандаа", uz: "qalam", my: "ခဲတံ" }),
    taboos: [ m({ ko: "쓰다", en: "write", vi: "viết", zh: "写", ja: "書く" }), m({ ko: "글자", en: "letter", vi: "chữ", zh: "字", ja: "文字" }), m({ ko: "지우개", en: "eraser", vi: "tẩy", zh: "橡皮", ja: "消しゴム" }) ] },
  { id: "s-hw",       category: "school", answer: m({ ko: "숙제", en: "homework", vi: "bài tập", zh: "作业", ja: "宿題", th: "การบ้าน", id: "PR", hi: "गृहकार्य", ru: "домашка", ar: "واجب", fil: "takdang-aralin", km: "កិច្ចការ", mn: "гэрийн даалгавар", uz: "uy vazifasi", my: "အိမ်စာ" }),
    taboos: [ m({ ko: "공부", en: "study", vi: "học", zh: "学习", ja: "勉強" }), m({ ko: "책", en: "book", vi: "sách", zh: "书", ja: "本" }), m({ ko: "집", en: "home", vi: "nhà", zh: "家", ja: "家" }) ] },
  { id: "s-library",  category: "school", answer: m({ ko: "도서관", en: "library", vi: "thư viện", zh: "图书馆", ja: "図書館", th: "ห้องสมุด", id: "perpustakaan", hi: "पुस्तकालय", ru: "библиотека", ar: "مكتبة", fil: "aklatan", km: "បណ្ណាល័យ", mn: "номын сан", uz: "kutubxona", my: "စာကြည့်တိုက်" }),
    taboos: [ m({ ko: "책", en: "book", vi: "sách", zh: "书", ja: "本" }), m({ ko: "읽다", en: "read", vi: "đọc", zh: "读", ja: "読む" }), m({ ko: "조용", en: "quiet", vi: "yên", zh: "安静", ja: "静か" }) ] },
  { id: "s-board",    category: "school", answer: m({ ko: "칠판", en: "blackboard", vi: "bảng", zh: "黑板", ja: "黒板", th: "กระดาน", id: "papan tulis", hi: "ब्लैकबोर्ड", ru: "доска", ar: "سبورة", fil: "pisara", km: "ក្ដារខៀន", mn: "самбар", uz: "doska", my: "ကျောက်သင်ပုန်း" }),
    taboos: [ m({ ko: "분필", en: "chalk", vi: "phấn", zh: "粉笔", ja: "チョーク" }), m({ ko: "쓰다", en: "write", vi: "viết", zh: "写", ja: "書く" }), m({ ko: "교실", en: "classroom", vi: "lớp", zh: "教室", ja: "教室" }) ] },
  { id: "s-yard",     category: "school", answer: m({ ko: "운동장", en: "playground", vi: "sân chơi", zh: "操场", ja: "運動場", th: "สนาม", id: "lapangan", hi: "खेल का मैदान", ru: "площадка", ar: "ملعب", fil: "palaruan", km: "ទីលានលេង", mn: "талбай", uz: "maydon", my: "ကစားကွင်း" }),
    taboos: [ m({ ko: "놀다", en: "play", vi: "chơi", zh: "玩", ja: "遊ぶ" }), m({ ko: "뛰다", en: "run", vi: "chạy", zh: "跑", ja: "走る" }), m({ ko: "밖", en: "outside", vi: "ngoài", zh: "外面", ja: "外" }) ] },
  { id: "s-class",    category: "school", answer: m({ ko: "교실", en: "classroom", vi: "lớp học", zh: "教室", ja: "教室", th: "ห้องเรียน", id: "kelas", hi: "कक्षा", ru: "класс", ar: "فصل", fil: "silid-aralan", km: "ថ្នាក់", mn: "анги", uz: "sinfxona", my: "စာသင်ခန်း" }),
    taboos: [ m({ ko: "학교", en: "school", vi: "trường", zh: "学校", ja: "学校" }), m({ ko: "책상", en: "desk", vi: "bàn", zh: "桌子", ja: "机" }), m({ ko: "의자", en: "chair", vi: "ghế", zh: "椅子", ja: "椅子" }) ] },
  { id: "s-test",     category: "school", answer: m({ ko: "시험", en: "test", vi: "bài kiểm tra", zh: "考试", ja: "テスト", th: "สอบ", id: "ujian", hi: "परीक्षा", ru: "экзамен", ar: "اختبار", fil: "pagsusulit", km: "ប្រលង", mn: "шалгалт", uz: "imtihon", my: "စာမေး" }),
    taboos: [ m({ ko: "문제", en: "question", vi: "câu hỏi", zh: "题", ja: "問題" }), m({ ko: "점수", en: "score", vi: "điểm", zh: "分数", ja: "点数" }), m({ ko: "공부", en: "study", vi: "học", zh: "学习", ja: "勉強" }) ] },

  // ----- food (8) -----
  { id: "f-kimchi",   category: "food", answer: m({ ko: "김치", en: "kimchi", vi: "kim chi", zh: "泡菜", ja: "キムチ", th: "กิมจิ", id: "kimchi", hi: "किमची", ru: "кимчи", ar: "كيمتشي", fil: "kimchi", km: "គីមឈី", mn: "кимчи", uz: "kimchi", my: "ကင်မ်ချီ" }),
    taboos: [ m({ ko: "매운", en: "spicy", vi: "cay", zh: "辣", ja: "辛い" }), m({ ko: "배추", en: "cabbage", vi: "cải thảo", zh: "白菜", ja: "白菜" }), m({ ko: "빨간", en: "red", vi: "đỏ", zh: "红色", ja: "赤い" }) ] },
  { id: "f-ramen",    category: "food", answer: m({ ko: "라면", en: "ramen", vi: "mì tôm", zh: "拉面", ja: "ラーメン", th: "ราเมง", id: "ramen", hi: "रामेन", ru: "рамэн", ar: "رامين", fil: "ramen", km: "រ៉ាមេន", mn: "рамен", uz: "ramen", my: "ရာမိန်" }),
    taboos: [ m({ ko: "면", en: "noodles", vi: "mì", zh: "面", ja: "麺" }), m({ ko: "국물", en: "soup", vi: "canh", zh: "汤", ja: "スープ" }), m({ ko: "뜨거운", en: "hot", vi: "nóng", zh: "热", ja: "熱い" }) ] },
  { id: "f-banana",   category: "food", answer: m({ ko: "바나나", en: "banana", vi: "chuối", zh: "香蕉", ja: "バナナ", th: "กล้วย", id: "pisang", hi: "केला", ru: "банан", ar: "موز", fil: "saging", km: "ចេក", mn: "гадил", uz: "banan", my: "ငှက်ပျောသီး" }),
    taboos: [ m({ ko: "노란", en: "yellow", vi: "vàng", zh: "黄色", ja: "黄色" }), m({ ko: "원숭이", en: "monkey", vi: "khỉ", zh: "猴子", ja: "サル" }), m({ ko: "과일", en: "fruit", vi: "trái cây", zh: "水果", ja: "果物" }) ] },
  { id: "f-pizza",    category: "food", answer: m({ ko: "피자", en: "pizza", vi: "pizza", zh: "披萨", ja: "ピザ", th: "พิซซ่า", id: "pizza", hi: "पिज्जा", ru: "пицца", ar: "بيتزا", fil: "pizza", km: "ភីហ្សា", mn: "пицца", uz: "pitsa", my: "ပီဇာ" }),
    taboos: [ m({ ko: "치즈", en: "cheese", vi: "phô mai", zh: "奶酪", ja: "チーズ" }), m({ ko: "이탈리아", en: "Italy", vi: "Ý", zh: "意大利", ja: "イタリア" }), m({ ko: "둥근", en: "round", vi: "tròn", zh: "圆", ja: "丸い" }) ] },
  { id: "f-water",    category: "food", answer: m({ ko: "수박", en: "watermelon", vi: "dưa hấu", zh: "西瓜", ja: "スイカ", th: "แตงโม", id: "semangka", hi: "तरबूज", ru: "арбуз", ar: "بطيخ", fil: "pakwan", km: "ឪឡឹក", mn: "тарвас", uz: "tarvuz", my: "ဖရဲသီး" }),
    taboos: [ m({ ko: "여름", en: "summer", vi: "mùa hè", zh: "夏天", ja: "夏" }), m({ ko: "빨간", en: "red", vi: "đỏ", zh: "红", ja: "赤" }), m({ ko: "씨", en: "seed", vi: "hạt", zh: "籽", ja: "種" }) ] },
  { id: "f-ice",      category: "food", answer: m({ ko: "아이스크림", en: "ice cream", vi: "kem", zh: "冰淇淋", ja: "アイスクリーム", th: "ไอศกรีม", id: "es krim", hi: "आइसक्रीम", ru: "мороженое", ar: "آيس كريم", fil: "ice cream", km: "ការ៉េម", mn: "зайрмаг", uz: "muzqaymoq", my: "ရေခဲမုန့်" }),
    taboos: [ m({ ko: "차가운", en: "cold", vi: "lạnh", zh: "冷", ja: "冷たい" }), m({ ko: "달콤", en: "sweet", vi: "ngọt", zh: "甜", ja: "甘い" }), m({ ko: "여름", en: "summer", vi: "mùa hè", zh: "夏天", ja: "夏" }) ] },
  { id: "f-bread",    category: "food", answer: m({ ko: "빵", en: "bread", vi: "bánh mì", zh: "面包", ja: "パン", th: "ขนมปัง", id: "roti", hi: "रोटी", ru: "хлеб", ar: "خبز", fil: "tinapay", km: "នំបុ័ង", mn: "талх", uz: "non", my: "ပေါင်မုန့်" }),
    taboos: [ m({ ko: "밀가루", en: "flour", vi: "bột mì", zh: "面粉", ja: "小麦粉" }), m({ ko: "아침", en: "breakfast", vi: "bữa sáng", zh: "早餐", ja: "朝食" }), m({ ko: "버터", en: "butter", vi: "bơ", zh: "黄油", ja: "バター" }) ] },
  { id: "f-chicken",  category: "food", answer: m({ ko: "치킨", en: "fried chicken", vi: "gà rán", zh: "炸鸡", ja: "からあげ", th: "ไก่ทอด", id: "ayam goreng", hi: "तला चिकन", ru: "курица", ar: "دجاج مقلي", fil: "pritong manok", km: "មាន់បំពង", mn: "шарсан тахиа", uz: "qovurilgan tovuq", my: "ကြက်ကြော်" }),
    taboos: [ m({ ko: "닭", en: "chicken", vi: "gà", zh: "鸡", ja: "鶏" }), m({ ko: "튀긴", en: "fried", vi: "chiên", zh: "炸", ja: "揚げ" }), m({ ko: "맥주", en: "beer", vi: "bia", zh: "啤酒", ja: "ビール" }) ] },

  // ----- animal (6) -----
  { id: "a-elephant", category: "animal", answer: m({ ko: "코끼리", en: "elephant", vi: "voi", zh: "大象", ja: "象", th: "ช้าง", id: "gajah", hi: "हाथी", ru: "слон", ar: "فيل", fil: "elepante", km: "ដំរី", mn: "заан", uz: "fil", my: "ဆင်" }),
    taboos: [ m({ ko: "큰", en: "big", vi: "to", zh: "大", ja: "大きい" }), m({ ko: "코", en: "nose", vi: "mũi", zh: "鼻子", ja: "鼻" }), m({ ko: "회색", en: "grey", vi: "xám", zh: "灰色", ja: "灰色" }) ] },
  { id: "a-tiger",    category: "animal", answer: m({ ko: "호랑이", en: "tiger", vi: "hổ", zh: "老虎", ja: "トラ", th: "เสือ", id: "harimau", hi: "बाघ", ru: "тигр", ar: "نمر", fil: "tigre", km: "ខ្លា", mn: "бар", uz: "yoʻlbars", my: "ကျား" }),
    taboos: [ m({ ko: "줄무늬", en: "stripes", vi: "sọc", zh: "条纹", ja: "縞" }), m({ ko: "주황색", en: "orange", vi: "cam", zh: "橙", ja: "オレンジ" }), m({ ko: "사나운", en: "fierce", vi: "hung dữ", zh: "凶猛", ja: "獰猛" }) ] },
  { id: "a-dog",      category: "animal", answer: m({ ko: "강아지", en: "dog", vi: "chó", zh: "狗", ja: "犬", th: "สุนัข", id: "anjing", hi: "कुत्ता", ru: "собака", ar: "كلب", fil: "aso", km: "ឆ្កែ", mn: "нохой", uz: "it", my: "ခွေး" }),
    taboos: [ m({ ko: "멍멍", en: "woof", vi: "gâu gâu", zh: "汪汪", ja: "ワンワン" }), m({ ko: "꼬리", en: "tail", vi: "đuôi", zh: "尾巴", ja: "しっぽ" }), m({ ko: "친구", en: "friend", vi: "bạn", zh: "朋友", ja: "友達" }) ] },
  { id: "a-cat",      category: "animal", answer: m({ ko: "고양이", en: "cat", vi: "mèo", zh: "猫", ja: "猫", th: "แมว", id: "kucing", hi: "बिल्ली", ru: "кошка", ar: "قطة", fil: "pusa", km: "ឆ្មា", mn: "муур", uz: "mushuk", my: "ကြောင်" }),
    taboos: [ m({ ko: "야옹", en: "meow", vi: "meo", zh: "喵", ja: "にゃー" }), m({ ko: "수염", en: "whiskers", vi: "ria", zh: "胡须", ja: "ヒゲ" }), m({ ko: "쥐", en: "mouse", vi: "chuột", zh: "老鼠", ja: "ネズミ" }) ] },
  { id: "a-fish",     category: "animal", answer: m({ ko: "물고기", en: "fish", vi: "cá", zh: "鱼", ja: "魚", th: "ปลา", id: "ikan", hi: "मछली", ru: "рыба", ar: "سمك", fil: "isda", km: "ត្រី", mn: "загас", uz: "baliq", my: "ငါး" }),
    taboos: [ m({ ko: "물", en: "water", vi: "nước", zh: "水", ja: "水" }), m({ ko: "바다", en: "sea", vi: "biển", zh: "海", ja: "海" }), m({ ko: "헤엄치다", en: "swim", vi: "bơi", zh: "游", ja: "泳ぐ" }) ] },
  { id: "a-bird",     category: "animal", answer: m({ ko: "새", en: "bird", vi: "chim", zh: "鸟", ja: "鳥", th: "นก", id: "burung", hi: "पक्षी", ru: "птица", ar: "طائر", fil: "ibon", km: "សត្វស្លាប", mn: "шувуу", uz: "qush", my: "ငှက်" }),
    taboos: [ m({ ko: "날다", en: "fly", vi: "bay", zh: "飞", ja: "飛ぶ" }), m({ ko: "날개", en: "wings", vi: "cánh", zh: "翅膀", ja: "翼" }), m({ ko: "하늘", en: "sky", vi: "trời", zh: "天空", ja: "空" }) ] },

  // ----- daily (8) -----
  { id: "d-umbrella", category: "daily", answer: m({ ko: "우산", en: "umbrella", vi: "ô", zh: "雨伞", ja: "傘", th: "ร่ม", id: "payung", hi: "छाता", ru: "зонт", ar: "مظلة", fil: "payong", km: "ឆត្រ", mn: "шүхэр", uz: "soyabon", my: "ထီး" }),
    taboos: [ m({ ko: "비", en: "rain", vi: "mưa", zh: "雨", ja: "雨" }), m({ ko: "젖다", en: "wet", vi: "ướt", zh: "湿", ja: "濡れる" }), m({ ko: "들다", en: "hold", vi: "cầm", zh: "拿", ja: "持つ" }) ] },
  { id: "d-bike",     category: "daily", answer: m({ ko: "자전거", en: "bicycle", vi: "xe đạp", zh: "自行车", ja: "自転車", th: "จักรยาน", id: "sepeda", hi: "साइकिल", ru: "велосипед", ar: "دراجة", fil: "bisikleta", km: "កង់", mn: "дугуй", uz: "velosiped", my: "စက်ဘီး" }),
    taboos: [ m({ ko: "타다", en: "ride", vi: "đi", zh: "骑", ja: "乗る" }), m({ ko: "바퀴", en: "wheel", vi: "bánh xe", zh: "车轮", ja: "車輪" }), m({ ko: "페달", en: "pedal", vi: "bàn đạp", zh: "踏板", ja: "ペダル" }) ] },
  { id: "d-shoes",    category: "daily", answer: m({ ko: "신발", en: "shoes", vi: "giày", zh: "鞋", ja: "靴", th: "รองเท้า", id: "sepatu", hi: "जूते", ru: "обувь", ar: "حذاء", fil: "sapatos", km: "ស្បែកជើង", mn: "гутал", uz: "poyabzal", my: "ဖိနပ်" }),
    taboos: [ m({ ko: "발", en: "foot", vi: "chân", zh: "脚", ja: "足" }), m({ ko: "신다", en: "wear", vi: "đi", zh: "穿", ja: "履く" }), m({ ko: "양말", en: "socks", vi: "tất", zh: "袜子", ja: "靴下" }) ] },
  { id: "d-family",   category: "daily", answer: m({ ko: "가족", en: "family", vi: "gia đình", zh: "家人", ja: "家族", th: "ครอบครัว", id: "keluarga", hi: "परिवार", ru: "семья", ar: "عائلة", fil: "pamilya", km: "គ្រួសារ", mn: "гэр бүл", uz: "oila", my: "မိသားစု" }),
    taboos: [ m({ ko: "아빠", en: "dad", vi: "bố", zh: "爸爸", ja: "父" }), m({ ko: "엄마", en: "mom", vi: "mẹ", zh: "妈妈", ja: "母" }), m({ ko: "집", en: "home", vi: "nhà", zh: "家", ja: "家" }) ] },
  { id: "d-friend",   category: "daily", answer: m({ ko: "친구", en: "friend", vi: "bạn", zh: "朋友", ja: "友達", th: "เพื่อน", id: "teman", hi: "दोस्त", ru: "друг", ar: "صديق", fil: "kaibigan", km: "មិត្ត", mn: "найз", uz: "doʻst", my: "သူငယ်ချင်း" }),
    taboos: [ m({ ko: "놀다", en: "play", vi: "chơi", zh: "玩", ja: "遊ぶ" }), m({ ko: "같이", en: "together", vi: "cùng", zh: "一起", ja: "一緒" }), m({ ko: "반", en: "class", vi: "lớp", zh: "班", ja: "クラス" }) ] },
  { id: "d-bday",     category: "daily", answer: m({ ko: "생일", en: "birthday", vi: "sinh nhật", zh: "生日", ja: "誕生日", th: "วันเกิด", id: "ulang tahun", hi: "जन्मदिन", ru: "день рождения", ar: "عيد ميلاد", fil: "kaarawan", km: "ខួបកំណើត", mn: "төрсөн өдөр", uz: "tugʻilgan kun", my: "မွေးနေ့" }),
    taboos: [ m({ ko: "케이크", en: "cake", vi: "bánh", zh: "蛋糕", ja: "ケーキ" }), m({ ko: "선물", en: "present", vi: "quà", zh: "礼物", ja: "プレゼント" }), m({ ko: "초", en: "candle", vi: "nến", zh: "蜡烛", ja: "ろうそく" }) ] },
  { id: "d-trip",     category: "daily", answer: m({ ko: "여행", en: "trip", vi: "chuyến đi", zh: "旅行", ja: "旅行", th: "ท่องเที่ยว", id: "perjalanan", hi: "यात्रा", ru: "путешествие", ar: "رحلة", fil: "paglalakbay", km: "ដំណើរ", mn: "аялал", uz: "sayohat", my: "ခရီး" }),
    taboos: [ m({ ko: "가방", en: "bag", vi: "túi", zh: "包", ja: "かばん" }), m({ ko: "비행기", en: "plane", vi: "máy bay", zh: "飞机", ja: "飛行機" }), m({ ko: "사진", en: "photo", vi: "ảnh", zh: "照片", ja: "写真" }) ] },
  { id: "d-hosp",     category: "daily", answer: m({ ko: "병원", en: "hospital", vi: "bệnh viện", zh: "医院", ja: "病院", th: "โรงพยาบาล", id: "rumah sakit", hi: "अस्पताल", ru: "больница", ar: "مستشفى", fil: "ospital", km: "មន្ទីរពេទ្យ", mn: "эмнэлэг", uz: "kasalxona", my: "ဆေးရုံ" }),
    taboos: [ m({ ko: "의사", en: "doctor", vi: "bác sĩ", zh: "医生", ja: "医者" }), m({ ko: "아프다", en: "sick", vi: "ốm", zh: "生病", ja: "病気" }), m({ ko: "주사", en: "injection", vi: "tiêm", zh: "打针", ja: "注射" }) ] },
];

// ============================================================
// Would You Rather (이거 저거 고르기)
// ============================================================

export type WYRCategory = "food" | "season" | "school" | "home" | "taste";

export interface WYRCard {
  id: string;
  category: WYRCategory;
  optionA: { emoji: string; label: LangMap };
  optionB: { emoji: string; label: LangMap };
  followUp: LangMap;
}

// Follow-up prompts — culture-curious, never judgmental.
const FU_TASTE: LangMap = {
  ko: "왜 그걸 골랐어? 언제 먹어봤어?",
  en: "Why did you pick it? When did you try it?",
  vi: "Sao bạn chọn nó? Bạn đã thử khi nào?",
  zh: "你为什么选它？什么时候吃过？",
  ja: "どうしてそれを選んだ？いつ食べた？",
};
const FU_MEMORY: LangMap = {
  ko: "가족이랑 같이 먹은 적 있어?",
  en: "Have you eaten it with your family?",
  vi: "Bạn đã ăn cùng gia đình chưa?",
  zh: "和家人一起吃过吗？",
  ja: "家族と一緒に食べたことある？",
};
const FU_SEASON: LangMap = {
  ko: "어느 계절이 더 생각나?",
  en: "Which season reminds you of it?",
  vi: "Mùa nào khiến bạn nhớ đến nó?",
  zh: "哪个季节让你想到它？",
  ja: "どの季節を思い出す？",
};
const FU_HOME: LangMap = {
  ko: "집에서는 어떻게 지내?",
  en: "How do you spend time at home?",
  vi: "Ở nhà bạn thường làm gì?",
  zh: "你在家里怎么过？",
  ja: "おうちではどう過ごしてる？",
};
const FU_SCHOOL: LangMap = {
  ko: "학교에서 이 시간이 제일 기대돼?",
  en: "Is this your favorite time at school?",
  vi: "Đây có phải giờ bạn thích nhất ở trường?",
  zh: "这是你在学校最喜欢的时间吗？",
  ja: "学校で一番楽しみな時間？",
};
const FU_STORY: LangMap = {
  ko: "둘 다 멋져! 어떤 이야기가 떠올라?",
  en: "Both sound great! What story comes to mind?",
  vi: "Cả hai đều tuyệt! Bạn nhớ chuyện gì?",
  zh: "两个都很棒！想到什么故事？",
  ja: "どっちも素敵！どんな思い出がある？",
};

export const WYR_CARDS: WYRCard[] = [
  // ---------------- food (8) ----------------
  {
    id: "food-01",
    category: "food",
    optionA: { emoji: "🌶️", label: { ko: "매운 떡볶이", en: "spicy tteokbokki", vi: "tteokbokki cay", zh: "辣炒年糕", ja: "辛いトッポッキ" } },
    optionB: { emoji: "🍜", label: { ko: "따뜻한 쌀국수", en: "warm pho", vi: "phở nóng", zh: "热米粉", ja: "温かいフォー" } },
    followUp: FU_TASTE,
  },
  {
    id: "food-02",
    category: "food",
    optionA: { emoji: "🥬", label: { ko: "김치", en: "kimchi", vi: "kimchi", zh: "泡菜", ja: "キムチ" } },
    optionB: { emoji: "🥢", label: { ko: "간장 반찬", en: "soy-sauce side", vi: "món kho nước tương", zh: "酱油小菜", ja: "しょうゆのおかず" } },
    followUp: FU_MEMORY,
  },
  {
    id: "food-03",
    category: "food",
    optionA: { emoji: "🍥", label: { ko: "라면", en: "ramyeon", vi: "mì ramyeon", zh: "拉面", ja: "ラーメン" } },
    optionB: { emoji: "🍲", label: { ko: "우동", en: "udon", vi: "udon", zh: "乌冬面", ja: "うどん" } },
    followUp: FU_TASTE,
  },
  {
    id: "food-04",
    category: "food",
    optionA: { emoji: "🍗", label: { ko: "치킨", en: "fried chicken", vi: "gà rán", zh: "炸鸡", ja: "フライドチキン" } },
    optionB: { emoji: "🍢", label: { ko: "양꼬치", en: "lamb skewers", vi: "xiên cừu nướng", zh: "羊肉串", ja: "ラム串焼き" } },
    followUp: FU_STORY,
  },
  {
    id: "food-05",
    category: "food",
    optionA: { emoji: "🍕", label: { ko: "피자", en: "pizza", vi: "pizza", zh: "披萨", ja: "ピザ" } },
    optionB: { emoji: "🍣", label: { ko: "초밥", en: "sushi", vi: "sushi", zh: "寿司", ja: "寿司" } },
    followUp: FU_TASTE,
  },
  {
    id: "food-06",
    category: "food",
    optionA: { emoji: "🥭", label: { ko: "망고", en: "mango", vi: "xoài", zh: "芒果", ja: "マンゴー" } },
    optionB: { emoji: "🍓", label: { ko: "딸기", en: "strawberry", vi: "dâu tây", zh: "草莓", ja: "いちご" } },
    followUp: FU_SEASON,
  },
  {
    id: "food-07",
    category: "food",
    optionA: { emoji: "🍧", label: { ko: "팥빙수", en: "shaved ice", vi: "đá bào", zh: "刨冰", ja: "かき氷" } },
    optionB: { emoji: "🍨", label: { ko: "아이스크림", en: "ice cream", vi: "kem", zh: "冰淇淋", ja: "アイスクリーム" } },
    followUp: FU_SEASON,
  },
  {
    id: "food-08",
    category: "food",
    optionA: { emoji: "🍙", label: { ko: "김밥", en: "kimbap", vi: "kimbap", zh: "紫菜包饭", ja: "キンパ" } },
    optionB: { emoji: "🍣", label: { ko: "초밥", en: "sushi", vi: "sushi", zh: "寿司", ja: "寿司" } },
    followUp: FU_STORY,
  },

  // ---------------- season (8) ----------------
  {
    id: "season-01",
    category: "season",
    optionA: { emoji: "🧧", label: { ko: "설날 세배", en: "Lunar New Year bow", vi: "chúc Tết Hàn Quốc", zh: "春节拜年", ja: "ソルラル挨拶" } },
    optionB: { emoji: "🎊", label: { ko: "뗏 용돈봉투", en: "Tết lucky money", vi: "lì xì Tết", zh: "越南春节红包", ja: "テトのお年玉" } },
    followUp: FU_STORY,
  },
  {
    id: "season-02",
    category: "season",
    optionA: { emoji: "🥟", label: { ko: "추석 송편", en: "Chuseok songpyeon", vi: "bánh songpyeon Chuseok", zh: "秋夕松饼", ja: "チュソクの松餅" } },
    optionB: { emoji: "🥮", label: { ko: "중추절 월병", en: "Mid-Autumn mooncake", vi: "bánh trung thu", zh: "中秋月饼", ja: "中秋節の月餅" } },
    followUp: FU_MEMORY,
  },
  {
    id: "season-03",
    category: "season",
    optionA: { emoji: "🏖️", label: { ko: "여름 바다", en: "summer beach", vi: "biển mùa hè", zh: "夏天的海边", ja: "夏の海" } },
    optionB: { emoji: "🛷", label: { ko: "겨울 눈썰매", en: "winter sledding", vi: "trượt tuyết mùa đông", zh: "冬天滑雪橇", ja: "冬のそり遊び" } },
    followUp: FU_SEASON,
  },
  {
    id: "season-04",
    category: "season",
    optionA: { emoji: "🌸", label: { ko: "벚꽃 구경", en: "cherry blossoms", vi: "ngắm hoa anh đào", zh: "赏樱花", ja: "お花見" } },
    optionB: { emoji: "🍁", label: { ko: "단풍 구경", en: "autumn leaves", vi: "ngắm lá đỏ", zh: "赏枫叶", ja: "紅葉狩り" } },
    followUp: FU_SEASON,
  },
  {
    id: "season-05",
    category: "season",
    optionA: { emoji: "🎄", label: { ko: "크리스마스", en: "Christmas", vi: "Giáng sinh", zh: "圣诞节", ja: "クリスマス" } },
    optionB: { emoji: "🌙", label: { ko: "라마단", en: "Ramadan", vi: "Ramadan", zh: "斋月", ja: "ラマダン" } },
    followUp: FU_STORY,
  },
  {
    id: "season-06",
    category: "season",
    optionA: { emoji: "🎡", label: { ko: "어린이날 놀이공원", en: "amusement park on Children's Day", vi: "công viên ngày thiếu nhi", zh: "儿童节游乐园", ja: "こどもの日の遊園地" } },
    optionB: { emoji: "👨‍👩‍👧", label: { ko: "명절 가족모임", en: "holiday family gathering", vi: "họp mặt gia đình ngày lễ", zh: "节日家庭聚会", ja: "お祝いの家族集まり" } },
    followUp: FU_MEMORY,
  },
  {
    id: "season-07",
    category: "season",
    optionA: { emoji: "🌧️", label: { ko: "비오는 서울", en: "rainy Seoul", vi: "Seoul mưa", zh: "下雨的首尔", ja: "雨のソウル" } },
    optionB: { emoji: "❄️", label: { ko: "눈오는 하노이", en: "snowy Hanoi (pretend!)", vi: "Hà Nội tuyết (tưởng tượng!)", zh: "下雪的河内（想象）", ja: "雪のハノイ（想像！）" } },
    followUp: FU_STORY,
  },
  {
    id: "season-08",
    category: "season",
    optionA: { emoji: "🌅", label: { ko: "해돋이 보기", en: "watch sunrise", vi: "ngắm bình minh", zh: "看日出", ja: "日の出を見る" } },
    optionB: { emoji: "🌕", label: { ko: "달구경", en: "moon gazing", vi: "ngắm trăng", zh: "赏月", ja: "月見" } },
    followUp: FU_SEASON,
  },

  // ---------------- school (8) ----------------
  {
    id: "school-01",
    category: "school",
    optionA: { emoji: "⚽", label: { ko: "운동장 축구", en: "soccer on the field", vi: "đá bóng sân trường", zh: "操场踢足球", ja: "グラウンドでサッカー" } },
    optionB: { emoji: "📚", label: { ko: "도서관 책읽기", en: "reading in library", vi: "đọc sách thư viện", zh: "图书馆看书", ja: "図書室で読書" } },
    followUp: FU_SCHOOL,
  },
  {
    id: "school-02",
    category: "school",
    optionA: { emoji: "🎨", label: { ko: "미술 수업", en: "art class", vi: "giờ mỹ thuật", zh: "美术课", ja: "図工の時間" } },
    optionB: { emoji: "🎵", label: { ko: "음악 수업", en: "music class", vi: "giờ âm nhạc", zh: "音乐课", ja: "音楽の時間" } },
    followUp: FU_SCHOOL,
  },
  {
    id: "school-03",
    category: "school",
    optionA: { emoji: "🔤", label: { ko: "영어 시간", en: "English class", vi: "giờ tiếng Anh", zh: "英语课", ja: "英語の時間" } },
    optionB: { emoji: "🇰🇷", label: { ko: "한국어 시간", en: "Korean class", vi: "giờ tiếng Hàn", zh: "韩语课", ja: "韓国語の時間" } },
    followUp: FU_SCHOOL,
  },
  {
    id: "school-04",
    category: "school",
    optionA: { emoji: "🍛", label: { ko: "급식 밥", en: "cafeteria lunch", vi: "cơm căng tin", zh: "学校食堂", ja: "給食" } },
    optionB: { emoji: "🍱", label: { ko: "도시락", en: "homemade lunchbox", vi: "cơm hộp", zh: "便当", ja: "お弁当" } },
    followUp: FU_MEMORY,
  },
  {
    id: "school-05",
    category: "school",
    optionA: { emoji: "➗", label: { ko: "수학 시험", en: "math test", vi: "bài kiểm tra toán", zh: "数学考试", ja: "算数テスト" } },
    optionB: { emoji: "📖", label: { ko: "국어 시험", en: "language test", vi: "bài kiểm tra ngữ văn", zh: "语文考试", ja: "国語テスト" } },
    followUp: FU_SCHOOL,
  },
  {
    id: "school-06",
    category: "school",
    optionA: { emoji: "🏕️", label: { ko: "수련회", en: "school camp", vi: "trại huấn luyện", zh: "学校野营", ja: "林間学校" } },
    optionB: { emoji: "🚌", label: { ko: "수학여행", en: "field trip", vi: "dã ngoại học đường", zh: "修学旅行", ja: "修学旅行" } },
    followUp: FU_MEMORY,
  },
  {
    id: "school-07",
    category: "school",
    optionA: { emoji: "👯", label: { ko: "친구랑 짝", en: "sit with a friend", vi: "ngồi cùng bạn", zh: "和朋友坐", ja: "友達と隣の席" } },
    optionB: { emoji: "🧘", label: { ko: "혼자 앉기", en: "sit alone", vi: "ngồi một mình", zh: "一个人坐", ja: "ひとりで座る" } },
    followUp: FU_SCHOOL,
  },
  {
    id: "school-08",
    category: "school",
    optionA: { emoji: "🏅", label: { ko: "체육대회", en: "sports day", vi: "hội thao", zh: "运动会", ja: "運動会" } },
    optionB: { emoji: "🎭", label: { ko: "학예회", en: "school show", vi: "hội diễn văn nghệ", zh: "学艺会", ja: "学芸会" } },
    followUp: FU_MEMORY,
  },

  // ---------------- home (8) ----------------
  {
    id: "home-01",
    category: "home",
    optionA: { emoji: "🍲", label: { ko: "할머니 김치찌개", en: "grandma's kimchi stew", vi: "canh kimchi của bà", zh: "奶奶的泡菜汤", ja: "おばあちゃんのキムチチゲ" } },
    optionB: { emoji: "🍜", label: { ko: "할머니 퍼", en: "grandma's pho", vi: "phở của bà", zh: "奶奶的河粉", ja: "おばあちゃんのフォー" } },
    followUp: FU_MEMORY,
  },
  {
    id: "home-02",
    category: "home",
    optionA: { emoji: "📖", label: { ko: "침대에서 만화책", en: "comics in bed", vi: "đọc truyện tranh trên giường", zh: "床上看漫画", ja: "ベッドで漫画" } },
    optionB: { emoji: "🚲", label: { ko: "마당에서 자전거", en: "bike in the yard", vi: "đạp xe ngoài sân", zh: "院子里骑车", ja: "庭で自転車" } },
    followUp: FU_HOME,
  },
  {
    id: "home-03",
    category: "home",
    optionA: { emoji: "🥘", label: { ko: "엄마 반찬", en: "mom's side dishes", vi: "món mẹ nấu", zh: "妈妈的小菜", ja: "お母さんのおかず" } },
    optionB: { emoji: "🍳", label: { ko: "아빠 요리", en: "dad's cooking", vi: "món bố nấu", zh: "爸爸的菜", ja: "お父さんの料理" } },
    followUp: FU_MEMORY,
  },
  {
    id: "home-04",
    category: "home",
    optionA: { emoji: "🐶", label: { ko: "강아지 키우기", en: "raise a puppy", vi: "nuôi chó con", zh: "养小狗", ja: "子犬を飼う" } },
    optionB: { emoji: "🐱", label: { ko: "고양이 키우기", en: "raise a kitten", vi: "nuôi mèo con", zh: "养小猫", ja: "子猫を飼う" } },
    followUp: FU_HOME,
  },
  {
    id: "home-05",
    category: "home",
    optionA: { emoji: "🧳", label: { ko: "가족 여행", en: "family trip", vi: "đi du lịch cùng gia đình", zh: "家庭旅行", ja: "家族旅行" } },
    optionB: { emoji: "🎂", label: { ko: "친구 생일 파티", en: "friend's birthday party", vi: "sinh nhật bạn", zh: "朋友的生日会", ja: "友達の誕生日会" } },
    followUp: FU_STORY,
  },
  {
    id: "home-06",
    category: "home",
    optionA: { emoji: "👯", label: { ko: "형제자매랑", en: "with siblings", vi: "với anh chị em", zh: "和兄弟姐妹", ja: "きょうだいと" } },
    optionB: { emoji: "👨‍👩‍👧‍👧", label: { ko: "사촌이랑", en: "with cousins", vi: "với anh chị em họ", zh: "和表兄妹", ja: "いとこと" } },
    followUp: FU_HOME,
  },
  {
    id: "home-07",
    category: "home",
    optionA: { emoji: "🛏️", label: { ko: "이층침대 위칸", en: "bunk bed top", vi: "giường tầng trên", zh: "上下铺上铺", ja: "二段ベッド上" } },
    optionB: { emoji: "🛌", label: { ko: "이층침대 아래칸", en: "bunk bed bottom", vi: "giường tầng dưới", zh: "上下铺下铺", ja: "二段ベッド下" } },
    followUp: FU_HOME,
  },
  {
    id: "home-08",
    category: "home",
    optionA: { emoji: "🖼️", label: { ko: "방에 그림 붙이기", en: "pictures on the wall", vi: "dán tranh trong phòng", zh: "房间贴画", ja: "部屋に絵を貼る" } },
    optionB: { emoji: "📚", label: { ko: "책장 가득 채우기", en: "fill a bookshelf", vi: "lấp đầy kệ sách", zh: "书架塞满书", ja: "本棚を本でいっぱいに" } },
    followUp: FU_HOME,
  },

  // ---------------- taste (8) ----------------
  {
    id: "taste-01",
    category: "taste",
    optionA: { emoji: "🍭", label: { ko: "단맛", en: "sweet", vi: "vị ngọt", zh: "甜味", ja: "あまい" } },
    optionB: { emoji: "🌶️", label: { ko: "매운맛", en: "spicy", vi: "vị cay", zh: "辣味", ja: "からい" } },
    followUp: FU_TASTE,
  },
  {
    id: "taste-02",
    category: "taste",
    optionA: { emoji: "🍋", label: { ko: "새콤한 거", en: "sour things", vi: "món chua", zh: "酸的", ja: "すっぱいもの" } },
    optionB: { emoji: "🧂", label: { ko: "짭짤한 거", en: "salty things", vi: "món mặn", zh: "咸的", ja: "しょっぱいもの" } },
    followUp: FU_TASTE,
  },
  {
    id: "taste-03",
    category: "taste",
    optionA: { emoji: "🍮", label: { ko: "부드러운 거", en: "soft textures", vi: "mềm mại", zh: "软软的", ja: "やわらかい" } },
    optionB: { emoji: "🥨", label: { ko: "바삭한 거", en: "crunchy textures", vi: "giòn tan", zh: "脆脆的", ja: "サクサク" } },
    followUp: FU_TASTE,
  },
  {
    id: "taste-04",
    category: "taste",
    optionA: { emoji: "🥶", label: { ko: "시원한 거", en: "cold things", vi: "món lạnh", zh: "凉的", ja: "冷たいもの" } },
    optionB: { emoji: "🔥", label: { ko: "뜨거운 거", en: "hot things", vi: "món nóng", zh: "热的", ja: "熱いもの" } },
    followUp: FU_SEASON,
  },
  {
    id: "taste-05",
    category: "taste",
    optionA: { emoji: "🥣", label: { ko: "큰 그릇 한 번", en: "one big bowl", vi: "một tô lớn", zh: "一大碗", ja: "大きい器でひと口" } },
    optionB: { emoji: "🍚", label: { ko: "작은 그릇 여러 번", en: "many small bowls", vi: "nhiều bát nhỏ", zh: "好多小碗", ja: "小さい器を何度も" } },
    followUp: FU_STORY,
  },
  {
    id: "taste-06",
    category: "taste",
    optionA: { emoji: "🍎", label: { ko: "과일", en: "fruit", vi: "trái cây", zh: "水果", ja: "くだもの" } },
    optionB: { emoji: "🥦", label: { ko: "채소", en: "vegetables", vi: "rau củ", zh: "蔬菜", ja: "やさい" } },
    followUp: FU_TASTE,
  },
  {
    id: "taste-07",
    category: "taste",
    optionA: { emoji: "🍚", label: { ko: "밥", en: "rice", vi: "cơm", zh: "米饭", ja: "ごはん" } },
    optionB: { emoji: "🍞", label: { ko: "빵", en: "bread", vi: "bánh mì", zh: "面包", ja: "パン" } },
    followUp: FU_TASTE,
  },
  {
    id: "taste-08",
    category: "taste",
    optionA: { emoji: "🥣", label: { ko: "국물 있는 음식", en: "soupy food", vi: "món nước", zh: "带汤的", ja: "スープ系" } },
    optionB: { emoji: "🍛", label: { ko: "국물 없는 음식", en: "dry dishes", vi: "món khô", zh: "不带汤的", ja: "汁なし" } },
    followUp: FU_TASTE,
  },
];

// ============================================================
// Spot-It (꿀벌 스팟잇)
// ============================================================

export interface SpotItSymbol {
  id: number;
  key: string;
  image: string;
  label: LangMap;
}

// 13개 심볼. 기존 VOCAB 번역을 재활용하되 (id 12: bee) 는 신규.
export const SPOTIT_SYMBOLS: SpotItSymbol[] = [
  { id: 0,  key: "apple",  image: "/spotit/apple.png",  label: { ko: "사과",   en: "apple",    vi: "quả táo",    zh: "苹果",   ja: "りんご",  th: "แอปเปิ้ล",  id: "apel",     hi: "सेब",     ru: "яблоко",   ar: "تفاحة",   fil: "mansanas", km: "ផ្លែប៉ោម",  mn: "алим",    uz: "olma",    my: "ပန်းသီး" } },
  { id: 1,  key: "banana", image: "/spotit/banana.png", label: { ko: "바나나", en: "banana",   vi: "chuối",      zh: "香蕉",   ja: "バナナ",  th: "กล้วย",    id: "pisang",   hi: "केला",    ru: "банан",    ar: "موز",     fil: "saging",   km: "ចេក",        mn: "гадил",   uz: "banan",   my: "ငှက်ပျောသီး" } },
  { id: 2,  key: "cat",    image: "/spotit/cat.png",    label: { ko: "고양이", en: "cat",      vi: "con mèo",    zh: "猫",     ja: "猫",      th: "แมว",      id: "kucing",   hi: "बिल्ली",  ru: "кошка",    ar: "قطة",     fil: "pusa",     km: "ឆ្មា",         mn: "муур",    uz: "mushuk",  my: "ကြောင်" } },
  { id: 3,  key: "dog",    image: "/spotit/dog.png",    label: { ko: "강아지", en: "dog",      vi: "con chó",    zh: "狗",     ja: "犬",      th: "สุนัข",     id: "anjing",   hi: "कुत्ता",  ru: "собака",   ar: "كلب",     fil: "aso",      km: "ឆ្កែ",        mn: "нохой",   uz: "it",      my: "ခွေး" } },
  { id: 4,  key: "book",   image: "/spotit/book.png",   label: { ko: "책",     en: "book",     vi: "sách",       zh: "书",     ja: "本",      th: "หนังสือ",  id: "buku",     hi: "किताब",   ru: "книга",    ar: "كتاب",    fil: "libro",    km: "សៀវភៅ",    mn: "ном",     uz: "kitob",   my: "စာအုပ်" } },
  { id: 5,  key: "water",  image: "/spotit/water.png",  label: { ko: "물",     en: "water",    vi: "nước",       zh: "水",     ja: "水",      th: "น้ำ",       id: "air",      hi: "पानी",    ru: "вода",     ar: "ماء",     fil: "tubig",    km: "ទឹក",         mn: "ус",      uz: "suv",     my: "ရေ" } },
  { id: 6,  key: "school", image: "/spotit/school.png", label: { ko: "학교",   en: "school",   vi: "trường",     zh: "学校",   ja: "学校",    th: "โรงเรียน", id: "sekolah",  hi: "स्कूल",   ru: "школа",    ar: "مدرسة",   fil: "paaralan", km: "សាលា",       mn: "сургууль",uz: "maktab",  my: "ကျောင်း" } },
  { id: 7,  key: "house",  image: "/spotit/house.png",  label: { ko: "집",     en: "house",    vi: "nhà",        zh: "家",     ja: "家",      th: "บ้าน",      id: "rumah",    hi: "घर",      ru: "дом",      ar: "بيت",     fil: "bahay",    km: "ផ្ទះ",         mn: "байшин", uz: "uy",      my: "အိမ်" } },
  { id: 8,  key: "sun",    image: "/spotit/sun.png",    label: { ko: "해",     en: "sun",      vi: "mặt trời",   zh: "太阳",   ja: "太陽",    th: "ดวงอาทิตย์",id: "matahari", hi: "सूरज",    ru: "солнце",   ar: "شمس",     fil: "araw",     km: "ព្រះអាទិត្យ",mn: "нар",    uz: "quyosh",  my: "နေ" } },
  { id: 9,  key: "moon",   image: "/spotit/moon.png",   label: { ko: "달",     en: "moon",     vi: "mặt trăng",  zh: "月亮",   ja: "月",      th: "ดวงจันทร์",id: "bulan",    hi: "चाँद",    ru: "луна",     ar: "قمر",     fil: "buwan",    km: "ព្រះចន្ទ",   mn: "сар",     uz: "oy",      my: "လ" } },
  { id: 10, key: "rice",   image: "/spotit/rice.png",   label: { ko: "쌀밥",   en: "rice",     vi: "cơm",        zh: "米饭",   ja: "ごはん",  th: "ข้าว",      id: "nasi",     hi: "चावल",    ru: "рис",      ar: "أرز",     fil: "kanin",    km: "បាយ",         mn: "будаа",   uz: "guruch",  my: "ထမင်း" } },
  { id: 11, key: "tea",    image: "/spotit/tea.png",    label: { ko: "차",     en: "tea",      vi: "trà",        zh: "茶",     ja: "お茶",    th: "ชา",        id: "teh",      hi: "चाय",     ru: "чай",      ar: "شاي",     fil: "tsaa",     km: "តែ",          mn: "цай",     uz: "choy",    my: "လက်ဖက်ရည်" } },
  { id: 12, key: "bee",    image: "/spotit/bee.png",    label: { ko: "꿀벌",   en: "bee",      vi: "con ong",    zh: "蜜蜂",   ja: "ミツバチ",th: "ผึ้ง",      id: "lebah",    hi: "मधुमक्खी",ru: "пчела",   ar: "نحلة",    fil: "bubuyog",  km: "ឃ្មុំ",       mn: "зөгий",   uz: "asalari", my: "ပျားကောင်" } },
];

// projective plane order 3 — 13 cards of 4 symbols each.
// 임의 두 카드는 정확히 1개 공통 심볼 공유. 하드코딩.
export const SPOTIT_CARDS: number[][] = [
  [0,1,2,3],  [0,4,5,6],   [0,7,8,9],   [0,10,11,12],
  [1,4,7,10], [1,5,8,11],  [1,6,9,12],
  [2,4,8,12], [2,5,9,10],  [2,6,7,11],
  [3,4,9,11], [3,5,7,12],  [3,6,8,10],
];

// 두 카드의 공통 심볼 1개 반환.
export function commonSymbol(a: number[], b: number[]): number {
  for (const s of a) if (b.includes(s)) return s;
  throw new Error("No common symbol — SPOTIT_CARDS invariant violated");
}
