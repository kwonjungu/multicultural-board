"""
Marble P0 16장 배치 — 필수 에셋.
- 빠진 6국 랜드마크 (일부는 이미 생성된 상태일 수 있으나 강제 overwrite OK)
- 7 특수 타일 (start/island/space/tax/festival/chance/goldkey)
- 3 건물 티어 (villa/building/hotel)
"""
from __future__ import annotations

import base64, json, os, sys, time
from pathlib import Path

from google import genai

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUT = ROOT / "output_cards"
STATE = Path(__file__).resolve().parent / ".marble_p0_job.json"
MODEL = "gemini-2.5-flash-image"

STYLE = (
    "Flat vector illustration, kawaii cute style with thick 4px black outline, "
    "warm honey-themed palette (primary golden yellow, accent amber, pastel supporting), "
    "centered single subject, pure white background, no text, no letters, no drop shadow, "
    "crisp square image. Match the art style of a Korean multicultural kids' app "
    "mascot bees (chubby, friendly, rounded)."
)

PLAN: list[tuple[str, str]] = [
    # 6개국 랜드마크 (기존 생성본이 있어도 P0 스펙 기준 재생성)
    ("landmarks/india.png",       "Taj Mahal iconic silhouette, white marble dome with 4 slim minarets, rose-pink sky backdrop with a tiny lotus at the base, simplified children's illustration."),
    ("landmarks/saudi.png",       "Abraj Al-Bait clock tower or stylized desert scene with a golden mosque dome and 2 date palm trees, warm sand beige base."),
    ("landmarks/myanmar.png",     "Shwedagon golden pagoda with tiered bell silhouette, cream-colored sky, two tiny prayer flags on the sides."),
    ("landmarks/cambodia.png",    "Angkor Wat central tower silhouette with 5 pineapple-shaped spires, jungle-green grass base, dawn-peach sky."),
    ("landmarks/mongolia.png",    "Traditional white ger (yurt) with blue sky, soft rolling green steppes, a single small fluffy cloud overhead."),
    ("landmarks/uzbekistan.png",  "Registan turquoise-domed madrasa with iwan archway, turquoise and gold mosaic facade, sunny sky."),

    # 7 특수 타일
    ("marble/tiles/start.png",    "A round hexagonal honeycomb START tile with a happy bee mascot waving, bold arrow pointing forward, radial sunburst rays."),
    ("marble/tiles/island.png",   "A tiny tropical island with one palm tree, sandy beach, a bee in a hammock sleeping, light turquoise water ring around."),
    ("marble/tiles/space.png",    "A cute cartoon spaceship with a bee pilot inside the round window, swirly star-speckled purple galaxy background, small planet."),
    ("marble/tiles/tax.png",      "A golden honey-jar treasure chest half-open revealing coin-like honeycomb pieces, with a gentle arrow pointing up to a donation symbol."),
    ("marble/tiles/festival.png", "Colorful lanterns and paper fans arranged in a circle, confetti bursts in 4 colors, a festive bee dancing in center."),
    ("marble/tiles/chance.png",   "A question mark shaped like a twisty honey drizzle, surrounded by 4 small sparkles, warm yellow background circle."),
    ("marble/tiles/goldkey.png",  "A shiny golden key with a honeycomb-shaped bow (handle), tiny sparkle glints on the tip, lying slightly diagonal."),

    # 3 건물 티어
    ("marble/buildings/villa.png",    "A small cozy one-story honey-themed cottage with hexagonal window, yellow roof, one bee flying above, children's book style."),
    ("marble/buildings/building.png", "A medium 3-story honeycomb-style office building with yellow-and-cream facade, rounded windows in hex shape, tiny flag on top."),
    ("marble/buildings/hotel.png",    "A grand 5-story luxury hotel with golden dome roof, honeycomb balconies, red carpet entrance, two palm trees, a crown-shaped sign."),
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
            if isinstance(data, str):
                data = base64.b64decode(data)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(data)
            return True
    return False


def submit():
    client = genai.Client(api_key=load_key())
    reqs = []
    for _path, prompt in PLAN:
        reqs.append({
            "contents": [{"parts": [{"text": f"{STYLE} Subject: {prompt}"}]}],
            "config": {"response_modalities": ["IMAGE"]},
        })
    job = client.batches.create(model=MODEL, src=reqs, config={"display_name": f"marble-p0-{int(time.time())}"})
    STATE.write_text(json.dumps({"name": job.name, "paths": [p for p, _ in PLAN]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📦 marble P0 batch: {len(reqs)} 건")
    print(f"📝 job={job.name}")


def _status():
    client = genai.Client(api_key=load_key())
    st = json.loads(STATE.read_text(encoding="utf-8"))
    return client, client.batches.get(name=st["name"]), st


def status():
    _, job, _ = _status()
    s = getattr(job, "state", None)
    print(f"state={getattr(s, 'name', None) or s}")


def collect():
    _, job, st = _status()
    dest = getattr(job, "dest", None)
    inlined = getattr(dest, "inlined_responses", None) if dest else None
    if not inlined:
        print("⚠️  no results"); return
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
