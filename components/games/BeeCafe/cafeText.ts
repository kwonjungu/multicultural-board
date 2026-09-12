// BeeCafe — 화면 문구(다국어) 전용 모듈.
//
// 레시피 데이터(cafeData.ts)와 판정(cafeLogic.ts)은 건드리지 않는다. 여기에는
// 화면에 보이는 문장만 둔다 — 여러 화면이 같은 문구(역할 이름·단계 안내)를
// 쓰기 때문에 컴포넌트마다 복사하지 않고 한곳에 모았다.
//
// 채움 기준: ko/en/vi/zh/ja 5개는 기획 최소치, fil/th/id 는 가능한 만큼.
// 없는 언어는 tr()/gt() 가 en → 첫 값으로 폴백한다.

import type { LangMap } from "@/lib/gameData";
import type { Difficulty, Role } from "./types";

export const CAFE: Record<string, LangMap> = {
  subtitle: {
    ko: "손님과 셰프가 함께 요리해요!",
    en: "Customer and Chef cook together!",
    vi: "Khách và Đầu bếp cùng nấu ăn!",
    zh: "顾客和厨师一起做菜!",
    ja: "おきゃくさんとシェフでりょうりしよう!",
    fil: "Magkasamang magluluto ang customer at chef!",
    th: "ลูกค้ากับเชฟทำอาหารด้วยกัน!",
    id: "Pelanggan dan koki memasak bersama!",
  },
  howto: {
    ko: "손님이 메뉴를 고르고 상대 언어로 주문하면, 셰프가 재료와 순서를 맞춰요.",
    en: "The customer orders in the other language, then the chef picks ingredients and steps.",
    vi: "Khách gọi món bằng ngôn ngữ của bạn kia, đầu bếp chọn nguyên liệu và thứ tự.",
    zh: "顾客用对方的语言点菜，厨师选材料和步骤。",
    ja: "おきゃくさんがあいての ことばで ちゅうもんし、シェフが ざいりょうと じゅんばんを えらびます。",
    fil: "Mag-o-order ang customer sa wika ng kapareha, pipiliin ng chef ang sangkap at hakbang.",
    th: "ลูกค้าสั่งอาหารด้วยภาษาของอีกฝ่าย เชฟเลือกวัตถุดิบและลำดับ",
    id: "Pelanggan memesan dalam bahasa temannya, koki memilih bahan dan urutan.",
  },
  customer: {
    ko: "손님", en: "Customer", vi: "Khách", zh: "顾客", ja: "おきゃくさん",
    fil: "Customer", th: "ลูกค้า", id: "Pelanggan",
  },
  chef: {
    ko: "셰프", en: "Chef", vi: "Đầu bếp", zh: "厨师", ja: "シェフ",
    fil: "Chef", th: "เชฟ", id: "Koki",
  },
  swapRole: {
    ko: "역할 바꾸기", en: "Swap roles", vi: "Đổi vai", zh: "交换角色", ja: "やくわりこうたい",
    fil: "Magpalit ng role", th: "สลับบทบาท", id: "Tukar peran",
  },
  customerPicks: {
    ko: "손님이 메뉴를 골라요",
    en: "The customer picks the menu",
    vi: "Khách chọn món",
    zh: "顾客选菜单",
    ja: "おきゃくさんが メニューを えらびます",
    fil: "Ang customer ang pipili ng menu",
    th: "ลูกค้าเลือกเมนู",
    id: "Pelanggan memilih menu",
  },
  pickOneOfThree: {
    ko: "메뉴 세 장 중 하나를 고르세요",
    en: "Pick one of the three menu cards",
    vi: "Chọn một trong ba thẻ món",
    zh: "从三张菜单中选一张",
    ja: "メニュー 3まいから 1つ えらんでね",
    fil: "Pumili ng isa sa tatlong menu card",
    th: "เลือกหนึ่งในสามเมนู",
    id: "Pilih satu dari tiga kartu menu",
  },
  orderTitle: {
    ko: "손님의 주문", en: "The order", vi: "Lời gọi món", zh: "顾客的点单", ja: "ごちゅうもん",
    fil: "Ang order", th: "คำสั่งอาหาร", id: "Pesanan",
  },
  orderHint: {
    ko: "셰프가 주문을 듣고 준비가 되면 눌러요",
    en: "The chef listens, then taps when ready",
    vi: "Đầu bếp nghe xong, sẵn sàng thì bấm",
    zh: "厨师听完，准备好就按一下",
    ja: "シェフは きいてから じゅんびが できたら おします",
    fil: "Makinig ang chef, pindutin kapag handa na",
    th: "เชฟฟังแล้วกดเมื่อพร้อม",
    id: "Koki mendengarkan, lalu tekan jika siap",
  },
  ready: {
    ko: "준비 완료", en: "Ready", vi: "Sẵn sàng", zh: "准备好了", ja: "じゅんび かんりょう",
    fil: "Handa na", th: "พร้อมแล้ว", id: "Siap",
  },
  audioFail: {
    ko: "소리가 안 나왔어요. 아래 글자를 읽어도 되고, 다시 듣기를 눌러도 돼요.",
    en: "The sound did not play. Read the words below, or try listening again.",
    vi: "Âm thanh chưa phát. Hãy đọc chữ bên dưới hoặc nghe lại nhé.",
    zh: "声音没有播放。可以看下面的文字，或再听一次。",
    ja: "おとが でませんでした。したの もじを よむか、もういちど きいてね。",
    fil: "Hindi tumunog. Basahin ang teksto sa ibaba o pakinggan ulit.",
    th: "เสียงไม่ดัง อ่านข้อความด้านล่างหรือฟังอีกครั้งได้เลย",
    id: "Suaranya tidak keluar. Baca teks di bawah atau dengarkan lagi.",
  },
  stepIngr: {
    ko: "1단계 · 재료 고르기",
    en: "Step 1 · Pick ingredients",
    vi: "Bước 1 · Chọn nguyên liệu",
    zh: "第1步 · 选材料",
    ja: "ステップ1 · ざいりょう えらび",
    fil: "Hakbang 1 · Pumili ng sangkap",
    th: "ขั้นที่ 1 · เลือกวัตถุดิบ",
    id: "Langkah 1 · Pilih bahan",
  },
  stepSteps: {
    ko: "2단계 · 조리 순서",
    en: "Step 2 · Arrange the steps",
    vi: "Bước 2 · Sắp thứ tự nấu",
    zh: "第2步 · 排列步骤",
    ja: "ステップ2 · りょうりの じゅんばん",
    fil: "Hakbang 2 · Ayusin ang hakbang",
    th: "ขั้นที่ 2 · เรียงลำดับการทำ",
    id: "Langkah 2 · Susun urutan",
  },
  ordered: {
    ko: "주문받은 메뉴", en: "Ordered dish", vi: "Món đã gọi", zh: "点的菜", ja: "ちゅうもんの りょうり",
    fil: "Na-order na putahe", th: "เมนูที่สั่ง", id: "Menu yang dipesan",
  },
  basket: {
    ko: "담은 재료", en: "In the basket", vi: "Đã chọn", zh: "已选材料", ja: "えらんだ ざいりょう",
    fil: "Napiling sangkap", th: "วัตถุดิบที่เลือก", id: "Bahan terpilih",
  },
  basketEmpty: {
    ko: "아직 담은 재료가 없어요",
    en: "No ingredients yet",
    vi: "Chưa chọn nguyên liệu nào",
    zh: "还没有选材料",
    ja: "まだ ざいりょうが ありません",
    fil: "Wala pang sangkap",
    th: "ยังไม่ได้เลือกวัตถุดิบ",
    id: "Belum ada bahan",
  },
  needIngredient: {
    ko: "재료를 하나 이상 담으면 다음으로 갈 수 있어요",
    en: "Pick at least one ingredient to go on",
    vi: "Chọn ít nhất một nguyên liệu để đi tiếp",
    zh: "至少选一个材料才能继续",
    ja: "ざいりょうを 1つ いじょう えらぶと つぎに すすめます",
    fil: "Pumili ng kahit isang sangkap para makatuloy",
    th: "เลือกวัตถุดิบอย่างน้อยหนึ่งอย่างจึงจะไปต่อได้",
    id: "Pilih minimal satu bahan untuk lanjut",
  },
  goSteps: {
    ko: "조리 순서로", en: "Go to steps", vi: "Sang phần thứ tự", zh: "去排步骤", ja: "じゅんばんへ",
    fil: "Pumunta sa hakbang", th: "ไปเรียงลำดับ", id: "Ke urutan",
  },
  myOrderList: {
    ko: "내 조리 순서", en: "My cooking order", vi: "Thứ tự của tôi", zh: "我的步骤", ja: "わたしの じゅんばん",
    fil: "Aking pagkakasunod", th: "ลำดับของฉัน", id: "Urutan saya",
  },
  emptyOrder: {
    ko: "옆에 있는 단계를 눌러 순서를 만들어요",
    en: "Tap the steps to build your order",
    vi: "Bấm các bước để tạo thứ tự",
    zh: "点击步骤来排出顺序",
    ja: "ステップを おして じゅんばんを つくろう",
    fil: "Pindutin ang hakbang para bumuo ng order",
    th: "กดขั้นตอนเพื่อสร้างลำดับ",
    id: "Tekan langkah untuk menyusun urutan",
  },
  tapToAdd: {
    ko: "눌러서 순서에 담기", en: "Tap to add", vi: "Bấm để thêm", zh: "点一下加入", ja: "おして ついか",
    fil: "Pindutin para idagdag", th: "กดเพื่อเพิ่ม", id: "Tekan untuk menambah",
  },
  needStep: {
    ko: "조리 단계를 하나 이상 담으면 내놓을 수 있어요",
    en: "Add at least one step before serving",
    vi: "Thêm ít nhất một bước rồi mới dọn ra",
    zh: "至少加一个步骤才能上菜",
    ja: "ステップを 1つ いじょう いれると だせます",
    fil: "Magdagdag ng kahit isang hakbang bago mag-serve",
    th: "ใส่อย่างน้อยหนึ่งขั้นตอนจึงจะเสิร์ฟได้",
    id: "Tambahkan minimal satu langkah sebelum menyajikan",
  },
  serve: {
    ko: "내놓기", en: "Serve", vi: "Dọn ra", zh: "上菜", ja: "だす",
    fil: "I-serve", th: "เสิร์ฟ", id: "Sajikan",
  },
  modeDrag: {
    ko: "끌어서 옮기기", en: "Drag to move", vi: "Kéo để di chuyển", zh: "拖动移动", ja: "ドラッグで いどう",
    fil: "I-drag para ilipat", th: "ลากเพื่อย้าย", id: "Seret untuk pindah",
  },
  modeTap: {
    ko: "눌러서 옮기기", en: "Tap to move", vi: "Bấm để di chuyển", zh: "点击移动", ja: "タップで いどう",
    fil: "Pindutin para ilipat", th: "กดเพื่อย้าย", id: "Tekan untuk pindah",
  },
  tapPickFirst: {
    ko: "옮길 단계를 누르세요",
    en: "Tap the step you want to move",
    vi: "Bấm vào bước muốn chuyển",
    zh: "点击想移动的步骤",
    ja: "うごかす ステップを おしてね",
    fil: "Pindutin ang hakbang na ililipat",
    th: "กดขั้นตอนที่ต้องการย้าย",
    id: "Tekan langkah yang ingin dipindah",
  },
  tapPickTarget: {
    ko: "이제 놓을 자리를 누르세요",
    en: "Now tap the place to put it",
    vi: "Giờ bấm vào vị trí muốn đặt",
    zh: "现在点击要放的位置",
    ja: "つぎに おく ばしょを おしてね",
    fil: "Ngayon pindutin ang pupuntahang puwesto",
    th: "ตอนนี้กดตำแหน่งที่จะวาง",
    id: "Sekarang tekan tempat untuk meletakkannya",
  },
  remove: {
    ko: "빼기", en: "Remove", vi: "Bỏ ra", zh: "移除", ja: "とりだす",
    fil: "Alisin", th: "เอาออก", id: "Hapus",
  },
  ingrCompare: {
    ko: "재료 비교", en: "Ingredients", vi: "So nguyên liệu", zh: "材料对比", ja: "ざいりょう くらべ",
    fil: "Paghahambing ng sangkap", th: "เทียบวัตถุดิบ", id: "Perbandingan bahan",
  },
  correctOrder: {
    ko: "정답 순서", en: "Correct order", vi: "Thứ tự đúng", zh: "正确顺序", ja: "せいかいの じゅんばん",
    fil: "Tamang pagkakasunod", th: "ลำดับที่ถูก", id: "Urutan benar",
  },
  myOrder: {
    ko: "내 순서", en: "Your order", vi: "Thứ tự của bạn", zh: "你的顺序", ja: "きみの じゅんばん",
    fil: "Iyong pagkakasunod", th: "ลำดับของคุณ", id: "Urutan kamu",
  },
  perfect: {
    ko: "완벽해요!", en: "Perfect!", vi: "Hoàn hảo!", zh: "完美!", ja: "かんぺき!",
    fil: "Perpekto!", th: "สมบูรณ์แบบ!", id: "Sempurna!",
  },
  nice: {
    ko: "잘했어요!", en: "Nice work!", vi: "Giỏi lắm!", zh: "做得好!", ja: "よく できました!",
    fil: "Magaling!", th: "เก่งมาก!", id: "Bagus!",
  },
  tryAgain: {
    ko: "다시 한 번 해볼까요?",
    en: "Shall we try once more?",
    vi: "Mình thử lại một lần nhé?",
    zh: "我们再试一次好吗?",
    ja: "もういちど やってみようか?",
    fil: "Subukan nating muli?",
    th: "ลองอีกครั้งไหม?",
    id: "Mau coba sekali lagi?",
  },
  home: {
    ko: "처음부터", en: "Start over", vi: "Từ đầu", zh: "从头开始", ja: "さいしょから",
    fil: "Mula sa simula", th: "เริ่มใหม่", id: "Dari awal",
  },
  nextMenu: {
    ko: "다음 메뉴", en: "Next dish", vi: "Món tiếp theo", zh: "下一道菜", ja: "つぎの りょうり",
    fil: "Susunod na putahe", th: "เมนูถัดไป", id: "Menu berikutnya",
  },
  seeResult: {
    ko: "결과 보기", en: "See result", vi: "Xem kết quả", zh: "看结果", ja: "けっかを みる",
    fil: "Tingnan ang resulta", th: "ดูผล", id: "Lihat hasil",
  },
  coursesDone: {
    ko: "세 가지 요리를 모두 냈어요",
    en: "All three dishes are served",
    vi: "Đã dọn xong cả ba món",
    zh: "三道菜都上完了",
    ja: "3つの りょうりを ぜんぶ だしました",
    fil: "Naihain na lahat ng tatlong putahe",
    th: "เสิร์ฟครบทั้งสามเมนูแล้ว",
    id: "Ketiga hidangan sudah disajikan",
  },
  starsLabel: {
    ko: "모은 별", en: "Stars", vi: "Sao", zh: "星星", ja: "あつめた ほし",
    fil: "Mga bituin", th: "ดาวที่ได้", id: "Bintang",
  },
};

