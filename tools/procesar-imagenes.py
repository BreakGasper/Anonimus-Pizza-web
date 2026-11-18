#!/usr/bin/env python3
"""
Procesa las capas de ingredientes de la app Android y genera, para la web:
  - public/img/base.webp           pizza base recortada y centrada (cuadrada)
  - public/img/sprites/<id>.webp   atlas con piezas individuales de cada ingrediente (bordes suaves, color limpio)
  - public/img/sprites/sprites.json  posición/tamaño de cada pieza + geometría de la pizza

Uso:  python3 tools/procesar-imagenes.py /ruta/a/anonimuspizzas/app/src/main/res/drawable
Requiere: Pillow y numpy. (Los originales no se guardan en este repo.)
"""
import json, os, random, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/user/anonimuspizzas/app/src/main/res/drawable'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'img')
os.makedirs(os.path.join(OUT, 'sprites'), exist_ok=True)


def abrir(n):
    return Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')


def etiquetar(mask):
    """Componentes conexas (8 vecinos)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    flat, labf = mask.ravel(), lab.ravel()
    n = 0
    for i in np.flatnonzero(flat).tolist():
        if labf[i]: continue
        n += 1; labf[i] = n; q = deque([i])
        while q:
            j = q.popleft(); jy, jx = divmod(j, w)
            for dy in (-1, 0, 1):
                yy = jy + dy
                if yy < 0 or yy >= h: continue
                for dx in (-1, 0, 1):
                    xx = jx + dx
                    if 0 <= xx < w:
                        k = yy * w + xx
                        if flat[k] and not labf[k]:
                            labf[k] = n; q.append(k)
    return lab, n


def limpiar(rgb_img, mascara, suav=0.0, color=1.08):
    """RGB + máscara booleana -> RGBA con borde suave, sin halo, color sangrado hacia afuera y algo de nitidez."""
    m = Image.fromarray((mascara * 255).astype('uint8'))
    er = m.filter(ImageFilter.MinFilter(3))                      # quita el halo de 1 px
    a = er.filter(ImageFilter.GaussianBlur(1.0))
    a = a.point(lambda v: 0 if v < 60 else 255 if v > 200 else int((v - 60) * 255 / 140))  # borde antialias
    if suav:
        rgb_img = rgb_img.convert('RGB').filter(ImageFilter.GaussianBlur(suav))   # atenúa texturas pixeladas
    rgb = np.asarray(rgb_img.convert('RGB')).astype(np.float32)
    w = (np.asarray(er.filter(ImageFilter.MinFilter(3))) > 128).astype(np.float32)           # interior firme
    pm = Image.fromarray((rgb * w[..., None]).astype('uint8'))
    wm = Image.fromarray((w * 255).astype('uint8'))
    pmb = np.asarray(pm.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
    wb = np.asarray(wm.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255.0
    relleno = pmb / np.maximum(wb, 1e-3)
    rgb2 = np.where(w[..., None] > 0.5, rgb, np.clip(relleno, 0, 255))
    img = Image.fromarray(rgb2.astype('uint8'))
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
    img = ImageEnhance.Contrast(img).enhance(1.06)
    img = ImageEnhance.Color(img).enhance(color)
    out = img.convert('RGBA'); out.putalpha(a)
    return out


def recorte(capa_rgba, mascara, pad=5, **kw):
    ys, xs = np.nonzero(mascara)
    y0, y1, x0, x1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, mascara.shape[0]), max(xs.min() - pad, 0), min(xs.max() + pad + 1, mascara.shape[1])
    sub = capa_rgba.crop((x0, y0, x1, y1))
    mk = np.zeros((y1 - y0, x1 - x0), bool)
    mk[pad - 0:pad - 0 + 0, :] = False
    mk = mascara[y0:y1, x0:x1]
    return limpiar(sub, mk, **kw)


def piezas_por_componentes(nombre, minarea, maxrel=3.2, tope=40, seed=1, aspecto=None, **kw):
    capa = abrir(nombre)
    alfa = np.asarray(capa)[:, :, 3]
    m = alfa > 40
    lab, n = etiquetar(m)
    areas = np.bincount(lab.ravel(), minlength=n + 1)
    ok = [i for i in range(1, n + 1) if areas[i] >= minarea]
    med = np.median([areas[i] for i in ok])
    ok = [i for i in ok if areas[i] <= med * maxrel]
    if aspecto:   # descarta piezas cortadas por el borde del original (medias lunas)
        def prop(i):
            ys, xs = np.nonzero(lab == i)
            return (xs.max() - xs.min() + 1) / (ys.max() - ys.min() + 1)
        ok = [i for i in ok if aspecto[0] <= prop(i) <= aspecto[1]]
    random.Random(seed).shuffle(ok)
    return [recorte(capa, lab == i, **kw) for i in ok[:tope]]


def sprite_de_disco(capa, cy, cx, R, pluma=2.0):
    r = R + 5
    sub = capa.crop((cx - r, cy - r, cx + r + 1, cy + r + 1))
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    d = np.sqrt(yy ** 2 + xx ** 2)
    a = np.clip((R - d) / pluma + 0.5, 0, 1)
    out = limpiar(sub, a > 0.5)
    arr = np.asarray(out).copy(); arr[:, :, 3] = np.minimum(arr[:, :, 3], (a * 255).astype('uint8'))
    return Image.fromarray(arr)


def puntuacion_discos(mask, R):
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1]
    k = ((yy ** 2 + xx ** 2) <= R * R).astype(np.float32)
    conv = np.fft.irfft2(np.fft.rfft2(mask.astype(np.float32)) * np.fft.rfft2(k, s=mask.shape), s=mask.shape) / k.sum()
    return np.roll(conv, (-R, -R), axis=(0, 1))


def elegir(score, minimo, sep, maxn):
    s = score.copy(); out = []
    H, W = s.shape
    for _ in range(maxn):
        i = int(np.argmax(s)); y, x = divmod(i, W)
        if s[y, x] < minimo: break
        out.append((y, x))
        y0, y1, x0, x1 = max(y - sep, 0), min(y + sep + 1, H), max(x - sep, 0), min(x + sep + 1, W)
        s[y0:y1, x0:x1] = 0
    return out


def piezas_pepperoni(R=52, tope=14):
    capa = abrir('add_peperoni')
    m = np.asarray(capa)[:, :, 3] > 128
    pts = elegir(puntuacion_discos(m, R), 0.985, int(R * 1.7), tope)
    return [sprite_de_disco(capa, y, x, R + 2) for y, x in pts]


def piezas_parches_champi(n=26, seed=3):
    capa = abrir('add_champi')
    m = np.asarray(capa)[:, :, 3] > 128
    rng = np.random.default_rng(seed)
    res = []
    for k in range(n):
        R = int(rng.integers(42, 66))
        sc = puntuacion_discos(m, R)
        pts = elegir(sc, 0.985, int(R * 0.9), 80)
        if not pts: continue
        y, x = pts[int(rng.integers(0, len(pts)))]
        r = R + 6
        sub = capa.crop((x - r, y - r, x + r + 1, y + r + 1))
        yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
        d = np.sqrt(yy ** 2 + xx ** 2) / R
        ruido = Image.fromarray((rng.random((9, 9)) * 255).astype('uint8')).resize((2 * r + 1, 2 * r + 1), Image.BICUBIC)
        ruido = np.asarray(ruido.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255.0
        a = np.clip((1.0 - d) * 6.0 + (ruido - 0.5) * 1.4, 0, 1)   # borde algo irregular pero firme
        out = np.asarray(limpiar(sub, a > 0.35)).copy()
        out[:, :, 3] = np.minimum(out[:, :, 3], (a * 255).astype('uint8'))
        res.append(Image.fromarray(out))
    return res


def empaquetar(piezas, ancho=1024, sep=3):
    piezas = sorted(piezas, key=lambda p: -p.height)
    x = y = fila = 0; pos = []
    for p in piezas:
        if x + p.width > ancho: x = 0; y += fila + sep; fila = 0
        pos.append((x, y)); x += p.width + sep; fila = max(fila, p.height)
    atlas = Image.new('RGBA', (ancho, y + fila), (0, 0, 0, 0))
    meta = []
    for p, (px, py) in zip(piezas, pos):
        atlas.paste(p, (px, py)); meta.append({'x': px, 'y': py, 'w': p.width, 'h': p.height})
    return atlas, meta


# ---------- Pizza base ----------
base = abrir('add_arma_tu_pizza')
px = base.load()
for x in range(base.width - 4, base.width):     # el original trae una columna roja opaca en el borde
    for y in range(base.height): px[x, y] = (0, 0, 0, 0)
al = np.asarray(base)[:, :, 3] > 128
ys, xs = np.nonzero(al)
cy, cx = ys.mean(), xs.mean()
R = float(np.sqrt(al.sum() / np.pi))
lado = int(round(2 * R * 1.04))
c = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
c.paste(base, (int(lado / 2 - cx), int(lado / 2 - cy)))
c.resize((900, 900), Image.LANCZOS).save(os.path.join(OUT, 'base.webp'), 'WEBP', quality=88, method=6)

CONFIG = {
    'champinones':        lambda: piezas_parches_champi(),
    'pimiento-verde':     lambda: piezas_por_componentes('add_pimiento_verde', 500),
    'cebolla':            lambda: piezas_por_componentes('add_cebolla', 800, color=0.55, suav=0.6),
    'aceitunas-negras':   lambda: piezas_por_componentes('acituna_negra', 300),
    'jalapeno':           lambda: piezas_por_componentes('add_jalape', 450),
    'pina':               lambda: piezas_por_componentes('add_pina', 800),
    'pepperoni':          lambda: piezas_pepperoni(),
    'jamon':              lambda: piezas_por_componentes('add_jamon', 700),
    'salchicha':          lambda: piezas_por_componentes('add_salchicha', 700),
    'salchicha-italiana': lambda: piezas_por_componentes('add_salchicha_italiana', 1500, aspecto=(0.75, 1.3), suav=1.1),
    'chorizo':            lambda: piezas_por_componentes('add_chorizo', 350, suav=0.7),
    'carne-molida':       lambda: piezas_por_componentes('add_carne_molida', 500, suav=0.7),
}
meta = {'pizza': {'lado': lado, 'radio': round(R, 1)}, 'ingredientes': {}}
tam = 0
for slug, f in CONFIG.items():
    piezas = f()
    atlas, m = empaquetar(piezas)
    ruta = os.path.join(OUT, 'sprites', slug + '.webp')
    atlas.save(ruta, 'WEBP', quality=90, method=6)
    meta['ingredientes'][slug] = {'atlas': atlas.size, 'piezas': m}
    tam += os.path.getsize(ruta)
    print(f'{slug:20s} {len(piezas):3d} piezas  atlas {atlas.size}  {os.path.getsize(ruta)//1024} KB')
json.dump(meta, open(os.path.join(OUT, 'sprites', 'sprites.json'), 'w'), separators=(',', ':'))
print('pizza: centro', round(cx), round(cy), 'radio', round(R), 'lado', lado, '| total sprites', tam // 1024, 'KB')
