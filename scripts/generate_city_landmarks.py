"""
Marble 도시별 개별 랜드마크 이미지.
같은 국가 여러 도시는 각각 고유 이미지 필요:
- US: 자유의 여신상 / 그랜드 캐니언 / 골든게이트 브릿지
- RU: 붉은 광장 / 상트페테르부르크
- PH: 마닐라 / 세부
- ID: 발리 / 자카르타
- MN: 울란바토르 초원 / 몽골 초원 하이킹
- + Story symbols 12 (journey/star/door/letter/secret/gift/music/dream/rain/bridge/heart/question)
출력: public/cities/{slug}.png, public/story/{key}.png
"""
from __future__ import annotations
import base64, json, os, sys, time
from pathlib import Path
from google import genai

ROOT = Path(__file__).resolve().parent.parent
API_FILE = ROOT / "api.txt"
OUT = ROOT / "output_cards"
STATE = Path(__file__).resolve().parent / ".city_job.json"
MODEL = "gemini-2.5-flash-image"

STYLE = (
    "Flat vector illustration, kawaii cute style, thick 4px black outline, "
    "warm palette, centered single subject, pure white background, "
    "no text no letters no numbers, crisp square. Children's book tone."
)

PLAN: list[tuple[str, str]] = [
    # 도시별 US (3)
    ("cities/usa-liberty.png",     "the Statue of Liberty on Liberty Island, torch raised, seven-point crown, green patina, simple iconic silhouette."),
    ("cities/usa-grand-canyon.png","the Grand Canyon landscape, orange-red layered rock cliffs, winding river at bottom, warm sunset sky."),
    ("cities/usa-golden-gate.png", "the Golden Gate Bridge, iconic red-orange suspension bridge, two tall towers with cables, blue bay water, one small cloud."),
    # RU (2)
    ("cities/ru-red-square.png",   "Saint Basil's Cathedral in Red Square, colorful onion domes striped red-white-green-blue-gold, iconic Moscow landmark."),
    ("cities/ru-petersburg.png",   "Saint Petersburg Winter Palace facade in soft mint-green with white columns and gold trim, simplified illustration."),
    # PH (2)
    ("cities/ph-manila.png",       "Manila Baywalk sunset, palm tree silhouettes on left, orange sun over calm water, sailboat speck."),
    ("cities/ph-cebu.png",         "Cebu Magellan's Cross pavilion, wooden cross inside small Filipino pavilion with red-tile roof, simplified."),
    # ID (2)
    ("cities/id-bali.png",         "Bali Tanah Lot sea temple silhouette on a rock island at sunset, multi-tiered thatched meru roof, waves around."),
    ("cities/id-jakarta.png",      "Jakarta National Monument (Monas), tall white obelisk with golden flame top, small plaza base."),
    # MN (2)
    ("cities/mn-ulaanbaatar.png",  "Ulaanbaatar ger (yurt) camp on green steppe, 3 round white gers in a row, blue sky, distant rolling hills."),
    ("cities/mn-steppe.png",       "Mongolian steppe horse rider, single rider silhouette on a brown horse, vast green grassland, tiny eagle in sky."),

    # Story 신규 12 (추상/명확)
    ("story/journey.png",  "A small backpack and a wide open road winding to horizon, tiny compass rose in corner."),
    ("story/star.png",     "A single bright yellow 5-point star with soft glow rays and a tiny sparkle nearby."),
    ("story/door.png",     "A single wooden arched door slightly ajar with a warm golden light spilling out, small round knob."),
    ("story/letter.png",   "A single cream envelope with a red wax heart seal, tiny flower stamp in upper-right corner."),
    ("story/secret.png",   "A cute small bee whispering with a finger on its lips, a pink swirl cloud 'shh' around, no text."),
    ("story/gift.png",     "A wrapped gift box in pink paper with a big red ribbon and bow on top, small sparkles around."),
    ("story/music.png",    "A single musical note (quarter note) in gold with 3 tiny colorful notes floating around."),
    ("story/dream.png",    "A fluffy cloud with tiny stars inside and a soft crescent moon peeking, pastel purple sky behind."),
    ("story/rain.png",     "A single blue umbrella with 5 raindrops falling, a tiny puddle below."),
    ("story/bridge.png",   "A small arched stone bridge crossing a brook, small flowers on either side, calm scene."),
    ("story/heart.png",    "A single pink heart with a soft highlight and two tiny hearts orbiting."),
    ("story/question.png", "A large golden question mark with small sparkles, tilted playfully, kawaii round terminals."),
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
            "contents": [{"parts": [{"text": f"{STYLE} Subject: {prompt}"}]}],
            "config": {"response_modalities": ["IMAGE"]},
        })
    job = client.batches.create(model=MODEL, src=reqs, config={"display_name": f"cities-story-{int(time.time())}"})
    STATE.write_text(json.dumps({"name": job.name, "paths": [p for p, _ in PLAN]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📦 city+story batch: {len(reqs)} 건")
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
