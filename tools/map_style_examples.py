#!/usr/bin/env python3
"""World map style-guide examples (#99): one image per rule in docs/art/world-map-rules/.

Reads MAP_PALETTE from src/art/palette.js so the swatches are the real colours.
Run: python3 -I tools/map_style_examples.py   (needs Pillow)
"""
import json, math, os, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'art', 'world-map-rules')
os.makedirs(OUT, exist_ok=True)

src = open(os.path.join(ROOT, 'src', 'art', 'palette.js'), encoding='utf8').read()
block = src[src.index('export const MAP_PALETTE'):src.index('export const MAP_COLOURS')]
PAL = {}
for name, body in re.findall(r"(\w+): Object\.freeze\(\[([^\]]*)\]\)", block):
    PAL[name] = re.findall(r"'(#[0-9a-f]{6})'", body)
PAL['outline'] = re.search(r"outline: '(#[0-9a-f]{6})'", block).group(1)
K = PAL['outline']
BONE, PANEL = '#f2e6c9', '#14110f'
OVER = {'uneasy': '#f5c542', 'edge': '#ff9f1c', 'tipping': '#ff5a4f'}
font = ImageFont.load_default()

def hx(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def canvas(w, h, fill):
    return Image.new('RGB', (w, h), hx(fill))

def zoom(img, s): return img.resize((img.width * s, img.height * s), Image.NEAREST)

def panel(items, title, scale=8, pad=12):
    """items: [(caption, image)] -> one strip with captions, zoomed."""
    imgs = [(c, zoom(i, scale)) for c, i in items]
    w = sum(i.width for _, i in imgs) + pad * (len(imgs) + 1)
    h = max(i.height for _, i in imgs) + 44
    out = Image.new('RGB', (w, h), hx(PANEL))
    d = ImageDraw.Draw(out)
    d.text((pad, 6), title, fill=hx(BONE), font=font)
    x = pad
    for cap, i in imgs:
        out.paste(i, (x, 24))
        d.text((x, 28 + i.height), cap, fill=hx('#a8977a'), font=font)
        x += i.width + pad
    return out

# A deterministic "land" mask: an organic blob for coast examples.
def blob(w, h, cx, cy, r, wobble=0.35, seed=1):
    m = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            a = math.atan2(y - cy, x - cx)
            rr = r * (1 + wobble * (math.sin(3 * a + seed) * 0.6 + math.sin(7 * a + 2 * seed) * 0.4))
            m[y][x] = (x - cx) ** 2 + ((y - cy) * 1.2) ** 2 <= rr * rr
    return m

def coast_pixels(m):
    h, w = len(m), len(m[0])
    out = []
    for y in range(h):
        for x in range(w):
            if not m[y][x]: continue
            if any(not (0 <= x + dx < w and 0 <= y + dy < h) or not m[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out.append((x, y))
    return out

def paint_land(img, m, ramp, core_r=None):
    """Nested blobs: dark core inside, lighter toward the coast."""
    h, w = len(m), len(m[0])
    cs = coast_pixels(m)
    for y in range(h):
        for x in range(w):
            if not m[y][x]: continue
            dist = min(abs(x - cx) + abs(y - cy) for cx, cy in cs) if cs else 0
            i = min(len(ramp) - 1, max(0, len(ramp) - 1 - dist // 3))
            img.putpixel((x, y), hx(ramp[i]))

def shelf(img, m, width=3):
    h, w = len(m), len(m[0])
    for y in range(h):
        for x in range(w):
            if m[y][x]: continue
            near = any(0 <= x + dx < w and 0 <= y + dy < h and m[y + dy][x + dx] for dx in range(-width, width + 1) for dy in range(-width, width + 1) if abs(dx) + abs(dy) <= width)
            if near: img.putpixel((x, y), hx(PAL['ocean'][2]))

def outline(img, m, gaps=0.0, seed=3):
    for i, (x, y) in enumerate(coast_pixels(m)):
        if gaps and ((x * 7 + y * 13 + seed) % 100) < gaps * 100: continue
        img.putpixel((x, y), hx(K))

W, H = 36, 26
M = blob(W, H, 18, 13, 9)

# 1. Palette
def palette_sheet():
    rows = [(k, v) for k, v in PAL.items() if k != 'outline'] + [('outline (= K)', [K])]
    sw = 22
    out = Image.new('RGB', (360, 24 + len(rows) * (sw + 6)), hx(PANEL))
    d = ImageDraw.Draw(out)
    d.text((8, 6), f'World map palette: {len({c for _, v in rows for c in v})} colours, dark -> light', fill=hx(BONE), font=font)
    for r, (name, cols) in enumerate(rows):
        y = 24 + r * (sw + 6)
        d.text((8, y + 6), name, fill=hx('#a8977a'), font=font)
        for i, c in enumerate(cols):
            d.rectangle([110 + i * (sw + 4), y, 110 + i * (sw + 4) + sw, y + sw], fill=hx(c))
            d.text((110 + i * (sw + 4), y + sw - 9), '', fill=hx(BONE), font=font)
    out.save(os.path.join(OUT, '01-palette.png'))

# 2. Outline
def outline_sheet():
    def make(g):
        i = canvas(W, H, PAL['ocean'][1]); shelf(i, M); paint_land(i, M, PAL['forest'])
        if g is not None: outline(i, M, g)
        return i
    panel([('NO: no outline', make(None)), ('NO: traced 100%', make(0)), ('YES: 1px K, ~25% gaps', make(0.25))],
          'Rule 2: coast outline is 1px K on the land side, broken about a quarter of the way').save(os.path.join(OUT, '02-outline.png'))

# 3. Light from the top-left (mountain ridges only)
def light_sheet():
    def ridge(lit):
        i = canvas(20, 14, PAL['desert'][3])
        for x in range(2, 18):
            top = 3 + abs(x - 10) // 2
            for y in range(top, 12):
                i.putpixel((x, y), hx(PAL['rock'][1] if y < 9 else PAL['desert'][1]))
            if lit and x <= 10: i.putpixel((x, top), hx(PAL['rock'][2]))  # sunlit left slope
            if lit and x > 10: i.putpixel((x, top), hx(PAL['rock'][0]))  # shadowed right slope
        return i
    panel([('NO: flat', ridge(False)), ('YES: lit left / shadow right', ridge(True))],
          'Rule 3: light from the top-left, 1px, on ridges only').save(os.path.join(OUT, '03-light.png'))

# 4. Texture: clusters, not dither, not repeated tiles
def texture_sheet():
    w, h = 24, 16
    clusters = canvas(w, h, PAL['forest'][2])
    for (cx, cy, r, c) in [(6, 5, 3, 0), (15, 9, 4, 1), (20, 3, 2, 0), (5, 12, 2, 3), (12, 2, 2, 3)]:
        for y in range(h):
            for x in range(w):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: clusters.putpixel((x, y), hx(PAL['forest'][c]))
    dither = canvas(w, h, PAL['forest'][2])
    for y in range(h):
        for x in range(w):
            if (x + y) % 2 == 0: dither.putpixel((x, y), hx(PAL['forest'][1]))
    tiles = canvas(w, h, PAL['forest'][2])
    for ty in range(0, h, 8):
        for tx in range(0, w, 8):
            for (x, y) in [(2, 2), (5, 5), (3, 6)]: tiles.putpixel((tx + x, ty + y), hx(PAL['meadow'][0]))
    panel([('YES: clusters of 3+ px', clusters), ('NO: checker dither', dither), ('NO: repeating 8px tile', tiles)],
          'Rule 4: terrain texture is clusters; dithering is reserved for crisis overlays').save(os.path.join(OUT, '04-texture.png'))

# 5. Ocean: flat deep, shelf 2-4px, wider off big coasts
def ocean_sheet():
    def make(width, waves):
        i = canvas(W, H, PAL['ocean'][1]); shelf(i, M, width); paint_land(i, M, PAL['forest']); outline(i, M, 0.25)
        if waves:
            for y in range(1, H, 4):
                for x in range((y * 3) % 6, W, 6):
                    if i.getpixel((x, y)) == hx(PAL['ocean'][1]): i.putpixel((x, y), hx(PAL['ocean'][2]))
        return i
    panel([('YES: flat deep + 3px shelf', make(3, False)), ('NO: tiled wave ticks', make(3, True)), ('NO: no shelf', make(0, False))],
          'Rule 5: deep ocean is flat; a 2-4px shelf hugs every coast (6-10px off big landmasses)').save(os.path.join(OUT, '05-ocean.png'))

# 6. Biome ramps: nested blobs
def biome_sheet():
    def make(ramp):
        i = canvas(W, H, PAL['ocean'][1]); shelf(i, M); paint_land(i, M, ramp); outline(i, M, 0.25); return i
    panel([('forest (dark core)', make(PAL['forest'])), ('desert (rust ridge -> sand)', make(PAL['desert'])), ('snow cap (bright cap, shadowed edge)', make(list(reversed(PAL['snow']))))],
          'Rule 6: biomes are nested blobs, 3+ tones each, darkest inland').save(os.path.join(OUT, '06-biomes.png'))

# 7. Readability: overlays on the new land, beside a shelter tile at the same scale
def readability_sheet():
    base = canvas(W, H, PAL['ocean'][1]); shelf(base, M); paint_land(base, M, PAL['forest']); outline(base, M, 0.25)
    items = [('calm', base.copy())]
    pats = {'uneasy': [(0, 1), (4, 1), (2, 5), (6, 5)], 'edge': [(x, y) for y in range(0, 8, 2) for x in range((y // 2) % 2, 8, 2)], 'tipping': [(x, y) for y in range(8) for x in range(8) if (x + y) % 3 == 0]}
    for name, pts in pats.items():
        i = base.copy()
        for ty in range(0, H, 8):
            for tx in range(0, W, 8):
                for (x, y) in pts:
                    X, Y = tx + x, ty + y
                    if X < W and Y < H and M[Y][X]: i.putpixel((X, Y), hx(OVER[name]))
        items.append((name, i))
    shelter = os.path.join(ROOT, 'assets', 'art', 'shelter-tiles.png')
    if os.path.exists(shelter):
        st = Image.open(shelter).convert('RGB')
        items.append(('shelter tile, same scale', st.crop((0, 0, min(st.width, 48), min(st.height, 16)))))
    panel(items, 'Rule 7: overlays stay readable on the new land; the map stays cooler and calmer than the warm bunker', scale=6).save(os.path.join(OUT, '07-readability.png'))

for f in (palette_sheet, outline_sheet, light_sheet, texture_sheet, ocean_sheet, biome_sheet, readability_sheet):
    f()
print('wrote', sorted(os.listdir(OUT)))