export function roleName(r: Role): LangMap {
  return r === "customer" ? CAFE.customer : CAFE.chef;
}

export function roleEmoji(r: Role): string {
  return r === "customer" ? "🧑‍💼" : "👨‍🍳";
}

export const DIFFICULTY_LABEL: Record<Difficulty, LangMap> = {
  easy: {
    ko: "쉬움 · 시간 무제한", en: "Easy · no timer", vi: "Dễ · không giới hạn",
    zh: "简单 · 不限时", ja: "やさしい · じかん むせいげん",
    fil: "Madali · walang timer", th: "ง่าย · ไม่จับเวลา", id: "Mudah · tanpa waktu",
  },
  normal: {
    ko: "보통 · 75초", en: "Normal · 75s", vi: "Thường · 75 giây",
    zh: "普通 · 75秒", ja: "ふつう · 75びょう",
    fil: "Normal · 75s", th: "ปกติ · 75 วินาที", id: "Sedang · 75 detik",
  },
  hard: {
    ko: "어려움 · 45초", en: "Hard · 45s", vi: "Khó · 45 giây",
    zh: "困难 · 45秒", ja: "むずかしい · 45びょう",
    fil: "Mahirap · 45s", th: "ยาก · 45 วินาที", id: "Sulit · 45 detik",
  },
};
