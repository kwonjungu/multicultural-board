// BeeCafe — static data.
// 5 language keys (ko/en/vi/zh/ja) are the planner-required minimum. `tr()`
// falls back to `en` then the first entry for unsupported langs.

import type {
  IngredientDef,
  IngredientId,
  MenuDef,
  MenuId,
  StepDef,
  StepId,
} from "./types";

// ---- 20 ingredients ------------------------------------------------------
export const INGREDIENTS: IngredientDef[] = [
  { id: "rice", emoji: "🍚", name: { ko: "쌀", en: "rice", vi: "gạo", zh: "米", ja: "米" } },
  { id: "noodle", emoji: "🍜", name: { ko: "국수", en: "noodle", vi: "mì", zh: "面条", ja: "麺" } },
  { id: "kimchi", emoji: "🥬", name: { ko: "김치", en: "kimchi", vi: "kimchi", zh: "泡菜", ja: "キムチ" } },
  { id: "egg", emoji: "🥚", name: { ko: "계란", en: "egg", vi: "trứng", zh: "鸡蛋", ja: "卵" } },
  { id: "tofu", emoji: "🧊", name: { ko: "두부", en: "tofu", vi: "đậu phụ", zh: "豆腐", ja: "豆腐" } },
  { id: "pork", emoji: "🥓", name: { ko: "돼지고기", en: "pork", vi: "thịt heo", zh: "猪肉", ja: "豚肉" } },
  { id: "beef", emoji: "🥩", name: { ko: "소고기", en: "beef", vi: "thịt bò", zh: "牛肉", ja: "牛肉" } },
  { id: "chicken", emoji: "🍗", name: { ko: "닭고기", en: "chicken", vi: "thịt gà", zh: "鸡肉", ja: "鶏肉" } },
  { id: "shrimp", emoji: "🍤", name: { ko: "새우", en: "shrimp", vi: "tôm", zh: "虾", ja: "エビ" } },
  { id: "fish", emoji: "🐟", name: { ko: "생선", en: "fish", vi: "cá", zh: "鱼", ja: "魚" } },
  { id: "garlic", emoji: "🧄", name: { ko: "마늘", en: "garlic", vi: "tỏi", zh: "大蒜", ja: "にんにく" } },
  { id: "onion", emoji: "🧅", name: { ko: "양파", en: "onion", vi: "hành", zh: "洋葱", ja: "玉ねぎ" } },
  { id: "chili", emoji: "🌶️", name: { ko: "고추", en: "chili", vi: "ớt", zh: "辣椒", ja: "唐辛子" } },
  { id: "carrot", emoji: "🥕", name: { ko: "당근", en: "carrot", vi: "cà rốt", zh: "胡萝卜", ja: "人参" } },
  { id: "cabbage", emoji: "🥬", name: { ko: "양배추", en: "cabbage", vi: "bắp cải", zh: "卷心菜", ja: "キャベツ" } },
  { id: "mushroom", emoji: "🍄", name: { ko: "버섯", en: "mushroom", vi: "nấm", zh: "蘑菇", ja: "きのこ" } },
  { id: "cilantro", emoji: "🌿", name: { ko: "고수", en: "cilantro", vi: "rau mùi", zh: "香菜", ja: "パクチー" } },
  { id: "soy-sauce", emoji: "🫗", name: { ko: "간장", en: "soy sauce", vi: "nước tương", zh: "酱油", ja: "醤油" } },
  { id: "curry-powder", emoji: "🟡", name: { ko: "카레 가루", en: "curry powder", vi: "bột cà ri", zh: "咖喱粉", ja: "カレー粉" } },
  { id: "mango", emoji: "🥭", name: { ko: "망고", en: "mango", vi: "xoài", zh: "芒果", ja: "マンゴー" } },
];

// ---- 15 cook steps -------------------------------------------------------
export const STEPS: StepDef[] = [
  { id: "wash", emoji: "💧", name: { ko: "씻기", en: "wash", vi: "rửa", zh: "洗", ja: "洗う" } },
  { id: "chop", emoji: "🔪", name: { ko: "썰기", en: "chop", vi: "cắt", zh: "切", ja: "切る" } },
  { id: "marinate", emoji: "🧂", name: { ko: "양념하기", en: "marinate", vi: "ướp", zh: "腌制", ja: "漬け込む" } },
  { id: "boil", emoji: "♨️", name: { ko: "끓이기", en: "boil", vi: "luộc", zh: "煮", ja: "茹でる" } },
  { id: "stir-fry", emoji: "🍳", name: { ko: "볶기", en: "stir-fry", vi: "xào", zh: "炒", ja: "炒める" } },
  { id: "simmer", emoji: "🥘", name: { ko: "조리기", en: "simmer", vi: "hầm", zh: "炖", ja: "煮込む" } },
  { id: "grill", emoji: "🔥", name: { ko: "굽기", en: "grill", vi: "nướng", zh: "烤", ja: "焼く" } },
  { id: "steam", emoji: "💨", name: { ko: "찌기", en: "steam", vi: "hấp", zh: "蒸", ja: "蒸す" } },
  { id: "fry", emoji: "🫕", name: { ko: "튀기기", en: "fry", vi: "chiên", zh: "炸", ja: "揚げる" } },
  { id: "mix", emoji: "🥣", name: { ko: "섞기", en: "mix", vi: "trộn", zh: "拌", ja: "混ぜる" } },
  { id: "plate", emoji: "🍽️", name: { ko: "담기", en: "plate", vi: "bày", zh: "装盘", ja: "盛り付け" } },
  { id: "season", emoji: "🧂", name: { ko: "간맞추기", en: "season", vi: "nêm", zh: "调味", ja: "味付け" } },
  { id: "garnish", emoji: "🌿", name: { ko: "고명", en: "garnish", vi: "trang trí", zh: "点缀", ja: "飾り" } },
  { id: "serve", emoji: "🛎️", name: { ko: "내놓기", en: "serve", vi: "phục vụ", zh: "上桌", ja: "提供" } },
  { id: "rest", emoji: "⏱️", name: { ko: "휴지", en: "rest", vi: "nghỉ", zh: "静置", ja: "休ませる" } },
];

