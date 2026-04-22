"""
🎨 전체 이미지 오케스트레이션 — Gemini 2.5 Flash Image (nano-banana)
- Spot-It 심볼 재생성 (불량분만)
- 언어 랜드마크 6장 (km, mn, uz, hi, ar, my)
- 게임 카드 아이콘 14장
- 통역 드로어 대기 일러스트 1장

모델: gemini-2.5-flash-image-preview
사용법:
    - api.txt 에 키 저장 (gitignored)
    - python scripts/generate_all.py           # 전체
    - python scripts/generate_all.py spotit    # 특정 그룹만
"""

import os
import sys
import time
from pathlib import Path
from typing import Iterable

try:
    from google import genai
    from google.genai import types
except ImportError as e:
    raise SystemExit("❌ `pip install google-genai` 먼저.") from e

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUT = ROOT / "output_cards"
OUT.mkdir(exist_ok=True)

MODEL = "gemini-2.5-flash-image"

# ────────────────────────────────────────────────
# 프롬프트 설계 원칙
# - "Subject:" 도입부로 모델 confusion 방지
# - "single icon on pure white background" 반복
# - "no scene, no people, no text" 부정문
# - 색·형태 구체 지시
# ────────────────────────────────────────────────
BASE_STYLE = (
    "A single cute sticker icon on a pure white background. "
    "Flat vector style, thick clean black outline, bold solid colors, "
    "kawaii simple shape, centered, no text, no letters, no numbers, "
    "no scene, no people, no background elements, no decoration around it."
)

def make_prompt(subject: str, details: str) -> str:
    return f"{BASE_STYLE} Subject: {subject}. {details}"

# ────────────────────────────────────────────────
# 전체 생성 플랜
# key: out_relpath, value: (subject, details)
# ────────────────────────────────────────────────
PLAN: list[tuple[str, str, str]] = []

def add(name, subject, details):
    PLAN.append((name, subject, details))

# === Spot-It 불량 재생성 9장 ===
add("spotit/01_banana.png", "a banana",   "one single bright yellow banana with a small brown tip, gently curved.")
add("spotit/02_cat.png",    "a cat face", "one single orange tabby cat face only — round head, two big black eyes, pink triangle nose, tiny whiskers.")
add("spotit/03_dog.png",    "a dog face", "one single brown puppy face only — floppy ears, small round black nose, little pink tongue, friendly smile.")
add("spotit/04_book.png",   "a book",     "one single closed hardcover book, red cover with a yellow square label on front, stacked straight.")
add("spotit/05_water.png",  "a water drop", "one single blue teardrop-shaped water droplet with a tiny white glossy highlight on its upper left.")
add("spotit/06_school.png", "a school house icon", "one single small cartoon school building with a red triangular roof, a white bell on top, a yellow square door.")
add("spotit/08_sun.png",    "a smiling sun", "one single yellow sun with eight short triangular rays, simple smiling face on the center.")
add("spotit/09_moon.png",   "a crescent moon", "one single pale yellow crescent moon facing right, sleepy closed eye with small eyelashes.")
add("spotit/11_tea.png",    "a cup of tea", "one single teal round teacup with a handle, amber tea inside, three simple curly steam lines rising straight above.")

# === 언어 랜드마크 6장 (기존 /landmarks/korea.png 등과 동일 스타일) ===
add("landmarks/cambodia.png",   "Angkor Wat temple silhouette", "simple flat illustration of Angkor Wat's main tower outline in warm yellow and cream tones.")
add("landmarks/mongolia.png",   "a traditional Mongolian ger (yurt)", "round white ger tent with a red door and a small smoke hole, flat illustration.")
add("landmarks/uzbekistan.png", "a Samarkand Registan dome", "turquoise blue tiled dome with a tall minaret, flat illustration.")
add("landmarks/india.png",      "the Taj Mahal", "symmetrical white marble domed palace outline, flat illustration.")
add("landmarks/saudi.png",      "a simple mosque dome with minaret", "gold dome and one tall minaret in warm cream and gold, flat illustration.")
add("landmarks/myanmar.png",    "Shwedagon Pagoda", "golden bell-shaped pagoda with pointed spire, flat illustration.")

