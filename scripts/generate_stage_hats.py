"""
Stage × Hat 자연 합성 배치.
각 스테이지 이미지를 레퍼런스로 삼아 "머리 위에 모자를 실제로 쓰고 있는" 합성본을
생성. 기존의 단순 <img> overlay 방식이 부자연스러운 문제 해결.

Outputs:
  public/stickers/stage-hats/stage-{n}-{name}-{hat}.png   (20장)
  public/stickers/hat-party.png                           (1장, CosmeticPicker 타일용)
"""
from __future__ import annotations

import base64, json, os, sys, time
from pathlib import Path

from google import genai

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUT = ROOT / "output_cards"
STATE = Path(__file__).resolve().parent / ".stage_hats_job.json"
MODEL = "gemini-2.5-flash-image"

STAGES = [
    ("stage-1-egg",   "egg-shaped baby bee"),
    ("stage-2-larva", "chubby larva bee"),
    ("stage-3-pupa",  "pupa-stage bee with small cocoon"),
    ("stage-4-bee",   "standing adult bee"),
    ("stage-5-queen", "queen bee (already wears a tiny crown — place the new hat tastefully on top or in place)"),
]

HATS = [
    ("top",   "a classic black top hat with a thin dark band"),
    ("cap",   "a red baseball cap with a white visor, curved brim facing slightly to one side"),
    ("party", "a colorful cone-shaped party hat with yellow-pink stripes and a small pompom on top"),
    ("crown", "a small shiny gold crown with 3 points and tiny round gems"),
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


def build_requests():
    ref_dir = ROOT / "public" / "stickers"
    reqs = []
    paths = []

    # 1) hat-party icon (standalone — tile preview)
    reqs.append({
        "contents": [{"parts": [{"text": (
            "A single cute sticker icon on pure white background. Flat vector, thick black outline, "
            "kawaii style. Subject: a colorful cone-shaped party hat with yellow-pink stripes and a "
            "small pompom on top. No text, no letters, centered."
        )}]}],
        "config": {"response_modalities": ["IMAGE"]},
    })
    paths.append("stickers/hat-party.png")

    # 2) stage × hat 20 combos (image-to-image edit)
    for stage_key, stage_desc in STAGES:
        ref_path = ref_dir / f"{stage_key}.png"
        if not ref_path.exists():
            raise FileNotFoundError(ref_path)
        b64 = base64.b64encode(ref_path.read_bytes()).decode("ascii")
        for hat_id, hat_desc in HATS:
            prompt = (
                f"Take this {stage_desc} illustration and add {hat_desc} naturally on top of its head. "
                "The hat must look REALISTICALLY WORN — sitting snugly on the head with correct perspective, "
                "slight shadow contact where it meets the head, NOT floating above. "
                "Keep everything else 100% identical: same pose, same outline, same body color, same wings, "
                "same accessories, same eyes, same background (transparent white). "
                "Do not add or remove any other element. No text, no letters."
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
            paths.append(f"stickers/stage-hats/{stage_key}-{hat_id}.png")

    return reqs, paths


def submit():
    client = genai.Client(api_key=load_key())
    reqs, paths = build_requests()
    print(f"📦 stage-hat composite batch: {len(reqs)} 건")
    job = client.batches.create(model=MODEL, src=reqs, config={"display_name": f"stage-hats-{int(time.time())}"})
    STATE.write_text(json.dumps({"name": job.name, "paths": paths}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📝 job={job.name}")


def _state_info():
    client = genai.Client(api_key=load_key())
    st = json.loads(STATE.read_text(encoding="utf-8"))
    return client, client.batches.get(name=st["name"]), st


def status():
    _, job, _ = _state_info()
    s = getattr(job, "state", None)
    print(f"state={getattr(s, 'name', None) or s}")


def collect():
    _, job, st = _state_info()
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
