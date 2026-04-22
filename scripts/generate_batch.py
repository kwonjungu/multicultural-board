"""
Batch-mode image generator via Gemini 2.5 Flash Image.
50% cheaper than real-time; async (24h SLA, usually minutes).

Usage:
    python scripts/generate_batch.py submit           # create batch job
    python scripts/generate_batch.py status           # poll current job
    python scripts/generate_batch.py collect          # download when done
    python scripts/generate_batch.py run              # submit → poll → collect (blocking)
    python scripts/generate_batch.py run landmarks    # subset only

Job id is persisted to `scripts/.batch_job.json`.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError as e:
    raise SystemExit("❌ `pip install --upgrade google-genai` 먼저.") from e

# Reuse the plan + prompt helpers from generate_all.py
from generate_all import PLAN, BASE_STYLE, make_prompt, load_api_key, save_image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output_cards"
OUT.mkdir(exist_ok=True)
STATE_FILE = Path(__file__).resolve().parent / ".batch_job.json"

MODEL = "gemini-2.5-flash-image"


def build_requests(plan_subset):
    reqs = []
    for rel, subject, details in plan_subset:
        prompt = make_prompt(subject, details)
        reqs.append({
            "contents": [{"parts": [{"text": prompt}]}],
            "config": {"response_modalities": ["IMAGE"]},
        })
    return reqs


def filter_plan(group: str | None):
    if not group:
        # skip ones that already exist
        return [(rel, s, d) for rel, s, d in PLAN if not (OUT / rel).exists()]
    return [(rel, s, d) for rel, s, d in PLAN if rel.startswith(group + "/") and not (OUT / rel).exists()]


def submit(group: str | None):
    client = genai.Client(api_key=load_api_key())
    plan = filter_plan(group)
    if not plan:
        print("✅ 아무것도 생성할 게 없음(모두 이미 존재).")
        return
    print(f"📦 submitting batch: {len(plan)} 건  group={group or 'ALL'}")

    reqs = build_requests(plan)
    job = client.batches.create(
        model=MODEL,
        src=reqs,
        config={"display_name": f"multiculture-assets-{int(time.time())}"},
    )
    state = {
        "name": job.name,
        "display_name": getattr(job, "display_name", None),
        "plan": [rel for rel, _, _ in plan],
        "submitted_at": int(time.time()),
        "group": group,
    }
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📝 job id: {job.name}")
    print(f"📁 state → {STATE_FILE}")


def status():
    if not STATE_FILE.exists():
        raise SystemExit("❌ 진행 중 배치 없음. submit 먼저.")
    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    client = genai.Client(api_key=load_api_key())
    job = client.batches.get(name=state["name"])
    s = getattr(job, "state", None)
    name = getattr(s, "name", None) if s is not None else None
    print(f"job={state['name']}")
    print(f"state={name or s}")
    # 일부 SDK 버전은 count 필드 제공
    for attr in ("model", "display_name", "create_time", "end_time"):
        v = getattr(job, attr, None)
        if v:
            print(f"{attr}={v}")
    return job


def save_response_image(resp_obj, out_path: Path) -> bool:
    # Response shape from batch inlined responses:
    # resp_obj might be a dict or a types.GenerateContentResponse-like.
    # Try both shapes.
    candidates = None
    if hasattr(resp_obj, "candidates"):
        candidates = resp_obj.candidates
    elif isinstance(resp_obj, dict):
        candidates = resp_obj.get("candidates")
    for cand in candidates or []:
        content = getattr(cand, "content", None)
        if content is None and isinstance(cand, dict):
            content = cand.get("content")
        if not content:
            continue
        parts = getattr(content, "parts", None)
        if parts is None and isinstance(content, dict):
            parts = content.get("parts")
        for part in parts or []:
            inline = getattr(part, "inline_data", None)
            if inline is None and isinstance(part, dict):
                inline = part.get("inlineData") or part.get("inline_data")
            if not inline:
                continue
            data = getattr(inline, "data", None)
            if data is None and isinstance(inline, dict):
                data = inline.get("data")
            if not data:
                continue
            # base64 string vs raw bytes
            if isinstance(data, str):
                import base64
                data = base64.b64decode(data)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(data)
            return True
    return False


def collect():
    if not STATE_FILE.exists():
        raise SystemExit("❌ 진행 중 배치 없음.")
    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    client = genai.Client(api_key=load_api_key())
    job = client.batches.get(name=state["name"])

    dest = getattr(job, "dest", None)
    inlined = None
    if dest is not None:
        inlined = getattr(dest, "inlined_responses", None)
    if not inlined:
        print(f"⚠️  결과 비어있음 — state={getattr(getattr(job, 'state', None), 'name', None)}")
        return

    plan_rels = state["plan"]
    ok = 0
    failed = []
    for i, resp_holder in enumerate(inlined):
        rel = plan_rels[i] if i < len(plan_rels) else f"unknown_{i}.png"
        out_path = OUT / rel
        resp = getattr(resp_holder, "response", None) or resp_holder
        if save_response_image(resp, out_path):
            print(f"  ✅ {rel}  ({out_path.stat().st_size // 1024}KB)")
            ok += 1
        else:
            err = getattr(resp_holder, "error", None)
            print(f"  ❌ {rel}  err={err}")
            failed.append(rel)
    print(f"\n{'='*60}")
    print(f"✅ 저장: {ok}   ❌ 실패: {len(failed)}")
    if failed:
        for f in failed:
            print(f"   · {f}")


def run(group: str | None):
    submit(group)
    print("\n⏳ 폴링(최대 30분)...")
    for i in range(60):
        time.sleep(30)
        job = status()
        s = getattr(job, "state", None)
        name = getattr(s, "name", None) if s is not None else None
        if name in ("JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"):
            print(f"\n🏁 terminal={name}")
            break
        print(f"   [{i+1:2d}] still running...")
    collect()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    group = sys.argv[2] if len(sys.argv) > 2 else None
    if cmd == "submit":
        submit(group)
    elif cmd == "status":
        status()
    elif cmd == "collect":
        collect()
    elif cmd == "run":
        run(group)
    else:
        print(f"unknown cmd: {cmd}")
        sys.exit(2)
