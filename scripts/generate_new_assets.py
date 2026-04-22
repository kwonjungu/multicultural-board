"""새 게임 에셋 배치: Treasure 배경 3 + 게임 아이콘 3 + 마블 보드 배경 1 = 7장."""
from __future__ import annotations
import base64, json, os, sys, time
from pathlib import Path
from google import genai

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUT = ROOT / "output_cards"
STATE = Path(__file__).resolve().parent / ".new_assets_job.json"
MODEL = "gemini-2.5-flash-image"

STYLE = "Flat vector illustration, kawaii children's book style, thick 4px black outline, warm vibrant palette with honey-yellow accents, clean composition, no text, simple bold shapes."

PLAN: list[tuple[str, str]] = [
    # Treasure 배경 3장 (4:3 비율 의도)
    ("treasure/scene-park.png",   f"{STYLE} Scene: a sunny cartoon park — green grass, 2 large trees on left and right, flower bushes in corners, small pond in lower-center, wooden bench middle-left, blue sky with 2 fluffy clouds, no characters, empty sky area for gameplay overlay, 4:3 landscape."),
    ("treasure/scene-market.png", f"{STYLE} Scene: a cheerful open-air market — 3 colorful striped tents (red, blue, yellow) in a row, fruit baskets in front, warm brick ground, soft sunset sky, small flag banners, no characters, 4:3 landscape."),
    ("treasure/scene-school.png", f"{STYLE} Scene: a bright school playground — red brick school building on left, climbing frame and slide on right, soccer ball on grass, tree with swing, blue sky with sun, no characters, 4:3 landscape."),

    # Game icons (카드 아이콘 3장)
    ("game-icons/treasure.png", f"{STYLE} Subject: a rolled-up treasure map icon with a red X mark and a small golden key beside it, kawaii style."),
    ("game-icons/yut.png",      f"{STYLE} Subject: a set of 4 traditional Korean yut sticks arranged in a fan, warm walnut brown wood, kawaii."),
    ("game-icons/cafe.png",     f"{STYLE} Subject: a cute cafe scene — a steaming mug of coffee with heart latte art and a small pastry beside, kawaii."),
    ("game-icons/story.png",    f"{STYLE} Subject: an open storybook with a magical glow and tiny stars floating above, warm yellow pages."),

    # 마블 보드 중앙 로고 (꿀벌이 지구 주위를 나는 에셋)
    ("marble/board-center.png", f"{STYLE} Subject: a globe made of honeycomb hexagons with a cheerful yellow bee orbiting it with a small trail, golden sunburst rays behind, round medallion composition."),
]


def load_key() -> str:
    k = os.environ.get("GEMINI_API_KEY")
    if k: return k.strip()
    return API_FILE.read_text(encoding="utf-8").strip()


def save_image(resp_obj, out_path: Path) -> bool:
    cands = None
    if hasattr(resp_obj, "candidates"): cands = resp_obj.candidates
    elif isinstance(resp_obj, dict):    cands = resp_obj.get("candidates")
    for c in cands or []:
        content = getattr(c, "content", None) or (c.get("content") if isinstance(c, dict) else None)
        if not content: continue
        parts = getattr(content, "parts", None) or (content.get("parts") if isinstance(content, dict) else None)
        for p in parts or []:
            inline = getattr(p, "inline_data", None)
            if inline is None and isinstance(p, dict):
                inline = p.get("inlineData") or p.get("inline_data")
            if not inline: continue
            data = getattr(inline, "data", None)
            if data is None and isinstance(inline, dict):
                data = inline.get("data")
            if not data: continue
            if isinstance(data, str): data = base64.b64decode(data)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(data)
            return True
    return False


def submit():
    client = genai.Client(api_key=load_key())
    reqs = []
    for _p, prompt in PLAN:
        reqs.append({
            "contents": [{"parts": [{"text": prompt}]}],
            "config": {"response_modalities": ["IMAGE"]},
        })
    job = client.batches.create(model=MODEL, src=reqs, config={"display_name": f"new-assets-{int(time.time())}"})
    STATE.write_text(json.dumps({"name": job.name, "paths": [p for p, _ in PLAN]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📦 new-assets batch: {len(reqs)} 건")
    print(f"📝 job={job.name}")


def _get():
    client = genai.Client(api_key=load_key())
    st = json.loads(STATE.read_text(encoding="utf-8"))
    return client, client.batches.get(name=st["name"]), st


def status():
    _, job, _ = _get()
    print(f"state={getattr(getattr(job, 'state', None), 'name', None)}")


def collect():
    _, job, st = _get()
    dest = getattr(job, "dest", None)
    inlined = getattr(dest, "inlined_responses", None) if dest else None
    if not inlined:
        print("⚠️ no results"); return
    ok = 0; fail = []
    for i, holder in enumerate(inlined):
        rel = st["paths"][i]
        out = OUT / rel
        resp = getattr(holder, "response", None) or holder
        if save_image(resp, out):
            print(f"  ✅ {rel}  ({out.stat().st_size // 1024}KB)"); ok += 1
        else:
            err = getattr(holder, "error", None)
            print(f"  ❌ {rel}  err={err}"); fail.append(rel)
    print(f"\n✅ {ok} / {len(inlined)}")
    for f in fail: print(f"   · {f}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "submit"
    if cmd == "submit": submit()
    elif cmd == "status": status()
    elif cmd == "collect": collect()
