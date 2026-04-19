"""Sanity check: which image-capable models does our API key have access to."""
import os
from pathlib import Path

from google import genai

ROOT = Path(__file__).resolve().parent.parent
key = os.environ.get("GEMINI_API_KEY") or (ROOT / "api.txt").read_text(encoding="utf-8").strip()
client = genai.Client(api_key=key)

print("Models with any generative/image capability:")
for m in client.models.list():
    methods = getattr(m, "supported_actions", None) or getattr(m, "supported_generation_methods", None) or []
    name = m.name
    # focus on image-ish / batch-ish ones
    lname = name.lower()
    if any(k in lname for k in ("image", "imagen", "flash-image", "banana")):
        print(f"  ✓ {name}  methods={methods}")

print("\n\nAll models (name only):")
for m in client.models.list():
    print(f"  · {m.name}")