# === 게임 카드 아이콘 14장 (통일 꿀벌 톤) ===
GAME_STYLE_NOTE = "flat cartoon game card icon, honey-yellow and cream palette, clean thick black outline, same style as siblings."
add("game-icons/country.png",  "a mini world globe",          GAME_STYLE_NOTE)
add("game-icons/emotion.png",  "a pink heart with smile",     GAME_STYLE_NOTE)
add("game-icons/memory.png",   "two playing cards face-down", GAME_STYLE_NOTE)
add("game-icons/greeting.png", "a waving hand",               GAME_STYLE_NOTE)
add("game-icons/market.png",   "a small food bowl with chopsticks", GAME_STYLE_NOTE)
add("game-icons/draw.png",     "a paintbrush with a yellow swatch", GAME_STYLE_NOTE)
add("game-icons/spot.png",     "a magnifying glass", GAME_STYLE_NOTE)
add("game-icons/puzzle.png",   "a single pink puzzle piece", GAME_STYLE_NOTE)
add("game-icons/number.png",   "a small stack of number buttons 1 2 3", GAME_STYLE_NOTE + " but with clear printed numerals.")
add("game-icons/tower.png",    "three stacked blocks like a tower", GAME_STYLE_NOTE)
add("game-icons/twentyq.png",  "a question mark inside a speech bubble", GAME_STYLE_NOTE)
add("game-icons/taboo.png",    "a red circle with diagonal stroke forbidden sign", GAME_STYLE_NOTE)
add("game-icons/wyr.png",      "two dice side by side", GAME_STYLE_NOTE)
add("game-icons/spotit.png",   "a detective magnifying glass with star sparkle", GAME_STYLE_NOTE)

# === 통역 드로어 대기 일러스트 ===
add("interpreter/empty.png", "a cute yellow bee holding a microphone and smiling, a small speech bubble says 안녕 and hello", "kawaii cartoon, thick outline, pure white background.")

# =====================================================================
# 2차 파이프라인 추가 에셋
# =====================================================================

# === 할리갈리 과일 4종 ===
add("halligalli/strawberry.png", "a single strawberry", "one red strawberry with tiny yellow seed dots and a green leafy stem on top, thick outline, kawaii sticker.")
add("halligalli/lime.png",       "a single lime",       "one bright green lime fruit, round, with a tiny leaf on top, thick outline, kawaii sticker.")
add("halligalli/banana.png",     "a single banana",     "one bright yellow banana with a small brown tip, gentle curve, thick outline, kawaii sticker.")
add("halligalli/plum.png",       "a single plum",       "one round purple plum fruit with a tiny green leaf, thick outline, kawaii sticker.")

# === 할리갈리 게임 카드 아이콘 ===
add("game-icons/halligalli.png", "a golden hand bell", "one golden hand bell with a wooden handle, small shake marks around, flat cartoon game card icon, honey-yellow and cream palette.")

# === 2차 파이프라인 Top 5 ===
add("mascot/bee-approve.png",        "a cheerful bee giving a thumbs up",       "yellow-black stripe chubby bee, one paw showing thumbs-up, sparkles around, kawaii sticker.")
add("interpreter/drag-drop.png",     "a friendly bee hugging a document file",  "a bee carrying a paper file with a dashed outline box behind suggesting drag-and-drop, upward arrow, kawaii.")
add("interpreter/success.png",       "a bee celebrating with a check mark",     "happy bee flying holding a large green check mark badge, mini stars, kawaii.")
add("patterns/bubble.png",           "soft bubble tile pattern",                "seamless tileable pattern of soft beige bubbles on white, very gentle, flat, no outlines, made for repeating wallpaper.")
add("icons/empty.png",               "empty-state placeholder",                 "a sleepy honeybee sitting on a tiny cloud with Zs, smiling closed eyes, pastel colors, kawaii sticker.")

