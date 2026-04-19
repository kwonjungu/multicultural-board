"""
Spot-Difference B-version regenerator via Gemini 2.5 Flash Image (edit mode).

Each A image is fed back in as visual context with an edit instruction —
"keep the whole composition identical EXCEPT make only these 3 small changes".
Color-shift edits are unreliable, so diffs are add/remove/count style only.

Runs as a Batch API job (50% cheaper).

Usage:
    python scripts/generate_spotdiff.py submit
    python scripts/generate_spotdiff.py status
    python scripts/generate_spotdiff.py collect
    python scripts/generate_spotdiff.py run          # submit → poll → collect
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
from pathlib import Path

from google import genai

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output_cards" / "spot-diff"
OUT.mkdir(parents=True, exist_ok=True)
STATE = Path(__file__).resolve().parent / ".spotdiff_job.json"
API_FILE = ROOT / "api.txt"

MODEL = "gemini-2.5-flash-image"

# 10 scenes. Each lists (id, base_filename_a, edit_instruction, diffs_for_game).
# Diffs use add/remove/count vocabulary only — no color changes, no "blue→red".
SCENES: list[dict] = [
    {
        "id": "01_park",
        "a": "01_park_a.png",
        "instruction": (
            "Keep the entire scene identical — same tree, same bench, same sky, "
            "same style, same composition, same colors, same outlines. "
            "Make ONLY these 3 small changes: "
            "(1) REMOVE the bird in the sky completely. "
            "(2) ADD one more cloud in the upper right area. "
            "(3) REMOVE the balloon from the bench so the bench is empty."
        ),
        "diffs": [
            {"label": "새가 사라졌어요", "where": "하늘"},
            {"label": "구름이 한 개 더 있어요", "where": "오른쪽 위"},
            {"label": "풍선이 없어졌어요", "where": "벤치"},
        ],
    },
    {
        "id": "02_kitchen",
        "a": "02_kitchen_a.png",
        "instruction": (
            "Keep the entire kitchen scene identical — same stove, table, wall, style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE one apple from the table (5 apples → 4 apples). "
            "(2) REMOVE the cup completely. "
            "(3) ADD a small clock on the wall above the stove."
        ),
        "diffs": [
            {"label": "사과가 한 개 없어졌어요", "where": "식탁"},
            {"label": "컵이 사라졌어요", "where": "식탁"},
            {"label": "시계가 생겼어요", "where": "벽"},
        ],
    },
    {
        "id": "03_bedroom",
        "a": "03_bedroom_a.png",
        "instruction": (
            "Keep the bedroom scene identical — same bed, same window, same style. "
            "Make ONLY these 3 small changes: "
            "(1) REMOVE one pillow (2 pillows → 1 pillow). "
            "(2) REMOVE the book from the nightstand. "
            "(3) ADD a small teddy bear on the bed."
        ),
        "diffs": [
            {"label": "베개가 하나 없어졌어요", "where": "침대"},
            {"label": "책이 없어졌어요", "where": "협탁"},
            {"label": "곰인형이 생겼어요", "where": "침대 위"},
        ],
    },
    {
        "id": "04_garden",
        "a": "04_garden_a.png",
        "instruction": (
            "Keep the garden scene identical — same fence, same grass, same style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE the butterfly completely. "
            "(2) ADD two more flowers in the foreground. "
            "(3) ADD a small snail on the grass near the fence."
        ),
        "diffs": [
            {"label": "나비가 사라졌어요", "where": "정원"},
            {"label": "꽃이 두 송이 더 있어요", "where": "앞쪽"},
            {"label": "달팽이가 생겼어요", "where": "울타리 옆"},
        ],
    },
    {
        "id": "05_school",
        "a": "05_school_a.png",
        "instruction": (
            "Keep the classroom identical — same blackboard, same desks, same style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE one student so only one remains at a desk. "
            "(2) ADD a picture frame on the wall beside the blackboard. "
            "(3) REMOVE the schoolbag from the floor."
        ),
        "diffs": [
            {"label": "학생이 한 명 없어졌어요", "where": "책상"},
            {"label": "액자가 생겼어요", "where": "칠판 옆"},
            {"label": "가방이 사라졌어요", "where": "바닥"},
        ],
    },
    {
        "id": "06_sea",
        "a": "06_sea_a.png",
        "instruction": (
            "Keep the ocean scene identical — same waves, same sky, same style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE one fish (3 fish → 2 fish). "
            "(2) ADD one more cloud in the sky. "
            "(3) REMOVE the sailboat completely."
        ),
        "diffs": [
            {"label": "물고기가 한 마리 없어졌어요", "where": "바닷속"},
            {"label": "구름이 한 개 더 있어요", "where": "하늘"},
            {"label": "배가 사라졌어요", "where": "바다"},
        ],
    },
    {
        "id": "07_living",
        "a": "07_living_a.png",
        "instruction": (
            "Keep the living room identical — same sofa, same TV, same style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE the cat from the sofa. "
            "(2) ADD a small potted plant beside the TV. "
            "(3) REMOVE one cushion from the sofa."
        ),
        "diffs": [
            {"label": "고양이가 사라졌어요", "where": "소파"},
            {"label": "화분이 생겼어요", "where": "TV 옆"},
            {"label": "쿠션이 하나 없어졌어요", "where": "소파"},
        ],
    },
    {
        "id": "08_market",
        "a": "08_market_a.png",
        "instruction": (
            "Keep the market stall identical — same stall frame, same vendor, same style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE the bananas completely (leave apples and oranges). "
            "(2) REMOVE the scale from the stall. "
            "(3) ADD one small sign above the stall."
        ),
        "diffs": [
            {"label": "바나나가 사라졌어요", "where": "가판대"},
            {"label": "저울이 없어졌어요", "where": "가판대"},
            {"label": "간판이 생겼어요", "where": "가판 위"},
        ],
    },
    {
        "id": "09_playground",
        "a": "09_playground_a.png",
        "instruction": (
            "Keep the playground identical — same swings, same slide, same style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE one swing (2 swings → 1 swing). "
            "(2) REMOVE the dog completely. "
            "(3) ADD a small kite flying in the sky."
        ),
        "diffs": [
            {"label": "그네가 하나 없어졌어요", "where": "그네"},
            {"label": "강아지가 사라졌어요", "where": "놀이터"},
            {"label": "연이 생겼어요", "where": "하늘"},
        ],
    },
    {
        "id": "10_night",
        "a": "10_night_a.png",
        "instruction": (
            "Keep the night street identical — same lamppost, same building, same style. "
            "Make ONLY these 3 changes: "
            "(1) REMOVE one star (3 stars → 2 stars). "
            "(2) ADD a small cat sitting under the lamppost. "
            "(3) REMOVE the moon completely."
        ),
        "diffs": [
            {"label": "별이 하나 없어졌어요", "where": "하늘"},
            {"label": "고양이가 생겼어요", "where": "가로등 아래"},
            {"label": "달이 사라졌어요", "where": "하늘"},
        ],
    },
]


def load_key() -> str:
    k = os.environ.get("GEMINI_API_KEY")
    if k:
        return k.strip()
    return API_FILE.read_text(encoding="utf-8").strip()


def build_requests() -> list[dict]:
    # Read each A image, base64 it, attach as inline_data input for editing.
    reqs = []
    src_dir = ROOT / "public" / "spot-diff"
    for s in SCENES:
        a_path = src_dir / s["a"]
        if not a_path.exists():
            # fallback to output_cards
            a_path = ROOT / "output_cards" / "spot-diff" / s["a"]
        if not a_path.exists():
            raise FileNotFoundError(a_path)
        b64 = base64.b64encode(a_path.read_bytes()).decode("ascii")
        reqs.append({
            "contents": [{
                "parts": [
                    {"text": s["instruction"]},
                    {"inline_data": {"mime_type": "image/png", "data": b64}},
                ],
            }],
            "config": {"response_modalities": ["IMAGE"]},
        })
    return reqs


def save_image(resp_obj, out_path: Path) -> bool:
    cands = None
    if hasattr(resp_obj, "candidates"):
        cands = resp_obj.candidates
    elif isinstance(resp_obj, dict):
        cands = resp_obj.get("candidates")
    for c in cands or []:
        content = getattr(c, "content", None) or (c.get("content") if isinstance(c, dict) else None)
        if not content:
            continue
        parts = getattr(content, "parts", None) or (content.get("parts") if isinstance(content, dict) else None)
        for p in parts or []:
            inline = getattr(p, "inline_data", None)
            if inline is None and isinstance(p, dict):
                inline = p.get("inlineData") or p.get("inline_data")
            if not inline:
                continue
            data = getattr(inline, "data", None)
            if data is None and isinstance(inline, dict):
                data = inline.get("data")
            if not data:
                continue
            if isinstance(data, str):
                data = base64.b64decode(data)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(data)
            return True
    return False


def submit():
    client = genai.Client(api_key=load_key())
    reqs = build_requests()
    print(f"📦 submitting edit-mode batch: {len(reqs)} 건")
    job = client.batches.create(
        model=MODEL,
        src=reqs,
        config={"display_name": f"spotdiff-edit-{int(time.time())}"},
    )
    STATE.write_text(json.dumps({
        "name": job.name,
        "ids": [s["id"] for s in SCENES],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📝 job={job.name}")


def status_cmd():
    client = genai.Client(api_key=load_key())
    st = json.loads(STATE.read_text(encoding="utf-8"))
    job = client.batches.get(name=st["name"])
    s = getattr(job, "state", None)
    name = getattr(s, "name", None) if s else None
    print(f"state={name or s}")
    return job


def collect():
    client = genai.Client(api_key=load_key())
    st = json.loads(STATE.read_text(encoding="utf-8"))
    job = client.batches.get(name=st["name"])
    dest = getattr(job, "dest", None)
    inlined = getattr(dest, "inlined_responses", None) if dest else None
    if not inlined:
        print("⚠️  no results")
        return
    ok = 0
    fail = []
    for i, holder in enumerate(inlined):
        sid = st["ids"][i]
        out = OUT / f"{sid}_b.png"
        resp = getattr(holder, "response", None) or holder
        if save_image(resp, out):
            print(f"  ✅ {sid}  ({out.stat().st_size // 1024}KB)")
            ok += 1
        else:
            err = getattr(holder, "error", None)
            print(f"  ❌ {sid}  err={err}")
            fail.append(sid)
    print(f"\n✅ {ok} / {len(inlined)}")
    if fail:
        for f in fail:
            print(f"   · {f}")


def run():
    submit()
    print("⏳ polling...")
    for i in range(80):
        time.sleep(30)
        job = status_cmd()
        s = getattr(job, "state", None)
        name = getattr(s, "name", None) if s else None
        if name in ("JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"):
            print(f"🏁 {name}")
            break
    collect()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "submit": submit()
    elif cmd == "status": status_cmd()
    elif cmd == "collect": collect()
    elif cmd == "run": run()
    else: print(f"unknown cmd: {cmd}"); sys.exit(2)
