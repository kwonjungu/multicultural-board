"""
Skin re-color batch — use stage-{1..5}-{name}.png as reference and recolor the
bee's yellow body into each skin variant while KEEPING the same pose, outline,
composition, and accessories.

Produces:
    public/stickers/stage-1-egg-<skin>.png   etc.
for skins: orange, green, sky, pink, purple
(classic == unchanged stage image, not regenerated)
"""
from __future__ import annotations

import base64, json, os, sys, time
from pathlib import Path

from google import genai
from google.genai import types  # noqa: F401

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUT = ROOT / "output_cards" / "skins"
OUT.mkdir(parents=True, exist_ok=True)
STATE = Path(__file__).resolve().parent / ".skins_job.json"
MODEL = "gemini-2.5-flash-image"

STAGES = [
    ("stage-1-egg",   "egg",   "a baby bee mascot with an egg"),
    ("stage-2-larva", "larva", "a baby bee/larva mascot"),
    ("stage-3-pupa",  "pupa",  "a bee mascot with a small pupa cocoon at the bottom"),
    ("stage-4-bee",   "bee",   "a chubby adult bee mascot"),
    ("stage-5-queen", "queen", "a queen bee mascot with a tiny crown"),
]

# hex color hints kept OUT of the prompt (Imagen misreads hex); use plain names.
SKINS = [
    ("orange", "warm orange",  "orange body instead of yellow, keep black stripes"),
    ("green",  "soft mint green", "mint green body instead of yellow, keep black stripes"),
    ("sky",    "pastel sky blue", "pastel sky-blue body instead of yellow, keep black stripes"),
    ("pink",   "warm pink",    "pink body instead of yellow, keep black stripes"),
    ("purple", "soft lavender purple", "lavender-purple body instead of yellow, keep black stripes"),
]


def load_key() -> str:
    k = os.environ.get("GEMINI_API_KEY")
    if k: return k.strip()
    return API_FILE.read_text(encoding="utf-8").strip()


def build_requests() -> tuple[list[dict], list[str]]:
    reqs = []
    ids: list[str] = []
    ref_dir = ROOT / "public" / "stickers"
    for stage_key, _stage_name, stage_desc in STAGES:
        ref_path = ref_dir / f"{stage_key}.png"
        if not ref_path.exists():
            raise FileNotFoundError(ref_path)
        b64 = base64.b64encode(ref_path.read_bytes()).decode("ascii")
        for skin_id, _skin_name, skin_instr in SKINS:
            prompt = (
                f"Recolor this illustration. Keep the SAME character ({stage_desc}), "
                "the SAME pose, the SAME composition, the SAME black outline, the SAME accessories, "
                "the SAME style, the SAME size, the SAME background (transparent white). "
                f"Only change the body color: {skin_instr}. "
                "Do not add or remove any elements. No text, no letters, no numbers."
            )
            reqs.append({
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/png", "data": b64}},
                    ],
                }],
                "config": {"response_modalities": ["IMAGE"]},
            })
            ids.append(f"{stage_key}-{skin_id}")
    return reqs, ids


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
    reqs, ids = build_requests()
    print(f"📦 skin recolor batch: {len(reqs)} 건 (5 stages × 5 skins)")
    job = client.batches.create(
        model=MODEL, src=reqs,
        config={"display_name": f"skins-{int(time.time())}"},
    )
    STATE.write_text(json.dumps({"name": job.name, "ids": ids}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📝 job={job.name}")


def _status():
    client = genai.Client(api_key=load_key())
    st = json.loads(STATE.read_text(encoding="utf-8"))
    return client, client.batches.get(name=st["name"]), st


def status():
    _, job, _ = _status()
    s = getattr(job, "state", None)
    print(f"state={getattr(s, 'name', None) or s}")
    return job


def collect():
    _, job, st = _status()
    dest = getattr(job, "dest", None)
    inlined = getattr(dest, "inlined_responses", None) if dest else None
    if not inlined:
        print("⚠️  no results"); return
    ok = 0; fail = []
    for i, holder in enumerate(inlined):
        sid = st["ids"][i]
        out = OUT / f"{sid}.png"
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
        for f in fail: print(f"   · {f}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "submit"
    if cmd == "submit": submit()
    elif cmd == "status": status()
    elif cmd == "collect": collect()
