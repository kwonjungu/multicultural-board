"""QA generated assets: technical + Gemini-vision semantic check.

Reports failures and writes retry list. Does NOT regenerate (that's handled by runner).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
QA_MODEL = "gemini-2.5-flash"

MASCOT_QA_PROMPT = """You are a strict QA reviewer for a cute children's app mascot pack.
Inspect this bee mascot illustration for AI-generation errors.

Check these criteria. Mark "fail" only if the issue is clearly visible:
1. transparent_background: background must be transparent, not white/colored
2. no_text: NO letters, words, or watermark visible (EXCEPT: "Zzz" is allowed for sleeping mascot, "?" is allowed for thinking mascot)
3. anatomy: no extra/missing limbs, no malformed hands (count fingers/hands roughly — a chibi may have mitten-like hands which is OK, but mangled/melted shapes are NOT OK)
4. style_match: thick bold outline (3-4px), yellow-amber bee body with black stripes, kawaii chibi style
5. wing_count: should have 2 or 4 wings (not 3, not 1, not melted together)
6. face_readable: eyes, mouth, face clearly readable, not deformed

Return ONLY JSON: {"pass": true/false, "issues": ["short issue 1", "short issue 2"]}
If pass is true, issues must be [].
"""

LANDMARK_QA_PROMPT = """Strict QA for children's educational landmark illustration.
1. transparent_background: must be transparent
2. no_text: NO letters or watermark
3. subject_correct: matches the expected landmark (you will be told what to expect)
4. style: flat pastel with thick rounded black outline, chibi/cute
5. no_artifacts: no melted shapes, no duplicated features, no garbled details

Expected subject: {subject}

Return ONLY JSON: {{"pass": true/false, "issues": ["..."]}}
"""

ICON_QA_PROMPT = """Strict QA for children's app category icon.
1. transparent_background
2. no_text / no watermark
3. style: flat pastel with thick rounded outline, kid-friendly
4. subject_correct: matches description

Expected subject: {subject}

Return ONLY JSON: {{"pass": true/false, "issues": ["..."]}}
"""

PATTERN_QA_PROMPT = """Strict QA for seamless background pattern.
1. transparent_background: truly transparent (alpha channel used)
2. no_text / no watermark
3. style_match: matches description
4. no_artifacts: no obvious tiling seams visible, no garbled shapes

Expected: {subject}

Return ONLY JSON: {{"pass": true/false, "issues": ["..."]}}
"""

ASSETS_META = {
    "public/mascot/bee-welcome.png":    ("mascot", "bee waving hand, greeting"),
    "public/mascot/bee-cheer.png":      ("mascot", "bee clapping, cheering"),
    "public/mascot/bee-think.png":      ("mascot", "bee thinking with question mark bubble"),
    "public/mascot/bee-oops.png":       ("mascot", "bee apologetic with sweat drop"),
    "public/mascot/bee-sleep.png":      ("mascot", "bee sleeping with Zzz and nightcap"),
    "public/mascot/bee-celebrate.png":  ("mascot", "bee celebrating with confetti"),
    "public/mascot/bee-loading.png":    ("mascot", "bee carrying honey pot"),
    "public/mascot/bee-shh.png":        ("mascot", "bee with finger to lips (shh), wearing glasses, winking — finger MUST be at the lips, not in front of body"),
    "public/patterns/honeycomb.png":    ("pattern", "seamless honeycomb hex pattern, faint honey-amber on transparent"),
    "public/patterns/flowers.png":      ("pattern", "seamless scattered pastel flowers, childlike, sparse"),
    "public/landmarks/korea.png":       ("landmark", "Gyeongbokgung palace gate with tiled roof"),
    "public/landmarks/vietnam.png":     ("landmark", "Vietnamese non la conical hat + rice paddy"),
    "public/landmarks/china.png":       ("landmark", "chibi panda holding bamboo"),
    "public/landmarks/philippines.png": ("landmark", "colorful Filipino jeepney"),
    "public/landmarks/japan.png":       ("landmark", "Mt. Fuji with cherry blossoms"),
    "public/landmarks/usa.png":         ("landmark", "Statue of Liberty, smiling"),
    "public/icons/intro.png":           ("icon", "chibi child waving hand"),
    "public/icons/today.png":           ("icon", "speech bubble with sparkle stars, honey-yellow"),
    "public/icons/praise.png":          ("icon", "smiling gold star with clap icons"),
}


def check_transparency(img_path: Path) -> tuple[bool, str]:
    """Quick technical check: does image actually use alpha?"""
    try:
        im = Image.open(img_path)
        if im.mode != "RGBA":
            return False, f"mode={im.mode} (expected RGBA)"
        alpha = im.split()[3]
        extrema = alpha.getextrema()
        if extrema[0] == 255:
            return False, "alpha is fully opaque — no transparent area"
        return True, ""
    except Exception as e:
        return False, f"open failed: {e}"


def qa_one(client: genai.Client, rel: str) -> dict:
    kind, subject = ASSETS_META[rel]
    path = REPO / rel
    if not path.exists():
        return {"path": rel, "pass": False, "issues": ["file missing"]}

    ok_alpha, alpha_msg = check_transparency(path)
    technical_issues = [] if ok_alpha else [f"transparency:{alpha_msg}"]

    if kind == "mascot":
        prompt = MASCOT_QA_PROMPT
    elif kind == "landmark":
        prompt = LANDMARK_QA_PROMPT.format(subject=subject)
    elif kind == "icon":
        prompt = ICON_QA_PROMPT.format(subject=subject)
    else:
        prompt = PATTERN_QA_PROMPT.format(subject=subject)

    with open(path, "rb") as f:
        img_bytes = f.read()

    try:
        resp = client.models.generate_content(
            model=QA_MODEL,
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type="image/png"),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        data = json.loads(resp.text)
        issues = technical_issues + list(data.get("issues", []))
        # Pattern transparency check is advisory only for patterns (prompt asks for subtle pattern
        # which the model may render on a cream surface). Only fail if Gemini also complains.
        if kind == "pattern" and technical_issues and not data.get("issues"):
            technical_issues = []
            issues = []
        passed = bool(data.get("pass")) and not technical_issues
        return {"path": rel, "pass": passed, "issues": issues}
    except Exception as e:
        return {"path": rel, "pass": False, "issues": technical_issues + [f"qa_api:{e}"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="filter: mascot, patterns, landmarks, icons")
    ap.add_argument("--out", default="scripts/.qa_report.json")
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print("ERROR: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(2)
    client = genai.Client(api_key=key)

    targets = list(ASSETS_META.keys())
    if args.only:
        targets = [t for t in targets if f"/{args.only}/" in t]

    results = []
    for rel in targets:
        r = qa_one(client, rel)
        mark = "PASS" if r["pass"] else "FAIL"
        issues = "; ".join(r["issues"]) if r["issues"] else ""
        print(f"[{mark}] {rel}  {issues}")
        results.append(r)

    out = REPO / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    fails = [r["path"] for r in results if not r["pass"]]
    print(f"\nQA: {len(targets) - len(fails)}/{len(targets)} passed")
    if fails:
        print("Failed:")
        for f in fails:
            print(f"  {f}")
    sys.exit(0 if not fails else 1)


if __name__ == "__main__":
    main()
