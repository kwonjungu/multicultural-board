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

STICKER_STYLE = (
    "Tiny cute chibi illustration, flat pastel colors, thick rounded black "
    "outline (3-4px), centered, transparent PNG, vector-style clean lines, "
    "no text, no watermark."
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
    ("public/mascot/bee-student.png", BEE_STYLE + " A cheerful young student bee wearing a small red backpack strap over one shoulder, a tiny yellow school cap, eager bright eyes, waving one hand, holding a tiny red-and-blue pencil in the other hand. Kid-student energy."),
    ("public/mascot/bee-teacher.png", BEE_STYLE + " A friendly teacher bee with round black-rimmed glasses, a small pointer stick in one hand, a tiny green open book in the other, warm confident smile, a tiny bun/hair-knot on top, gentle authoritative pose."),
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
    ("public/landmarks/russia.png", LANDMARK_STYLE + " A cute tiny Saint Basil's Cathedral with colorful onion domes (red, blue, green, gold)."),
    ("public/landmarks/thailand.png", LANDMARK_STYLE + " A cute tiny golden Thai temple roof (like Wat Arun spire) with a small smiling elephant beside it."),
    ("public/landmarks/indonesia.png", LANDMARK_STYLE + " A cute tiny Borobudur-style stepped stupa temple with a smiling sun and tropical leaves."),
    # ---------- Icons ----------
    ("public/icons/intro.png", ICON_STYLE + " A small chibi child waving hand with a friendly smile, multicultural-neutral design."),
    ("public/icons/today.png", ICON_STYLE + " A cute speech bubble with sparkle stars around it, honey-yellow color."),
    ("public/icons/praise.png", ICON_STYLE + " A cheerful gold star with a smiling face and two small hand-clap icons beside it."),
    # ---------- Stickers: Growth stages (512x512, BEE_STYLE) ----------
    ("public/stickers/stage-1-egg.png", BEE_STYLE + " A cute white bee egg with tiny speckles, sitting on a small honeycomb pad, gentle shine highlight."),
    ("public/stickers/stage-2-larva.png", BEE_STYLE + " A chubby yellow-amber bee larva with big round kawaii eyes, smiling, soft body segments visible."),
    ("public/stickers/stage-3-pupa.png", BEE_STYLE + " A golden-yellow pupa cocoon with thin horizontal bee stripes, sparkle shines around, mysterious inner glow."),
    ("public/stickers/stage-4-bee.png", BEE_STYLE + " A young kawaii chibi bee with freshly-emerged translucent wings, first-flight pose (small hop), tiny sparkles."),
    ("public/stickers/stage-5-queen.png", BEE_STYLE + " A kawaii chibi queen bee with a small gold crown on head, longer elegant wings, confident leader pose, soft light halo behind."),
    # ---------- Stickers: Sticker types (256x256, BEE_STYLE) ----------
    ("public/stickers/sticker-helpful.png", BEE_STYLE + " A cute chibi bee holding a big red heart with both tiny hands, gentle smile, pastel pink+yellow."),
    ("public/stickers/sticker-brave.png", BEE_STYLE + " A cute chibi bee holding a small round shield, confident grin, orange+yellow."),
    ("public/stickers/sticker-creative.png", BEE_STYLE + " A cute chibi bee with a glowing yellow lightbulb popping above its head, sparkle stars around, magenta+gold."),
    ("public/stickers/sticker-cooperative.png", BEE_STYLE + " Two cute chibi bees holding tiny hands together in friendship, both smiling, soft rainbow backdrop accent."),
    ("public/stickers/sticker-persistent.png", BEE_STYLE + " A cute chibi bee running forward with a tiny sweat drop and determined face, small green leaf motif behind, mint+yellow."),
    ("public/stickers/sticker-curious.png", BEE_STYLE + " A cute chibi bee holding a round magnifying glass, wide curious eyes peering through, cyan+yellow."),
    # ---------- Stickers: Hive pieces ----------
    ("public/stickers/hive-cell-empty.png", STICKER_STYLE + " A single empty hexagonal honeycomb cell with subtle wax texture, cream/beige (#FEF3C7 tone), very light shadow, transparent background. 128x128."),
    ("public/stickers/hive-cell-filled.png", STICKER_STYLE + " A single hexagonal honeycomb cell filled with glossy honey (amber glow), a tiny cute bee face peeking out from the center, warm amber. 128x128."),
    ("public/stickers/hive-crown.png", STICKER_STYLE + " A hexagonal aura made of radiating golden stars and sparkles (decorative halo for queen bee status), gold+cream, transparent background. 256x256."),
    # ---------- Stickers: Performance (512x512) ----------
    ("public/stickers/confetti-honey.png", STICKER_STYLE + " A joyful burst of honey drops, flower petals, stars, and small hearts scattered across the frame (for celebration moments), honey-yellow + pink + mint + gold, no background. 512x512."),
    ("public/stickers/levelup-burst.png", STICKER_STYLE + " Radial beams of golden light radiating outward from center with sparkle accents (for level-up moment background), gold + warm white, transparent. 512x512."),
    # ---------- Stickers: Skins (256x256, BEE_STYLE side view) ----------
    ("public/stickers/skin-classic.png", BEE_STYLE + " Side view of a chibi bee with small wings visible, classic bright yellow-amber bee body (default)."),
    ("public/stickers/skin-orange.png", BEE_STYLE + " Side view of a chibi bee with small wings visible, warm orange bee body (replace the default yellow with warm orange)."),
    ("public/stickers/skin-green.png", BEE_STYLE + " Side view of a chibi bee with small wings visible, mint-lime green bee body (replace the default yellow with mint-lime green)."),
    ("public/stickers/skin-sky.png", BEE_STYLE + " Side view of a chibi bee with small wings visible, sky blue bee body (replace the default yellow with sky blue)."),
    ("public/stickers/skin-pink.png", BEE_STYLE + " Side view of a chibi bee with small wings visible, soft pink bee body (replace the default yellow with soft pink)."),
    ("public/stickers/skin-purple.png", BEE_STYLE + " Side view of a chibi bee with small wings visible, lavender purple bee body (replace the default yellow with lavender purple)."),
    # ---------- Stickers: Hats (256x256, isolated item only, NO bee) ----------
    ("public/stickers/hat-top.png", STICKER_STYLE + " A small black silk top hat with a thin band and subtle shine. Isolated item only, NO bee attached, designed to be overlaid on top of a bee. 256x256."),
    ("public/stickers/hat-cap.png", STICKER_STYLE + " A red baseball cap with white visor. Isolated item only, NO bee attached, designed to be overlaid on top of a bee. 256x256."),
    ("public/stickers/hat-ribbon.png", STICKER_STYLE + " A pink silk bow/ribbon headband. Isolated item only, NO bee attached, designed to be overlaid on top of a bee. 256x256."),
    ("public/stickers/hat-crown.png", STICKER_STYLE + " A golden princess crown with small jewel accents. Isolated item only, NO bee attached, designed to be overlaid on top of a bee. 256x256."),
    # ---------- Stickers: Pets (256x256, full body chibi, friendly pose) ----------
    ("public/stickers/pet-dog.png", STICKER_STYLE + " A chibi shiba-like puppy, cream/tan coat, friendly sit pose. Full body chibi character. 256x256."),
    ("public/stickers/pet-cat.png", STICKER_STYLE + " A chibi kitten, orange tabby, rounded body, cute pose. Full body chibi character. 256x256."),
    ("public/stickers/pet-rabbit.png", STICKER_STYLE + " A chibi white rabbit with long ears, sitting. Full body chibi character. 256x256."),
    ("public/stickers/pet-butterfly.png", STICKER_STYLE + " A colorful chibi butterfly (pink/purple/blue wings) in flight pose. Full body chibi character. 256x256."),
    # ---------- Stickers: Trophies (256x256) ----------
    ("public/stickers/trophy-gold.png", STICKER_STYLE + " A classic gold trophy cup with two handles, shine on the body. 256x256."),
    ("public/stickers/trophy-star.png", STICKER_STYLE + " A shining golden five-pointed star trophy on a small base. 256x256."),
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
    try:
        cand = resp.candidates[0] if resp.candidates else None
        content = getattr(cand, "content", None) if cand else None
        parts = getattr(content, "parts", None) if content else None
        if parts:
            for part in parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    img_bytes = part.inline_data.data
                    break
    except Exception as e:
        return {"path": str(out_path), "ok": False, "error": f"parse:{e.__class__.__name__}:{e}"}
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
        if "/landmarks/" in rel or "/icons/" in rel:
            size_hint = 256
        elif "/stickers/" in rel:
            name = Path(rel).name
            if name.startswith("stage-") or name in ("confetti-honey.png", "levelup-burst.png"):
                size_hint = 512
            elif name in ("hive-cell-empty.png", "hive-cell-filled.png"):
                size_hint = 128
            else:
                size_hint = 256
        else:
            size_hint = 1024
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
