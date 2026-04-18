"""Generate mascot/pattern/landmark/icon assets via Gemini 2.5 Flash Image.

Usage: GEMINI_API_KEY=... python scripts/gen_assets.py [--only mascot|patterns|landmarks|icons] [--retry PATH1,PATH2]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from io import BytesIO
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
DESKTOP_COPY = Path.home() / "OneDrive" / "Desktop" / "bee-mascot-pack"
MODEL = "gemini-2.5-flash-image"

BEE_STYLE = (
    "Style: cute kawaii chibi bee character, thick bold outline (3-4px), "
    "rounded soft shapes, flat pastel colors with subtle cell shading, "
    "yellow-amber body (#F59E0B / #FBBF24), black stripes, small blue "
    "translucent wings, pink cheek blush, big expressive eyes, friendly "
    "for Korean elementary school kids (age 6-12). Front-facing full body, "
    "centered composition, transparent background PNG, 1024x1024, "
    "vector-style clean lines, no text, no watermark, Sanrio-meets-Padlet "
    "friendly aesthetic."
)

LANDMARK_STYLE = (
    "Tiny cute chibi landmark illustration, flat pastel colors, thick rounded "
    "black outline, centered, transparent PNG 256x256, childlike friendly "
    "educational style, no text, no watermark."
)

ICON_STYLE = (
    "Flat pastel illustration, thick rounded outline, transparent PNG 256x256, "
    "childlike friendly style matching a cute bee mascot, no text, no watermark."
)

ASSETS = [
    # ---------- Bee mascots ----------
    ("public/mascot/bee-welcome.png", BEE_STYLE + " A cheerful bee mascot waving one hand high above its head, big smiling open mouth showing joy, sparkly eyes curved into happy arcs, both wings fluttering, slight forward lean as if greeting someone."),
    ("public/mascot/bee-cheer.png", BEE_STYLE + " A bee mascot clapping both hands together in front of chest, mouth wide open cheering, star-shaped excited eyes, confetti dots floating around the head, energetic upward pose."),
    ("public/mascot/bee-think.png", BEE_STYLE + " A bee mascot in thinking pose, one tiny hand touching its chin, head tilted slightly, a small white thought bubble with a question mark floating above. Soft curious expression, round dot eyes."),
    ("public/mascot/bee-oops.png", BEE_STYLE + " A bee mascot looking apologetic and embarrassed, a single blue sweat drop on forehead, mouth in wavy nervous line, eyebrows slightly raised, one hand rubbing the back of its head. Cute 'sorry' pose."),
    ("public/mascot/bee-sleep.png", BEE_STYLE + " A bee mascot curled up sleeping peacefully, eyes closed as gentle curved lines, small pink sleeping cap, wings folded, 'Zzz' letters in soft blue floating above. Cozy nighttime feel."),
    ("public/mascot/bee-celebrate.png", BEE_STYLE + " A bee mascot with both arms raised in triumph, giant smile, colorful confetti (pink, mint, yellow, purple) exploding around it, gold star sparkles, a small party hat on top. Big celebration energy."),
    ("public/mascot/bee-loading.png", BEE_STYLE + " A bee mascot happily carrying a brown honey pot in its arms, focused cute face, wings mid-flap, tiny golden honey drips from the pot. Action-in-progress feel."),
    ("public/mascot/bee-shh.png", BEE_STYLE + " A bee mascot with one finger gently pressed to its lips making a 'shh' gesture, soft gentle smile, one eye slightly winking. 'Quiet please' pose, wearing small round glasses to signal teacher mode."),
    # ---------- Patterns ----------
    ("public/patterns/honeycomb.png",
     "A seamless tileable hexagonal honeycomb pattern, very subtle and faded, "
     "soft honey-amber color (#FDE68A) on transparent background, line-art style "
     "with 3px strokes, hexagons about 120px wide, minimal and calm, intended "
     "as a background texture behind warm cream (#FFFBEB) surface. "
     "Tileable 1024x1024 PNG with transparency. No text, no watermark."),
    ("public/patterns/flowers.png",
     "A seamless scattered pattern of tiny cute flowers and leaves, pastel colors "
     "(soft pink, mint, lavender, honey yellow), childlike hand-drawn feel, sparse "
     "density (plenty of empty space), flat illustration, no outlines, transparent "
     "background, tileable 1024x1024 PNG. No text, no watermark."),
    # ---------- Landmarks ----------
    ("public/landmarks/korea.png", LANDMARK_STYLE + " A cute tiny Gyeongbokgung palace gate with traditional Korean tiled roof, blue and red accents."),
    ("public/landmarks/vietnam.png", LANDMARK_STYLE + " A cute tiny Vietnamese conical non la hat with a green rice paddy silhouette."),
    ("public/landmarks/china.png", LANDMARK_STYLE + " A cute tiny chibi panda holding a small piece of bamboo."),
    ("public/landmarks/philippines.png", LANDMARK_STYLE + " A cute tiny colorful Filipino jeepney with rainbow decorations."),
    ("public/landmarks/japan.png", LANDMARK_STYLE + " A cute tiny Mt. Fuji with cherry blossom branches on the sides."),
    ("public/landmarks/usa.png", LANDMARK_STYLE + " A cute tiny Statue of Liberty with a friendly smile."),
    # ---------- Icons ----------
    ("public/icons/intro.png", ICON_STYLE + " A small chibi child waving hand with a friendly smile, multicultural-neutral design."),
    ("public/icons/today.png", ICON_STYLE + " A cute speech bubble with sparkle stars around it, honey-yellow color."),
    ("public/icons/praise.png", ICON_STYLE + " A cheerful gold star with a smiling face and two small hand-clap icons beside it."),
]


def generate_one(client: genai.Client, prompt: str, out_path: Path, size_hint: int) -> dict:
    """Call Gemini, save PNG, return metadata dict."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=[prompt],
            config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
        )
    except Exception as e:
        return {"path": str(out_path), "ok": False, "error": f"api:{e.__class__.__name__}:{e}"}

    img_bytes = None
    for part in resp.candidates[0].content.parts:
        if getattr(part, "inline_data", None) and part.inline_data.data:
            img_bytes = part.inline_data.data
            break
    if not img_bytes:
        return {"path": str(out_path), "ok": False, "error": "no_image_in_response"}

    try:
        im = Image.open(BytesIO(img_bytes))
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        if size_hint and max(im.size) != size_hint:
            im = im.resize((size_hint, size_hint), Image.LANCZOS)
        im.save(out_path, format="PNG", optimize=True)

        desktop_path = DESKTOP_COPY / out_path.relative_to(REPO / "public")
        desktop_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(desktop_path, format="PNG", optimize=True)

        return {"path": str(out_path), "ok": True, "size": im.size, "desktop": str(desktop_path)}
    except Exception as e:
        return {"path": str(out_path), "ok": False, "error": f"save:{e.__class__.__name__}:{e}"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="filter: mascot, patterns, landmarks, icons")
    ap.add_argument("--retry", help="comma-separated paths to regenerate only")
    ap.add_argument("--manifest", default="scripts/.gen_manifest.json")
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print("ERROR: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(2)
    client = genai.Client(api_key=key)

    targets = ASSETS
    if args.only:
        targets = [t for t in targets if f"/{args.only}/" in t[0]]
    if args.retry:
        wanted = {p.strip() for p in args.retry.split(",") if p.strip()}
        targets = [t for t in targets if t[0] in wanted]

    results = []
    for rel, prompt in targets:
        out = REPO / rel
        size_hint = 256 if ("/landmarks/" in rel or "/icons/" in rel) else 1024
        t0 = time.time()
        res = generate_one(client, prompt, out, size_hint)
        res["elapsed"] = round(time.time() - t0, 2)
        print(f"[{'OK ' if res['ok'] else 'ERR'}] {rel}  ({res['elapsed']}s)  {res.get('error','')}")
        results.append(res)
        time.sleep(0.6)

    manifest = REPO / args.manifest
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nManifest: {manifest}")
    ok = sum(1 for r in results if r["ok"])
    print(f"Success: {ok}/{len(results)}")
    sys.exit(0 if ok == len(results) else 1)


if __name__ == "__main__":
    main()
