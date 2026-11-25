#!/usr/bin/env python3
"""World map fidelity metrics and target-sheet images (#112).

Measures the reference ("pixel earth", drawn at 2x) and our base layer with the same numbers, so the target sheet
(docs/art/world-map-target.md) states targets we can check, not impressions.

  node tools/export-map-base.mjs --scale 1.5 /tmp/ours-1.5.png      (the terrain the game paints at 1440x900)
  python3 -I tools/map_target_metrics.py <reference.png> <ours-1.5.png> [outDir=docs/art/world-map-target]

All numbers are in ART pixels (the reference is halved first: it is drawn at 2 screen px per art px, as ours is).
"""
import json, math, os, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ref_path, ours_path = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, 'docs', 'art', 'world-map-target')
os.makedirs(OUT, exist_ok=True)
font = ImageFont.load_default()
BG, INK, DIM = (20, 17, 15), (242, 230, 201), (168, 151, 122)


def kind(c):
    r, g, b = c
    if r < 45 and g < 45 and b < 45: return 'outline'
    if r > 145 and g > 150 and b > 160 and abs(r - g) < 25: return 'snow'  # white caps and their blue-grey rims
    if b > r + 30 and b > g + 10: return 'sea'
    return 'land'


def metrics(im):
    w, h = im.size
    p = im.load()
    k = [[kind(p[x, y]) for x in range(w)] for y in range(h)]
    # sea = blue water connected to the open ocean (rivers and lakes count as land)
    sea = [[False] * w for _ in range(h)]
    # 1px blue lines (rivers) are not open water: a sea pixel needs 5+ sea pixels in its 3x3
    open_ = [[k[y][x] == 'sea' and sum(k[Y][X] == 'sea' for Y in range(max(0, y - 1), min(h, y + 2)) for X in range(max(0, x - 1), min(w, x + 2))) >= 5 for x in range(w)] for y in range(h)]
    q = deque((x, y) for y in range(h) for x in range(w) if (x in (0, w - 1) or y in (0, h - 1)) and open_[y][x])
    for x, y in q: sea[y][x] = True
    while q:
        a, b = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            X, Y = a + dx, b + dy
            if 0 <= X < w and 0 <= Y < h and not sea[Y][X] and open_[Y][X]: sea[Y][X] = True; q.append((X, Y))
    is_land = [[not sea[y][x] and k[y][x] != 'snow' for x in range(w)] for y in range(h)]
    pairs = changes = lp = lc = 0
    for y in range(h - 1):
        for x in range(w - 1):
            for X, Y in ((x + 1, y), (x, y + 1)):
                d = p[x, y] != p[X, Y]
                pairs += 1; changes += d
                if k[y][x] == 'land' and k[Y][X] == 'land': lp += 1; lc += d
    land_px = sum(row.count(True) for row in is_land)
    coast = sum(1 for y in range(1, h - 1) for x in range(1, w - 1) if is_land[y][x] and not all(is_land[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))
    outlined = sum(1 for y in range(1, h - 1) for x in range(1, w - 1) if is_land[y][x] and k[y][x] == 'outline' and not all(is_land[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))
    # land pieces (4-connected), ignoring the polar caps
    seen = [[False] * w for _ in range(h)]
    sizes = []
    for y in range(h):
        for x in range(w):
            if not is_land[y][x] or seen[y][x]: continue
            q = deque([(x, y)]); seen[y][x] = True; n = 0
            while q:
                a, b = q.popleft(); n += 1
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = a + dx, b + dy
                    if 0 <= X < w and 0 <= Y < h and is_land[Y][X] and not seen[Y][X]: seen[Y][X] = True; q.append((X, Y))
            sizes.append(n)
    # mean run of one colour along land rows: smaller = busier painting
    runs = []
    for y in range(h):
        run = 0
        for x in range(w):
            if k[y][x] != 'land':
                if run: runs.append(run)
                run = 0; continue
            if run and p[x, y] == p[x - 1, y]: run += 1
            else:
                if run: runs.append(run)
                run = 1
        if run: runs.append(run)
    colours = len(set(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()))
    return {
        'art_px': [w, h],
        'colours': colours,
        'edges_per_100': round(100 * changes / pairs, 1),
        'land_edges_per_100': round(100 * lc / max(1, lp), 1),
        'land_run_px': round(sum(runs) / max(1, len(runs)), 2),
        'land_share': round(land_px / (w * h), 3),
        'coast_wiggle': round(coast / (2 * math.sqrt(math.pi * land_px)), 2),  # coast length vs one round blob of the same area
        'outlined_coast': round(outlined / max(1, coast), 2),
        'islands': sum(1 for s in sizes if s < 0.002 * w * h),
        'islands_per_10k_px': round(10000 * sum(1 for s in sizes if s < 0.002 * w * h) / (w * h), 2),
    }


ref2 = Image.open(ref_path).convert('RGB')
ref = ref2.resize((ref2.width // 2, ref2.height // 2), Image.NEAREST)
ours = Image.open(ours_path).convert('RGB')
m = {'reference': metrics(ref), 'ours': metrics(ours)}
json.dump(m, open(os.path.join(OUT, 'metrics.json'), 'w'), indent=1)
print(json.dumps(m, indent=1))

x2 = lambda im, s=2: im.resize((im.width * s, im.height * s), Image.NEAREST)


def sheet(items, title, path):
    w = sum(i.width for _, i in items) + 12 * (len(items) + 1)
    h = max(i.height for _, i in items) + 46
    out = Image.new('RGB', (w, h), BG); d = ImageDraw.Draw(out)
    d.text((12, 6), title, fill=INK, font=font)
    x = 12
    for cap, i in items:
        out.paste(i, (x, 24)); d.text((x, 30 + i.height), cap, fill=DIM, font=font); x += i.width + 12
    out.save(path)


# 1. both at 2 screen px per art px: the size and density the game must show at 1440x900
sheet([(f'TARGET BAR: reference, {ref.width}x{ref.height} art px at 2x', ref2), (f'OURS NOW: {ours.width}x{ours.height} art px at 2x (1440x900 in game)', x2(ours))],
      'Same pixel density (2 screen px per art px). Ours must be the bigger map AND at least as busy per pixel.', os.path.join(OUT, '01-side-by-side.png'))
# 2. same-size crops, same density: what "detail per pixel" means
cw, chh = 120, 80
sheet([('reference: Eurasia', x2(ref.crop((118, 22, 118 + cw, 22 + chh)), 4)),
       ('ours: north-east Asia (E.ASIA)', x2(ours.crop((345, 20, 345 + cw, 20 + chh)), 4))],
      f'{cw}x{chh} art px crops, both shown x8: count the colour changes, islands and coast turns', os.path.join(OUT, '02-crop-detail.png'))
sheet([('reference: south-east Asia + Australia', x2(ref.crop((155, 88, 155 + cw, 88 + chh)), 4)),
       ('ours: Oceania + islands', x2(ours.crop((360, 170, 360 + cw, 170 + chh)), 4))],
      'Coasts and islands: the reference breaks land into many pieces; ours still reads as a few big blobs', os.path.join(OUT, '03-crop-coastline.png'))


# 4. edge maps: white where neighbouring pixels differ (where the detail is)
def edges(im):
    w, h = im.size; p = im.load(); e = Image.new('L', (w, h), 0); q = e.load()
    for y in range(h - 1):
        for x in range(w - 1):
            if p[x, y] != p[x + 1, y] or p[x, y] != p[x, y + 1]: q[x, y] = 255
    return e.convert('RGB')
sheet([('reference', x2(edges(ref))), ('ours', x2(edges(ours)))], 'Detail maps: every white pixel is a colour change. The reference is evenly busy across all land.', os.path.join(OUT, '04-detail-maps.png'))


# 5. palettes
def swatches(im, title):
    cols = sorted(set(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()), key=lambda c: (kind(c), sum(c)))
    out = Image.new('RGB', (12 + 22 * len(cols), 52), BG); d = ImageDraw.Draw(out)
    d.text((6, 4), f'{title}: {len(cols)} colours', fill=INK, font=font)
    for i, c in enumerate(cols): d.rectangle([6 + i * 22, 22, 24 + i * 22, 44], fill=c)
    return out
a, b = swatches(ref, 'reference'), swatches(ours, 'ours')
pal = Image.new('RGB', (max(a.width, b.width), a.height + b.height), BG); pal.paste(a, (0, 0)); pal.paste(b, (0, a.height))
pal.save(os.path.join(OUT, '05-palettes.png'))
print('wrote', sorted(os.listdir(OUT)))
