"""
🎨 카드 게임 심볼 13종 생성 스크립트
모델: Imagen 4 Fast (Google Gemini API)
비용: 장당 $0.02 × 13 = 약 $0.26 (₩360)

사용법:
    - 프로젝트 루트의 api.txt 에 GEMINI API 키만 한 줄로 저장 (gitignored)
    - python scripts/generate_cards.py
    - 결과는 output_cards/ 에 저장됨 (이후 public/spotit/ 로 move)
"""

import os
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError as e:
    raise SystemExit("❌ google-genai 미설치 — `pip install google-genai` 먼저 실행하세요.") from e

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUTPUT_DIR = ROOT / "output_cards"
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL_NAME = "imagen-4.0-fast-generate-001"

STYLE_PREFIX = (
    "Children's storybook illustration, flat cartoon vector, bold black outline, "
    "warm honey-yellow and soft pastel palette, single subject centered on a pure white background, "
    "no text, no letters, no numbers, no watermark, no logo, no extra objects."
)

# Each card leads with the subject name in plain English so Imagen does not
# misread the style prefix. Keep descriptions concrete and short.
CARDS = [
    ("00_apple",  "Subject: a red apple. One shiny red apple with a short brown stem and a tiny green leaf."),
    ("01_banana", "Subject: a banana. One ripe yellow banana lying on its side, slight curve, a small brown tip."),
    ("02_cat",    "Subject: a cat. One cute orange tabby cat sitting, round head, big round eyes, pink nose, whiskers."),
    ("03_dog",    "Subject: a dog. One cheerful brown puppy sitting, floppy ears, friendly smile, small round nose."),
    ("04_book",   "Subject: a book. One open storybook with a yellow cover, two blank cream pages, a red bookmark ribbon."),
    ("05_water",  "Subject: a water drop. One big blue teardrop-shaped water droplet with a white glossy highlight."),
    ("06_school", "Subject: a school building. A red school house with a white bell on top, a yellow door, two windows."),
    ("07_house",  "Subject: a house. A cozy cottage with beige walls, red triangular roof, a yellow square window, a small chimney."),
    ("08_sun",    "Subject: a smiling sun. A cheerful yellow sun with eight triangular rays, rosy cheeks, closed happy eyes."),
    ("09_moon",   "Subject: a crescent moon. A pale yellow crescent moon with a sleepy closed eye and tiny eyelashes."),
    ("10_rice",   "Subject: a bowl of rice. A white bowl with a blue rim filled with fluffy white rice, gentle steam curls."),
    ("11_tea",    "Subject: a cup of tea. A teal round teacup with a handle, amber tea inside, three curly steam lines rising."),
    ("12_bee",    "Subject: a honey bee. A round chubby cartoon bee with yellow-and-black stripes, small translucent wings, smiling face."),
]


def load_api_key() -> str:
    env = os.environ.get("GEMINI_API_KEY")
    if env:
        return env.strip()
    if API_FILE.exists():
        key = API_FILE.read_text(encoding="utf-8").strip()
        if key:
            return key
    raise SystemExit(
        f"❌ API 키가 없습니다. {API_FILE} 파일에 키를 넣거나 GEMINI_API_KEY 환경변수를 설정하세요."
    )


def main():
    api_key = load_api_key()
    client = genai.Client(api_key=api_key)

    print(f"🎨 Imagen 4 Fast로 {len(CARDS)}장 생성 시작")
    print(f"📁 저장 위치: {OUTPUT_DIR.resolve()}")
    print(f"💰 예상 비용: ${len(CARDS) * 0.02:.2f} (약 ₩{int(len(CARDS) * 0.02 * 1400):,})\n")

    success_count = 0
    failed = []

    for idx, (name, body) in enumerate(CARDS, 1):
        full_prompt = f"{STYLE_PREFIX}\n\n{body}"
        out_path = OUTPUT_DIR / f"{name}.png"

        if out_path.exists():
            print(f"  [{idx:2d}/{len(CARDS)}] {name} ⏭️  이미 존재, 스킵")
            success_count += 1
            continue

        print(f"  [{idx:2d}/{len(CARDS)}] {name} 생성 중...", end=" ", flush=True)

        try:
            response = client.models.generate_images(
                model=MODEL_NAME,
                prompt=full_prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="1:1",
                    output_mime_type="image/png",
                ),
            )

            if response.generated_images:
                image_bytes = response.generated_images[0].image.image_bytes
                out_path.write_bytes(image_bytes)
                print(f"✅ ({len(image_bytes)//1024}KB)")
                success_count += 1
            else:
                print("⚠️  응답에 이미지 없음")
                failed.append(name)

        except Exception as e:
            print(f"❌ 실패: {e}")
            failed.append(name)

        # Gemini Imagen free-tier 제한: 모델당 분당 10건. 7초 간격이면 안전.
        time.sleep(7)

    print(f"\n{'='*50}")
    print(f"✅ 성공: {success_count}/{len(CARDS)}")
    if failed:
        print(f"❌ 실패: {failed}")
        print("   → 이 스크립트를 다시 실행하면 실패한 것만 재시도됩니다.")
    print(f"💰 실제 비용: 약 ${success_count * 0.02:.2f}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