# === DrawGuess 15장 (그림 맞히기) ===
DRAW_STYLE = "Children's storybook illustration, flat cartoon vector, single subject on pure white background, thick black outline, kawaii, no text, no letters, centered."
add("game-assets/draw/apple.png",   "a red apple",        f"{DRAW_STYLE} One bright red apple with tiny green leaf and short brown stem.")
add("game-assets/draw/banana.png",  "a banana",           f"{DRAW_STYLE} One ripe yellow banana with a small brown tip.")
add("game-assets/draw/dog.png",     "a puppy",            f"{DRAW_STYLE} One smiling brown puppy with floppy ears, sitting.")
add("game-assets/draw/cat.png",     "a cat",              f"{DRAW_STYLE} One orange tabby cat sitting with round eyes and pink nose.")
add("game-assets/draw/book.png",    "an open book",       f"{DRAW_STYLE} One open storybook with yellow cover and two blank cream pages.")
add("game-assets/draw/water.png",   "a water drop",       f"{DRAW_STYLE} One big blue teardrop water droplet with a white highlight.")
add("game-assets/draw/school.png",  "a school house",     f"{DRAW_STYLE} One small red schoolhouse with a white bell on top and a yellow door.")
add("game-assets/draw/friend.png",  "two kids hugging",   f"{DRAW_STYLE} Two cute round kids holding hands and smiling together.")
add("game-assets/draw/family.png",  "family portrait",    f"{DRAW_STYLE} A small family of three cute characters standing in a row smiling.")
add("game-assets/draw/house.png",   "a house",            f"{DRAW_STYLE} One cozy cottage house with a red roof, yellow square window, beige walls, small chimney.")
add("game-assets/draw/sun.png",     "a smiling sun",      f"{DRAW_STYLE} One yellow sun with eight triangular rays and a happy face in the center.")
add("game-assets/draw/moon.png",    "a crescent moon",    f"{DRAW_STYLE} One pale yellow crescent moon facing right with a sleepy closed eye.")
add("game-assets/draw/rice.png",    "a bowl of rice",     f"{DRAW_STYLE} One white bowl with blue rim filled with fluffy white rice, gentle steam curls.")
add("game-assets/draw/tea.png",     "a cup of tea",       f"{DRAW_STYLE} One teal round teacup with a handle, amber tea inside, three curly steam lines.")
add("game-assets/draw/thanks.png",  "thank you gesture",  f"{DRAW_STYLE} Two tiny cartoon hands clasped together in a thank-you bow pose, sparkles around.")

# === EmotionQuiz 15장 (감정 상황 카드) ===
EMO_STYLE = "Children's storybook illustration, flat cartoon, kawaii multicultural children, warm pastel palette, single scene on white background, no text, no letters, centered composition."
add("emotions/happy_birthday.png",  "birthday celebration", f"{EMO_STYLE} A kid smiling with a birthday cake and balloons, a friend congratulating with a gift.")
add("emotions/lost_item.png",       "lost a precious item", f"{EMO_STYLE} A sad kid kneeling on the ground looking for something, tears in eyes.")
add("emotions/drawing_ruined.png",  "drawing ruined",       f"{EMO_STYLE} A child looking angry and pointing to a torn piece of paper on the desk.")
add("emotions/dark_room.png",       "alone in dark room",   f"{EMO_STYLE} A scared child sitting alone in a dim bedroom hugging knees, moon through window.")
add("emotions/presentation.png",    "class presentation",   f"{EMO_STYLE} A nervous kid standing in front of a blackboard, classmates watching, red cheeks.")
add("emotions/meet_friend.png",     "reunion hug",          f"{EMO_STYLE} Two kids running toward each other with open arms, happy tears.")
add("emotions/studied_late.png",    "tired from study",     f"{EMO_STYLE} A sleepy kid at a desk yawning, books piled up, small clock showing late night.")
add("emotions/loud_noise.png",      "sudden loud noise",    f"{EMO_STYLE} A startled kid with wide eyes covering ears, shock lines behind head.")
add("emotions/get_gift.png",        "unexpected gift",      f"{EMO_STYLE} A delighted kid opening a wrapped present with a big smile, sparkles around.")
add("emotions/fall_down.png",       "fell down",            f"{EMO_STYLE} A kid crying softly on the playground ground with a scraped knee, friends approaching.")
add("emotions/win_game.png",        "won a game",           f"{EMO_STYLE} A kid holding up a trophy triumphantly, fist pumping, gold stars around.")
add("emotions/share_snack.png",     "sharing snack",        f"{EMO_STYLE} Two kids sitting together sharing cookies from one plate, smiling.")
add("emotions/new_school.png",      "first day new school", f"{EMO_STYLE} A nervous kid with a backpack standing in front of a school gate, hand waving goodbye to parent.")
add("emotions/pet_passed.png",      "sick pet",             f"{EMO_STYLE} A sad kid gently petting a small dog lying down, soft colors, warm mood.")
add("emotions/help_other.png",      "helping a classmate",  f"{EMO_STYLE} A kid picking up fallen books to help another kid, both smiling warmly.")

# === 틀린 그림 찾기 10쌍 (20장) ===
# Each pair shares a scene; version B explicitly lists 3 concrete differences.
# Note: Imagen/Gemini cannot guarantee pixel-identical base + tweaks, so this is
# best-effort. The game code will treat diffs as "side-A-only" / "side-B-only" flags.
def wyr_pair(idx: str, scene: str, a_extras: str, b_extras: str):
    common = f"{scene}. Flat cartoon storybook illustration, thick black outline, warm honey-yellow and pastel palette, children's book style, centered composition."
    add(f"spot-diff/{idx}_a.png", f"{scene} version A", f"{common} Scene A contains: {a_extras}")
    add(f"spot-diff/{idx}_b.png", f"{scene} version B", f"{common} Scene B is the SAME scene but with 3 small differences: {b_extras}")

