"""Gera pacotes de HUD da 1ª/2ª Guerra para o AssaultCube 1.3 (mesmos nomes, tamanhos e layouts dos originais).
Uso: python3 gen.py <saida>
"""
import sys, os, math, random, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hud/out'
SIL = '/tmp/hud/sil'
FONTS = '/tmp/hud/fonts'
rng = np.random.default_rng(7)

def font(name, size): return ImageFont.truetype(os.path.join(FONTS, name), size)

def noise(w, h, scale=8, seed=0):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w))
    amp = 1.0
    for o in range(5):
        s = max(1, int(scale * 2 ** o))
        g = r.random((h // s + 2, w // s + 2))
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w + s * 2, h + s * 2), Image.BICUBIC).crop((s // 2, s // 2, s // 2 + w, s // 2 + h))
        acc += np.asarray(im, float) / 255 * amp; amp *= 0.5
    acc -= acc.min(); acc /= acc.max() + 1e-9
    return acc

def tint(rgb, k):
    return tuple(int(max(0, min(255, c * k))) for c in rgb)

# ------------------------------------------------------------------ material de placa (metal pintado, papel, couro)
def plate(w, h, th, seed=0, kind=None):
    kind = kind or th['plate_kind']
    n = noise(w, h, 6, seed); fine = rng.random((h, w))
    base = np.array(th['plate'], float)
    if kind == 'paper':
        stain = noise(w, h, 24, seed + 3)
        img = base[None, None, :] * (0.86 + 0.18 * n[..., None] + 0.04 * fine[..., None]) - 40 * np.clip(stain - 0.62, 0, 1)[..., None] * np.array([0.6, 0.9, 1.3])
    else:
        img = base[None, None, :] * (0.82 + 0.26 * n[..., None] + 0.06 * fine[..., None])
        chips = noise(w, h, 3, seed + 9) > 0.78
        img[chips] = img[chips] * 0.6 + np.array(th['metal'], float) * 0.4
    return np.clip(img, 0, 255).astype(np.uint8)

def framed_tile(size, th, seed=0, label=None, inner=None):
    """quadro com moldura chanfrada e rebites/costura (como os ícones originais), RGBA"""
    s = size
    im = Image.fromarray(plate(s, s, th, seed)).convert('RGBA')
    d = ImageDraw.Draw(im)
    b = max(4, s // 22)
    hi, lo = tint(th['metal'], 1.35), tint(th['metal'], 0.45)
    for i in range(b):
        d.line([(i, s - 1 - i), (i, i), (s - 1 - i, i)], fill=hi + (255,))
        d.line([(s - 1 - i, i), (s - 1 - i, s - 1 - i), (i, s - 1 - i)], fill=lo + (255,))
    d.rectangle([b, b, s - 1 - b, s - 1 - b], outline=tint(th['plate'], 0.45) + (255,), width=max(1, s // 64))
    if th['plate_kind'] == 'paper':
        for x in range(b + 6, s - b - 6, max(6, s // 18)):          # costura
            for y in (b + 4, s - b - 6):
                d.line([(x, y), (x + max(2, s // 40), y)], fill=tint(th['ink'], 0.9) + (200,), width=max(1, s // 96))
    else:
        r = max(2, s // 36)
        for cx, cy in [(b * 2.2, b * 2.2), (s - b * 2.2, b * 2.2), (b * 2.2, s - b * 2.2), (s - b * 2.2, s - b * 2.2)]:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tint(th['metal'], 0.9) + (255,), outline=lo + (255,))
            d.ellipse([cx - r * 0.6, cy - r * 0.8, cx, cy - r * 0.2], fill=hi + (255,))
    return im

def silhouette(name, box, th, rot=0):
    """silhueta tingida a partir do render do modelo (fundo magenta), com relevo e contorno"""
    src = Image.open(os.path.join(SIL, name + '.png')).convert('RGB')
    a = np.asarray(src, float)
    mask = np.clip((np.abs(a[..., 0] - 255) + a[..., 1] + np.abs(a[..., 2] - 255) - 60) / 60, 0, 1)
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) / 255
    ys, xs = np.where(mask > 0.5)
    if not len(xs): return Image.new('RGBA', (box[0], box[1]))
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    mask, lum = mask[y0:y1, x0:x1], lum[y0:y1, x0:x1]
    ink = np.array(th['icon'], float)
    col = ink[None, None, :] * (0.62 + 0.75 * np.clip(lum * 2.2, 0, 1)[..., None])
    rgba = np.dstack([np.clip(col, 0, 255), mask * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    if rot: im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
    bw, bh = box
    k = min(bw / im.width, bh / im.height)
    im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
    # contorno escuro
    al = im.split()[3]
    out = Image.new('RGBA', (im.width + 8, im.height + 8))
    sh = Image.new('RGBA', out.size, tint(th['shadow'], 1) + (0,))
    grown = Image.new('L', out.size); grown.paste(al, (4, 4)); grown = grown.filter(ImageFilter.MaxFilter(5))
    sh.putalpha(grown.point(lambda v: int(v * 0.85)))
    out.alpha_composite(sh); out.alpha_composite(im, (4, 4))
    return out

def stencil_text(d, xy, text, fnt, fill, shadow, anchor='la'):
    x, y = xy
    d.text((x + 2, y + 2), text, font=fnt, fill=shadow, anchor=anchor)
    d.text((x, y), text, font=fnt, fill=fill, anchor=anchor)

def weathering(im, th, amount=0.25, seed=1):
    """desgaste: falhas na tinta (alpha) e sujeira"""
    a = np.asarray(im, float).copy()
    n = noise(im.width, im.height, 3, seed)
    a[..., 3] *= np.clip(1 - np.clip(n - (1 - amount), 0, 1) * 4, 0.15, 1)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

# ------------------------------------------------------------------ desenhos vetoriais (capacete, cruz, colete)
def helmet_shape(d, cx, cy, s, th, kind):
    col, dark, hi = th['icon'], tint(th['icon'], 0.55), tint(th['icon'], 1.3)
    if kind == 'stahlhelm':
        pts = [(-0.95, 0.35), (-0.78, 0.05), (-0.62, -0.42), (-0.25, -0.72), (0.2, -0.74), (0.58, -0.5), (0.78, -0.1), (0.82, 0.18), (1.0, 0.42), (0.55, 0.4), (0.45, 0.22), (-0.55, 0.22), (-0.62, 0.42)]
    elif kind == 'm1':
        pts = [(-0.95, 0.32), (-0.82, -0.05), (-0.62, -0.45), (-0.25, -0.7), (0.25, -0.7), (0.62, -0.45), (0.82, -0.05), (0.95, 0.32), (0.75, 0.38), (-0.75, 0.38)]
    elif kind == 'ssh40':
        pts = [(-0.92, 0.38), (-0.85, 0.0), (-0.66, -0.45), (-0.28, -0.72), (0.28, -0.72), (0.66, -0.45), (0.85, 0.0), (0.92, 0.38), (0.82, 0.42), (-0.82, 0.42)]
    else:  # brodie
        pts = [(-1.0, 0.25), (-0.6, 0.12), (-0.5, -0.25), (-0.22, -0.5), (0.22, -0.5), (0.5, -0.25), (0.6, 0.12), (1.0, 0.25), (0.92, 0.36), (-0.92, 0.36)]
    P = [(cx + x * s, cy + y * s) for x, y in pts]
    d.polygon([(x + 3, y + 3) for x, y in P], fill=th['shadow'] + (200,))
    d.polygon(P, fill=col + (255,), outline=dark + (255,))
    d.arc([cx - s * 0.6, cy - s * 0.66, cx + s * 0.4, cy + s * 0.1], 200, 260, fill=hi + (255,), width=max(2, int(s * 0.08)))
    if kind == 'ssh40':
        d.ellipse([cx - s * 0.13, cy - s * 0.34, cx + s * 0.13, cy - s * 0.08], fill=th['accent'] + (255,))

def cross(d, cx, cy, s, fill, bg=None, shadow=None):
    if bg:
        d.ellipse([cx - s, cy - s, cx + s, cy + s], fill=bg + (255,), outline=tint(bg, 0.6) + (255,), width=max(2, int(s * 0.08)))
    w = s * 0.32
    for off, c in ([(3, shadow)] if shadow else []) + [(0, fill)]:
        d.rectangle([cx - w + off, cy - s * 0.72 + off, cx + w + off, cy + s * 0.72 + off], fill=c + (255,))
        d.rectangle([cx - s * 0.72 + off, cy - w + off, cx + s * 0.72 + off, cy + w + off], fill=c + (255,))

# ------------------------------------------------------------------ arquivos
def items_png(th):
    S = 512; c = S // 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    lab = font(th['label_font'], int(c * 0.17))
    slots = th['weapons']  # knife, pistol, carbine, shotgun, subgun, sniper, assault, grenade
    for i, (wid, label) in enumerate(slots):
        col, row = (i, 0) if i < 4 else (i - 4, 1)
        t = framed_tile(c, th, seed=i)
        rot = 0
        box = (int(c * 0.82), int(c * 0.55))
        if i == 0: box = (int(c * 0.34), int(c * 0.78)); rot = 0
        if i == 7: box = (int(c * 0.6), int(c * 0.72))
        if i == 1: box = (int(c * 0.72), int(c * 0.55))
        sil = silhouette(wid, box, th, rot)
        t.alpha_composite(sil, ((c - sil.width) // 2, int(c * 0.44 - sil.height / 2)))
        d = ImageDraw.Draw(t)
        stencil_text(d, (c - c * 0.09, c - c * 0.07), label, lab, th['label'] + (255,), th['shadow'] + (255,), anchor='rs')
        im.alpha_composite(weathering(t, th, 0.18, i), (col * c, row * c))
    # coletes / capacetes 25-50-75-100 (linha 2) e capacete (linha 3, col 3)
    for k in range(4):
        t = framed_tile(c, th, seed=20 + k); d = ImageDraw.Draw(t)
        helmet_shape(d, c / 2, c * 0.44, c * 0.36, th, th['helmet'])
        pw = c * 0.1
        for j in range(k + 1):
            x = c / 2 - (k + 1) * pw * 0.65 + j * pw * 1.3
            d.rectangle([x - pw * 0.42, c * 0.74, x + pw * 0.42, c * 0.86], fill=th['accent'] + (255,), outline=th['shadow'] + (255,))
        im.alpha_composite(weathering(t, th, 0.18, 20 + k), (k * c, 2 * c))
    t = framed_tile(c, th, seed=30); d = ImageDraw.Draw(t)
    cross(d, c / 2, c / 2, c * 0.33, th['cross'], bg=th['cross_bg'], shadow=th['shadow'])
    im.alpha_composite(weathering(t, th, 0.15, 30), (2 * c, 3 * c))
    t = framed_tile(c, th, seed=31); d = ImageDraw.Draw(t)
    helmet_shape(d, c / 2, c * 0.5, c * 0.38, th, th['helmet'])
    im.alpha_composite(weathering(t, th, 0.15, 31), (3 * c, 3 * c))
    return im

def huddigits_png(th):
    im = Image.new('RGBA', (500, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = font(th['digit_font'], th.get('digit_size', 58))
    for i in range(10):
        x = 4 + 48 * i + 20
        stencil_text(d, (x, 34), str(i), f, th['digits'] + (255,), th['shadow'] + (230,), anchor='mm')
    stencil_text(d, (488, 34), '/', f, th['digits'] + (255,), th['shadow'] + (230,), anchor='mm')
    return weathering(im, th, 0.22, 5)

def ring(size, r0, r1, th, seed=0):
    n = size; c = (n - 1) / 2
    y, x = np.mgrid[:n, :n]; r = np.hypot(x - c, y - c) / (n / 2)
    base = plate(n, n, th, seed, kind='metal' if th['plate_kind'] == 'paper' else None).astype(float)
    metal = np.array(th['ring'], float)
    t = np.clip((r - r0) / (r1 - r0), 0, 1)
    shade = 0.7 + 0.6 * np.sin(t * math.pi) ** 0.6 - 0.25 * ((y - c) / (n / 2))
    col = metal[None, None, :] * shade[..., None] * (0.85 + 0.3 * noise(n, n, 4, seed)[..., None])
    a = np.clip((r - r0) * n / 2, 0, 1) * np.clip((r1 - r) * n / 2, 0, 1) * 255
    # aro interno e externo escuros
    edge = (np.abs(r - r0) < 0.012) | (np.abs(r - r1) < 0.012)
    col[edge] *= 0.45
    return Image.fromarray(np.dstack([np.clip(col, 0, 255), a]).astype(np.uint8), 'RGBA')

def compass_base_png(th):
    im = ring(256, 0.72, 0.96, th, 11); d = ImageDraw.Draw(im); c = 127.5
    for ang in range(0, 360, 90):                 # quatro marcas
        a = math.radians(ang - 90); r0, r1 = 0.97 * 128, 0.86 * 128
        p = [(c + math.cos(a) * r0 + math.cos(a + 1.57) * 6, c + math.sin(a) * r0 + math.sin(a + 1.57) * 6), (c + math.cos(a) * r1, c + math.sin(a) * r1), (c + math.cos(a) * r0 - math.cos(a + 1.57) * 6, c + math.sin(a) * r0 - math.sin(a + 1.57) * 6)]
        d.polygon(p, fill=th['accent'] + (255,), outline=th['shadow'] + (255,))
    for k in range(12):                           # parafusos
        a = math.radians(k * 30 + 15); rr = 0.84 * 128
        x, y = c + math.cos(a) * rr, c + math.sin(a) * rr
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=tint(th['ring'], 0.6) + (255,))
    return im

def compass_rose_png(th):
    n = 512; im = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = n / 2
    f = font(th['rose_font'], 44)
    col = th['rose'] + (255,)
    for deg in range(0, 360, 5):
        a = math.radians(deg - 90); big = deg % 45 == 0; mid = deg % 15 == 0
        if deg % 90 == 0: continue
        r0 = 0.905 * c; r1 = (0.80 if big else 0.84 if mid else 0.87) * c
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * r1, c + math.sin(a) * r1)], fill=col, width=4 if big else 2)
    for i, L in enumerate(th['cardinals']):
        a = math.radians(i * 90 - 90); r = 0.845 * c
        x, y = c + math.cos(a) * r, c + math.sin(a) * r
        t = Image.new('RGBA', (90, 90)); td = ImageDraw.Draw(t)
        stencil_text(td, (45, 45), L, f, th['rose_n'] + (255,) if i == 0 else col, th['shadow'] + (220,), anchor='mm')
        t = t.rotate(-i * 90, resample=Image.BICUBIC)
        im.alpha_composite(t, (int(x - 45), int(y - 45)))
    return im

def scope_png(th):
    n = 512; c = (n - 1) / 2
    y, x = np.mgrid[:n, :n]; r = np.hypot(x - c, y - c) / (n / 2)
    a = np.clip((r - 0.6) / 0.05, 0, 1) * 255
    vign = np.clip((r - 0.45) / 0.17, 0, 1) ** 2 * 140
    alpha = np.maximum(a, vign)
    rgb = np.zeros((n, n, 3)); rim = (r > 0.6) & (r < 0.68)
    rgb[rim] = np.array(th['scope_rim'], float) * (0.4 + 0.6 * (1 - np.abs(r[rim] - 0.64) / 0.04))[:, None]
    im = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA'); d = ImageDraw.Draw(im)
    R = 0.62 * n / 2; ink = (8, 8, 8, 255); kind = th['reticle']
    if kind == 'zf39':        # Absehen 1: três postes, o de baixo pontudo
        w = 9
        d.rectangle([c - R, c - w / 2, c - 22, c + w / 2], fill=ink); d.rectangle([c + 22, c - w / 2, c + R, c + w / 2], fill=ink)
        d.polygon([(c - w * 0.9, c + R), (c + w * 0.9, c + R), (c + w * 0.9, c + 30), (c, c + 2), (c - w * 0.9, c + 30)], fill=ink)
    elif kind == 'pu':        # PU soviético: poste de baixo pontudo + traços laterais finos
        d.line([(c - R, c), (c - 18, c)], fill=ink, width=4); d.line([(c + 18, c), (c + R, c)], fill=ink, width=4)
        d.polygon([(c - 6, c + R), (c + 6, c + R), (c + 6, c + 26), (c, c + 2), (c - 6, c + 26)], fill=ink)
    elif kind == 'aldis':     # 1ª Guerra: cruz grossa com ponto
        d.line([(c - R, c), (c + R, c)], fill=ink, width=5); d.line([(c, c - R), (c, c + R)], fill=ink, width=5)
        d.ellipse([c - 6, c - 6, c + 6, c + 6], fill=ink)
    else:                     # m73b1: cruz fina
        d.line([(c - R, c), (c + R, c)], fill=ink, width=2); d.line([(c, c - R), (c, c + R)], fill=ink, width=2)
        for k in (-2, -1, 1, 2):
            d.line([(c + k * R / 3, c - 6), (c + k * R / 3, c + 6)], fill=ink, width=2)
    # poeira na lente
    rr = np.random.default_rng(3)
    for _ in range(40):
        px, py = rr.uniform(-R, R, 2)
        if px * px + py * py < (R * 0.95) ** 2:
            s = rr.uniform(0.6, 2.2); d.ellipse([c + px - s, c + py - s, c + px + s, c + py + s], fill=(20, 20, 20, int(rr.uniform(30, 90))))
    return im

def damage_png(th):
    n = 256; c = (n - 1) / 2
    y, x = np.mgrid[:n, :n]; r = np.hypot(x - c, y - c) / (n / 2)
    nn = noise(n, n, 5, 21)
    a = np.clip((r - 0.36) / 0.64, 0, 1) ** 1.25 * 200 * (0.7 + 0.5 * nn)
    col = np.array(th['blood'], float)[None, None, :] * (0.7 + 0.5 * nn[..., None])
    return Image.fromarray(np.dstack([np.clip(col, 0, 255), np.clip(a, 0, 255)]).astype(np.uint8), 'RGBA')

def crosshair_png(th, kind='default'):
    n = 64; im = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = n / 2
    col = th['xhair'] + (255,); sh = (0, 0, 0, 170)
    if kind == 'teammate':
        for o, cc in ((1, sh), (0, (255, 255, 255, 255))):
            d.line([(14 + o, 14 + o), (50 + o, 50 + o)], fill=cc, width=5); d.line([(50 + o, 14 + o), (14 + o, 50 + o)], fill=cc, width=5)
        return im
    if kind == 'dot':
        d.ellipse([c - 4, c - 4, c + 4, c + 4], fill=th['accent'] + (255,), outline=sh); return im
    st = th['xhair_style']
    for o, cc in ((1, sh), (0, col)):
        if st == 'post':     # traços curtos com abertura (estilo alça e massa)
            d.rectangle([c - 2 + o, c + 7 + o, c + 1 + o, c + 24 + o], fill=cc)
            d.rectangle([c - 24 + o, c - 1 + o, c - 8 + o, c + 1 + o], fill=cc); d.rectangle([c + 8 + o, c - 1 + o, c + 24 + o, c + 1 + o], fill=cc)
        elif st == 'ring':
            d.ellipse([c - 10 + o, c - 10 + o, c + 10 + o, c + 10 + o], outline=cc, width=2); d.rectangle([c - 1 + o, c - 1 + o, c + 1 + o, c + 1 + o], fill=cc)
        else:                # cruz aberta
            for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                x0, y0 = c + dx * 7, c + dy * 7; x1, y1 = c + dx * 20, c + dy * 20
                d.line([(x0 + o, y0 + o), (x1 + o, y1 + o)], fill=cc, width=3)
    return im

def teamicons_png(th):
    im = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
    for k, (team, col) in enumerate((('CLA', (150, 34, 28)), ('RVSF', (40, 64, 130)))):
        t = Image.new('RGBA', (64, 64)); d = ImageDraw.Draw(t)
        pts = [(6, 6), (58, 6), (58, 34), (32, 60), (6, 34)]                 # escudo
        d.polygon([(x + 2, y + 2) for x, y in pts], fill=(0, 0, 0, 160))
        d.polygon(pts, fill=col + (255,), outline=tint(th['metal'], 1.2) + (255,))
        d.line([(6, 6), (58, 6)], fill=tint(th['metal'], 1.4) + (255,), width=3)
        f = font(th['label_font'], 17 if team == 'RVSF' else 20)
        stencil_text(d, (32, 27), team, f, (232, 228, 214, 255), (0, 0, 0, 200), anchor='mm')
        im.alpha_composite(weathering(t, th, 0.15, 40 + k), (k * 64, 0))
    return im

def preview(th, files):
    W, H = 1280, 720
    bg = Image.fromarray(plate(W, H, {**th, 'plate': tint(th['preview_bg'], 1)}, 99, kind='metal')).convert('RGBA')
    bg = bg.filter(ImageFilter.GaussianBlur(3))
    d = ImageDraw.Draw(bg)
    # mira
    xh = files['crosshairs/default.png'].resize((96, 96), Image.LANCZOS); bg.alpha_composite(xh, (W // 2 - 48, H // 2 - 48))
    it = files['misc/items.png']; c = it.width // 4
    def icon(col, row, x, y, s=120): bg.alpha_composite(it.crop((col * c, row * c, col * c + c, row * c + c)).resize((s, s), Image.LANCZOS), (x, y))
    icon(2, 3, 30, H - 150); icon(3, 2, 300, H - 150); icon(0, 1, 820, H - 150); icon(3, 1, 1130, H - 150)
    dg = files['misc/huddigits.png']
    def num(txt, x, y):
        for ch in txt:
            if ch == '/': g = dg.crop((476, 0, 500, 64)); bg.alpha_composite(g, (x, y)); x += 24
            else: i = int(ch); g = dg.crop((4 + 48 * i, 0, 44 + 48 * i, 64)); bg.alpha_composite(g, (x, y)); x += 40
    num('100', 160, H - 120); num('75', 430, H - 120); num('32/96', 950, H - 120)
    cb = files['misc/compass-base.png'].resize((230, 230), Image.LANCZOS); cr = files['misc/compass-rose.png'].resize((214, 214), Image.LANCZOS)
    mini = Image.new('RGBA', (230, 230)); md = ImageDraw.Draw(mini); md.ellipse([33, 33, 197, 197], fill=(60, 64, 58, 200))
    bg.alpha_composite(mini, (W - 260, 20)); bg.alpha_composite(cb, (W - 260, 20)); bg.alpha_composite(cr, (W - 252, 28))
    bg.alpha_composite(files['misc/teamicons.png'].crop((0, 0, 64, 64)).resize((72, 72)), (W - 340, 24))
    f = font(th['label_font'], 34)
    stencil_text(d, (30, 24), th['name'], f, th['digits'] + (255,), (0, 0, 0, 220))
    stencil_text(d, (30, 66), 'CUBEFORGE HUD by Kayque Deleon', font(th['label_font'], 20), th['label'] + (255,), (0, 0, 0, 220))
    sc = files['misc/scope.png'].resize((300, 300), Image.LANCZOS)
    bgs = Image.new('RGBA', (300, 300), tint(th['preview_bg'], 1.25) + (255,)); bgs.alpha_composite(sc)
    bg.alpha_composite(bgs, (W - 330, 300))
    return bg.convert('RGB')

THEMES = {
    'wehrmacht44': dict(
        name='WEHRMACHT 1944', plate=(82, 88, 76), plate_kind='metal', metal=(120, 122, 112), ink=(220, 214, 196), icon=(214, 206, 182), label=(226, 220, 200),
        shadow=(18, 18, 14), accent=(176, 146, 82), cross=(170, 30, 26), cross_bg=(226, 222, 210), digits=(232, 226, 206), ring=(110, 104, 88), rose=(228, 220, 196), rose_n=(206, 58, 40),
        label_font='StardosStencil-Bold.ttf', digit_font='StardosStencil-Bold.ttf', rose_font='StardosStencil-Bold.ttf', cardinals=['N', 'O', 'S', 'W'],
        helmet='stahlhelm', reticle='zf39', scope_rim=(70, 66, 58), blood=(120, 14, 10), xhair=(236, 230, 210), xhair_style='post', preview_bg=(70, 72, 64),
        weapons=[('kampfmesser42', 'KM 42'), ('p38', 'P 38'), ('g43', 'G 43'), ('win1897', 'FLINTE'), ('mp40', 'MP 40'), ('kar98k', '98K'), ('stg44', 'STG 44'), ('stielhandgranate24', 'STIELHGR')]),
    'usarmy44': dict(
        name='US ARMY 1944', plate=(78, 82, 52), plate_kind='metal', metal=(108, 110, 84), ink=(232, 222, 170), icon=(226, 214, 160), label=(238, 228, 176),
        shadow=(16, 16, 10), accent=(222, 190, 70), cross=(180, 30, 30), cross_bg=(236, 234, 226), digits=(244, 232, 180), ring=(58, 60, 50), rose=(150, 220, 140), rose_n=(236, 90, 60),
        label_font='BlackOpsOne-Regular.ttf', digit_font='BlackOpsOne-Regular.ttf', rose_font='BlackOpsOne-Regular.ttf', digit_size=54, cardinals=['N', 'E', 'S', 'W'],
        helmet='m1', reticle='m73b1', scope_rim=(56, 58, 50), blood=(130, 16, 12), xhair=(246, 236, 190), xhair_style='cross', preview_bg=(64, 66, 46),
        weapons=[('m3trench', 'M3'), ('colt1911', 'M1911'), ('m1carbine', 'M1 CARB'), ('win1897', 'M97'), ('thompson', 'M1A1'), ('springfield', 'M1903'), ('bar1918', 'BAR'), ('mk2', 'MK II')]),
    'vermelho43': dict(
        name='EXERCITO VERMELHO 1943', plate=(104, 94, 64), plate_kind='metal', metal=(124, 114, 86), ink=(236, 226, 200), icon=(232, 222, 196), label=(240, 232, 210),
        shadow=(18, 14, 10), accent=(178, 36, 28), cross=(178, 34, 28), cross_bg=(228, 224, 210), digits=(240, 232, 212), ring=(84, 80, 66), rose=(236, 226, 200), rose_n=(196, 40, 30),
        label_font='AllertaStencil-Regular.ttf', digit_font='AllertaStencil-Regular.ttf', rose_font='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf', digit_size=56, cardinals=['С', 'В', 'Ю', 'З'],
        helmet='ssh40', reticle='pu', scope_rim=(66, 62, 52), blood=(124, 12, 10), xhair=(240, 232, 212), xhair_style='post', preview_bg=(86, 78, 56),
        weapons=[('baioneta98', 'NOZH'), ('tt33', 'TT-33'), ('svt40', 'SVT-40'), ('ithaca37', 'DROB'), ('ppsh41', 'PPSH-41'), ('mosin', 'MOSIN'), ('pps43', 'PPS-43'), ('rgd33', 'RGD-33')]),
    'trincheira1916': dict(
        name='TRINCHEIRA 1916', plate=(196, 178, 140), plate_kind='paper', metal=(120, 92, 62), ink=(64, 44, 28), icon=(70, 50, 34), label=(58, 40, 26),
        shadow=(236, 222, 190), accent=(150, 40, 30), cross=(160, 30, 26), cross_bg=(236, 228, 206), digits=(64, 40, 24), ring=(150, 112, 60), rose=(66, 44, 26), rose_n=(150, 36, 26),
        label_font='IMFeENsc28P.ttf', digit_font='IMFeENsc28P.ttf', rose_font='IMFeENsc28P.ttf', digit_size=62, cardinals=['N', 'E', 'S', 'W'],
        helmet='brodie', reticle='aldis', scope_rim=(110, 84, 50), blood=(110, 20, 12), xhair=(40, 28, 18), xhair_style='ring', preview_bg=(150, 132, 100),
        weapons=[('mk1trench', 'Mk I'), ('webley', 'Webley'), ('smle', 'S.M.L.E.'), ('win1897', 'Trench'), ('mp18', 'MP 18'), ('gewehr98', 'Gew 98'), ('chauchat', 'Chauchat'), ('mills36', 'Mills')]),
}
# 1ª Guerra: o "desenho" fica escuro sobre o papel, então a sombra é clara; as silhuetas usam tinta escura
INFO = {
    'wehrmacht44': 'Placas de aço feldgrau rebitadas, estêncil branco-osso, bússola com O (Osten), luneta ZF39 com retículo de três postes, capacete Stahlhelm M35.',
    'usarmy44': 'Verde-oliva com estêncil amarelado, bússola lensática com marcas verdes luminosas, luneta M73B1 de cruz fina, capacete M1.',
    'vermelho43': 'Cáqui soviético com vermelho, estêncil, bússola com letras cirílicas (С, В, Ю, З), luneta PU de poste pontudo, capacete SSh-40.',
    'trincheira1916': 'Papel de campanha envelhecido com tinta sépia e costura, bússola de latão, luneta Aldis de cruz grossa, capacete Brodie.',
}

def build(key, th):
    files = {
        'misc/items.png': items_png(th), 'misc/huddigits.png': huddigits_png(th),
        'misc/compass-base.png': compass_base_png(th), 'misc/compass-rose.png': compass_rose_png(th),
        'misc/scope.png': scope_png(th), 'misc/damage.png': damage_png(th), 'misc/teamicons.png': teamicons_png(th),
        'crosshairs/default.png': crosshair_png(th), 'crosshairs/teammate.png': crosshair_png(th, 'teammate'), 'crosshairs/red_dot.png': crosshair_png(th, 'dot'),
    }
    d = os.path.join(OUT, key); os.makedirs(os.path.join(d, 'packages', 'misc'), exist_ok=True); os.makedirs(os.path.join(d, 'packages', 'crosshairs'), exist_ok=True)
    for p, im in files.items(): im.save(os.path.join(d, 'packages', p), optimize=True)
    preview(th, files).save(os.path.join(d, 'preview.jpg'), quality=88)
    return files

if __name__ == '__main__':
    for k, th in THEMES.items():
        build(k, th); print('ok', k)
    json.dump({k: {'name': th['name'], 'info': INFO[k]} for k, th in THEMES.items()}, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
