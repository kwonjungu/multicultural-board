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