wyr_pair("01_park",    "a sunny park with a tree, a bench, and clouds",           "one red balloon on the bench, one bird in the sky, two small flowers on the grass", "the balloon is BLUE, there is NO bird, and there are FOUR flowers on the grass.")
wyr_pair("02_kitchen", "a cozy kitchen scene with a stove and a table",           "five red apples on the table, a blue cup, the window is closed",                    "FOUR apples (one missing), a RED cup, the window is OPEN.")
wyr_pair("03_bedroom", "a tidy bedroom with a bed and window",                    "two pillows on the bed, yellow curtains, one book on the night stand",              "ONE pillow, PINK curtains, NO book on the night stand.")
wyr_pair("04_garden",  "a flower garden with a fence",                            "three red flowers, a butterfly, a wooden fence",                                    "three BLUE flowers, NO butterfly, a WHITE fence.")
wyr_pair("05_school",  "a classroom scene with blackboard and desks",             "letter A on blackboard, red schoolbag, two students at desks",                      "letter B on blackboard, BLUE schoolbag, ONE student.")
wyr_pair("06_sea",     "an ocean scene with waves and sky",                       "three fish under water, two clouds, a small sailboat",                              "TWO fish, THREE clouds, NO sailboat.")
wyr_pair("07_living",  "a living room with sofa and TV",                          "TV is on showing color bars, a cat on the sofa, green cushions",                    "TV is OFF (black), NO cat, RED cushions.")
wyr_pair("08_market",  "a fruit market stall",                                    "apples oranges and bananas on the stall, vendor with red cap, a scale",             "apples oranges and GRAPES (no bananas), vendor with YELLOW cap, NO scale.")
wyr_pair("09_playground", "a playground with swings and slide",                   "two swings, a yellow slide, a small dog near the slide",                            "ONE swing, a BLUE slide, NO dog.")
wyr_pair("10_night",   "a quiet night street with a lamppost",                    "lamppost light is ON, a full round moon, three stars in the sky",                   "lamppost light is OFF, a CRESCENT moon, FIVE stars.")


def load_api_key() -> str:
    env = os.environ.get("GEMINI_API_KEY")
    if env:
        return env.strip()
    if API_FILE.exists():
        k = API_FILE.read_text(encoding="utf-8").strip()
        if k:
            return k
    raise SystemExit("❌ api.txt 또는 GEMINI_API_KEY 필요")


def save_image(resp, out_path: Path) -> bool:
    """Extract first image part from Gemini response and save."""
    cands = getattr(resp, "candidates", None) or []
    for cand in cands:
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in getattr(content, "parts", None) or []:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(inline.data)
                return True
    return False


def main(group_filter: str | None = None):
    api_key = load_api_key()
    client = genai.Client(api_key=api_key)

    plan = PLAN
    if group_filter:
        plan = [p for p in PLAN if p[0].startswith(group_filter + "/")]

    print(f"🎨 Gemini 2.5 Flash Image ({MODEL}) — {len(plan)} 장 생성")
    print(f"📁 출력: {OUT.resolve()}\n")

    ok = 0
    skipped = 0
    failed: list[str] = []

    for i, (rel, subject, details) in enumerate(plan, 1):
        out_path = OUT / rel
        if out_path.exists() and out_path.stat().st_size > 0:
            print(f"  [{i:2d}/{len(plan)}] {rel}  ⏭️  skip")
            skipped += 1
            continue

        prompt = make_prompt(subject, details)
        print(f"  [{i:2d}/{len(plan)}] {rel} ...", end=" ", flush=True)

        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                ),
            )
            if save_image(resp, out_path):
                size_kb = out_path.stat().st_size // 1024
                print(f"✅ ({size_kb}KB)")
                ok += 1
            else:
                print("⚠️  no image in response")
                failed.append(rel)
        except Exception as e:
            msg = str(e)
            if len(msg) > 120:
                msg = msg[:120] + "..."
            print(f"❌ {msg}")
            failed.append(rel)

        # rate limit 보수적 — free tier 분당 ~10건
        time.sleep(6)

    print(f"\n{'='*60}")
    print(f"✅ 신규생성: {ok}  ⏭️ 스킵: {skipped}  ❌ 실패: {len(failed)}")
    if failed:
        for f in failed:
            print(f"   · {f}")
    print(f"{'='*60}")


if __name__ == "__main__":
    g = sys.argv[1] if len(sys.argv) > 1 else None
    main(g)
