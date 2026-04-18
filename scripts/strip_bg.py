"""Flood-fill white/near-white background to transparent, from image corners.

Preserves white pixels INSIDE the subject (e.g., eyes, wings, teeth) by only
making connected near-white regions reachable from the corners transparent.

Usage: python scripts/strip_bg.py <path1> [<path2> ...]
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image

WHITE_THRESHOLD = 238
FEATHER = 4


def strip_white_bg(path: Path, threshold: int = WHITE_THRESHOLD) -> tuple[bool, str]:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()

    visited = [[False] * h for _ in range(w)]
    q = deque()

    def seed(x, y):
        if 0 <= x < w and 0 <= y < h and not visited[x][y]:
            r, g, b, _ = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                visited[x][y] = True
                q.append((x, y))

    step = max(1, min(w, h) // 64)
    for x in range(0, w, step):
        seed(x, 0); seed(x, h - 1)
    for y in range(0, h, step):
        seed(0, y); seed(w - 1, y)

    initial_seeds = len(q)
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                nr, ng, nb, _ = px[nx, ny]
                if nr >= threshold and ng >= threshold and nb >= threshold:
                    visited[nx][ny] = True
                    q.append((nx, ny))

    # Feather edge: for pixels adjacent to now-transparent area, reduce alpha proportionally
    # (helps anti-aliased outlines blend cleanly)
    near_white = threshold - 12
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r >= near_white and g >= near_white and b >= near_white:
                # check neighbor transparent
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        avg = (r + g + b) / 3
                        new_a = max(0, int((255 - avg) / (255 - near_white) * 255))
                        px[x, y] = (r, g, b, min(a, new_a))
                        break

    im.save(path, format="PNG", optimize=True)
    alpha = im.split()[3]
    lo, hi = alpha.getextrema()
    return lo < 255, f"seeds={initial_seeds} alpha_range=({lo},{hi})"


def main():
    if len(sys.argv) < 2:
        print("usage: strip_bg.py <path> [<path> ...]", file=sys.stderr)
        sys.exit(2)
    ok_count = 0
    for p in sys.argv[1:]:
        path = Path(p)
        if not path.exists():
            print(f"[SKIP] missing: {p}")
            continue
        ok, info = strip_white_bg(path)
        mark = "OK " if ok else "NO "
        print(f"[{mark}] {p}  {info}")
        ok_count += ok
    print(f"\n{ok_count}/{len(sys.argv)-1} now have transparency")


if __name__ == "__main__":
    main()