// ---- 12 menus ------------------------------------------------------------
export const MENUS: MenuDef[] = [
  {
    id: "kimchi-jjigae",
    emoji: "🍲",
    origin: "KR",
    name: { ko: "김치찌개", en: "Kimchi Jjigae", vi: "Canh kimchi", zh: "泡菜汤", ja: "キムチチゲ" },
    ingredients: ["kimchi", "pork", "tofu", "onion", "garlic"],
    steps: ["chop", "stir-fry", "boil", "simmer", "serve"],
  },
  {
    id: "bibimbap",
    emoji: "🥗",
    origin: "KR",
    name: { ko: "비빔밥", en: "Bibimbap", vi: "Cơm trộn", zh: "拌饭", ja: "ビビンバ" },
    ingredients: ["rice", "egg", "carrot", "mushroom", "beef"],
    steps: ["wash", "chop", "stir-fry", "mix", "plate"],
  },
  {
    id: "pho",
    emoji: "🍜",
    origin: "VN",
    name: { ko: "쌀국수", en: "Pho", vi: "Phở", zh: "越南河粉", ja: "フォー" },
    ingredients: ["noodle", "beef", "onion", "cilantro", "garlic"],
    steps: ["boil", "simmer", "chop", "plate", "garnish"],
  },
  {
    id: "banh-mi",
    emoji: "🥖",
    origin: "VN",
    name: { ko: "반미", en: "Banh Mi", vi: "Bánh mì", zh: "越南三明治", ja: "バインミー" },
    ingredients: ["pork", "carrot", "cilantro", "chili", "soy-sauce"],
    steps: ["marinate", "grill", "chop", "mix", "serve"],
  },
  {
    id: "pad-thai",
    emoji: "🍝",
    origin: "TH",
    name: { ko: "팟타이", en: "Pad Thai", vi: "Pad Thái", zh: "泰式炒面", ja: "パッタイ" },
    ingredients: ["noodle", "shrimp", "egg", "garlic", "chili"],
    steps: ["chop", "stir-fry", "mix", "season", "plate"],
  },
  {
    id: "mango-sticky",
    emoji: "🥭",
    origin: "TH",
    name: { ko: "망고 찹쌀밥", en: "Mango Sticky Rice", vi: "Xôi xoài", zh: "芒果糯米饭", ja: "マンゴーもち米" },
    ingredients: ["rice", "mango"],
    steps: ["wash", "steam", "rest", "plate", "garnish"],
  },
  {
    id: "curry-rice",
    emoji: "🍛",
    origin: "JP",
    name: { ko: "카레라이스", en: "Curry Rice", vi: "Cơm cà ri", zh: "咖喱饭", ja: "カレーライス" },
    ingredients: ["rice", "chicken", "onion", "carrot", "curry-powder"],
    steps: ["chop", "stir-fry", "simmer", "season", "plate"],
  },
  {
    id: "dumpling",
    emoji: "🥟",
    origin: "CN",
    name: { ko: "만두", en: "Dumpling", vi: "Bánh bao", zh: "饺子", ja: "餃子" },
    ingredients: ["pork", "cabbage", "garlic", "soy-sauce"],
    steps: ["chop", "mix", "steam", "fry", "serve"],
  },
  {
    id: "sushi",
    emoji: "🍣",
    origin: "JP",
    name: { ko: "초밥", en: "Sushi", vi: "Sushi", zh: "寿司", ja: "寿司" },
    ingredients: ["rice", "fish", "soy-sauce"],
    steps: ["wash", "boil", "rest", "plate", "serve"],
  },
  {
    id: "adobo",
    emoji: "🍗",
    origin: "PH",
    name: { ko: "아도보", en: "Adobo", vi: "Adobo", zh: "阿多波", ja: "アドボ" },
    ingredients: ["chicken", "garlic", "soy-sauce", "onion"],
    steps: ["marinate", "stir-fry", "simmer", "rest", "serve"],
  },
  {
    id: "nasi-goreng",
    emoji: "🍚",
    origin: "ID",
    name: { ko: "나시고렝", en: "Nasi Goreng", vi: "Cơm chiên Indo", zh: "印尼炒饭", ja: "ナシゴレン" },
    ingredients: ["rice", "egg", "chicken", "garlic", "soy-sauce", "chili"],
    steps: ["chop", "stir-fry", "mix", "season", "plate"],
  },
  {
    id: "plov",
    emoji: "🍚",
    origin: "UZ",
    name: { ko: "플로브", en: "Plov", vi: "Plov", zh: "抓饭", ja: "プロフ" },
    ingredients: ["rice", "beef", "carrot", "onion", "garlic"],
    steps: ["chop", "stir-fry", "simmer", "rest", "plate"],
  },
];

// ---- lookup helpers ------------------------------------------------------
export const MENU_BY_ID: Record<MenuId, MenuDef> = MENUS.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {} as Record<MenuId, MenuDef>);

export const INGR_BY_ID: Record<IngredientId, IngredientDef> = INGREDIENTS.reduce(
  (acc, i) => {
    acc[i.id] = i;
    return acc;
  },
  {} as Record<IngredientId, IngredientDef>,
);

export const STEP_BY_ID: Record<StepId, StepDef> = STEPS.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {} as Record<StepId, StepDef>);

// Utility: Fisher-Yates shuffle (pure, returns new array).
export function shuffled<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
