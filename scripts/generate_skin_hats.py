"""
P1: Skin × Stage × Hat 합성 — 5 skins × 5 stages × 4 hats = 100장.
각 skin 재채색본을 레퍼런스로 주고 머리 위에 모자 자연 합성.
출력: public/stickers/skin-hats/{stage}-{skin}-{hat}.png

자동 폴링 + 수집 + 이동 + 커밋 + 푸시까지 한 스크립트.
"""
from __future__ import annotations
import base64, json, os, subprocess, sys, time
from pathlib import Path
from google import genai

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUT = ROOT / "output_cards"
STATE = Path(__file__).resolve().parent / ".skin_hats_job.json"
MODEL = "gemini-2.5-flash-image"

STAGES = [
    ("stage-1-egg", "egg-shaped baby bee"),
    ("stage-2-larva", "chubby larva bee"),
    ("stage-3-pupa", "pupa-stage bee with small cocoon"),
    ("stage-4-bee", "standing adult bee"),
    ("stage-5-queen", "queen bee with tiny crown"),
]
SKINS = ["orange", "green", "sky", "pink", "purple"]
HATS = [
    ("top", "a classic black top hat with a thin dark band"),
    ("cap", "a red baseball cap with a white visor"),
    ("party", "a colorful cone-shaped party hat with stripes and a pompom on top"),
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
            if isinstance(data, str): data = base64.b64decode(data)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(data)
            return True
    return False


def submit():
    client = genai.Client(api_key=load_key())
    ref_dir = ROOT / "public" / "stickers" / "skins"
    reqs = []
    paths = []
    for stage_key, stage_desc in STAGES:
        for skin in SKINS:
            ref = ref_dir / f"{stage_key}-{skin}.png"
            if not ref.exists():
                print(f"⚠ skip missing ref: {ref}")
                continue
            b64 = base64.b64encode(ref.read_bytes()).decode("ascii")
            for hat_id, hat_desc in HATS:
                prompt = (
                    f"Take this {stage_desc} illustration and add {hat_desc} naturally "
                    "on top of its head. The hat must look REALISTICALLY WORN with correct "
                    "perspective and a slight shadow contact, not floating. Keep everything "
                    "else IDENTICAL: same pose, same outline, same body color, same wings, "
                    "same accessories, same transparent background. No text, no letters."
                )
                reqs.append({
                    "contents": [{"parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/png", "data": b64}},
                    ]}],
                    "config": {"response_modalities": ["IMAGE"]},
                })
                paths.append(f"stickers/skin-hats/{stage_key}-{skin}-{hat_id}.png")
    job = client.batches.create(model=MODEL, src=reqs, config={"display_name": f"skin-hats-{int(time.time())}"})
    STATE.write_text(json.dumps({"name": job.name, "paths": paths}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📦 skin-hats batch: {len(reqs)} 건")
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
        print("⚠ no results"); return 0
    ok = 0
    for i, holder in enumerate(inlined):
        rel = st["paths"][i]
        out = OUT / rel
        resp = getattr(holder, "response", None) or holder
        if save_image(resp, out):
            ok += 1
    print(f"✅ {ok} / {len(inlined)}")
    return ok


def auto():
    """polling + collect + move + commit + push — fully autonomous."""
    submit()
    for _ in range(120):
        time.sleep(30)
        _, job, _ = _get()
        s = getattr(getattr(job, "state", None), "name", None)
        print(f"  state={s}", flush=True)
        if s == "JOB_STATE_SUCCEEDED":
            collect()
            # move to public
            src = OUT / "stickers" / "skin-hats"
            dst = ROOT / "public" / "stickers" / "skin-hats"
            dst.mkdir(parents=True, exist_ok=True)
            for f in src.glob("*.png"):
                (dst / f.name).write_bytes(f.read_bytes())
            # git
            subprocess.run(["git", "add", "-A"], cwd=ROOT)
            subprocess.run([
                "git", "commit", "-m",
                "🎩 Skin×Stage×Hat 100장 자연 합성 (P1) — 배치 자동 수집",
            ], cwd=ROOT)
            subprocess.run(["git", "push", "origin", "claude/add-communication-games-oQvl4"], cwd=ROOT)
            return
        if s in ("JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"):
            print(f"terminal: {s}"); return


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "auto"
    if cmd == "submit": submit()
    elif cmd == "status": status()
    elif cmd == "collect": collect()
    elif cmd == "auto": auto()
