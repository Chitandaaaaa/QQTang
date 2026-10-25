# -*- coding: utf-8 -*-
"""把 sucai/logo/QQ糖_logo.png 点阵化成 SVG 素材（透明底）。

    python sucai_logo.py
    -> assets/sucai/logo.svg
    -> assets/sucai/_preview/logo.png

原图是 2048×2048 的伪像素风（12 万种颜色、边缘全是过渡色），直接缩放会糊成
一团。流程：抠白底 → 颜色渗进透明区 → 中值滤波降噪 → 缩到目标点阵 →
限色到十几色 → 二值 alpha。出来的才是「一格一色」的干净像素画。
"""
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sucai_lib import to_svg, write_png, OUT_SVG, OUT_PNG   # noqa: E402

ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "sucai", "logo", "QQ糖_logo.png")
W_POINTS = 128         # 点阵宽：= 页面上的显示宽度，1 点 = 1 CSS 像素
COLORS = 12            # 调色板色数（这个尺度下色越少越干净）
KEY = (1, 254, 3)      # 抠图键色（粉蓝系里绝不会出现的绿）

CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def cut_background(img):
    """把白底刷成键色 -> alpha。
    外圈连通的白直接挖；封闭的纯白块（Q 的孔洞这类）也一并挖掉。"""
    rgb = img.convert("RGB")
    ImageDraw.floodfill(rgb, (0, 0), KEY, thresh=42)
    alpha = Image.new("L", rgb.size, 255)
    px, ap = rgb.load(), alpha.load()
    w, h = rgb.size
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c == KEY:
                ap[x, y] = 0
            elif min(c) >= 243 and max(c) - min(c) <= 9:
                ap[x, y] = 0
    return rgb, alpha


def bleed(rgb, alpha, rounds=5):
    """把颜色渗进透明区：缩放时边缘才不会被白底拖成浅色"""
    hole = alpha.point(lambda v: 255 - v)
    solid = rgb.copy()
    solid.paste((255, 255, 255), mask=hole)
    cur = solid
    for _ in range(rounds):
        cur = Image.composite(cur.filter(ImageFilter.GaussianBlur(6)), cur, hole)
    cur.paste(rgb, mask=alpha)
    return cur


def de_speckle(g, rounds=2):
    """去掉孤立杂点：四周都不是自己色的单点，改成邻居里最多的那个色。
    这个尺度下（1 点 = 1 屏幕像素）杂点只会让 logo 看着脏。"""
    h, w = len(g), len(g[0])
    for _ in range(rounds):
        out = [list(r) for r in g]
        for y in range(h):
            for x in range(w):
                c = g[y][x]
                if c == '.':
                    continue
                nb = [g[y + dy][x + dx]
                      for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                      if 0 <= y + dy < h and 0 <= x + dx < w]
                if all(n != c for n in nb):
                    best, cnt = c, 0
                    for n in nb:
                        if n != '.' and nb.count(n) > cnt:
                            best, cnt = n, nb.count(n)
                    out[y][x] = best
        g = [''.join(r) for r in out]
    return g


def to_grid(img, alpha, w):
    """缩放到点阵并限色；返回 (字符网格, 调色板)"""
    bw, bh = img.size
    h = max(8, int(round(w * bh / bw)))

    flat = bleed(img, alpha).filter(ImageFilter.MedianFilter(3))
    small = flat.resize((w, h), Image.BOX)
    a_small = alpha.resize((w, h), Image.BOX)

    q = small.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT,
                       dither=Image.Dither.NONE)
    pal_raw = q.getpalette()
    idx, ap = q.load(), a_small.load()

    g, pal = [], {}
    used = 0
    for y in range(h):
        row = []
        for x in range(w):
            if ap[x, y] < 140:                 # 不足半个像素就当空
                row.append('.')
                continue
            pi = idx[x, y] * 3
            hexv = "#%02X%02X%02X" % (pal_raw[pi], pal_raw[pi + 1], pal_raw[pi + 2])
            ch = next((k for k, v in pal.items() if v == hexv), None)
            if ch is None:
                ch = CHARS[used % len(CHARS)]
                used += 1
                pal[ch] = hexv
            row.append(ch)
        g.append(''.join(row))
    return de_speckle(g), pal


def to_svg_path(g, pal, name, comment):
    """和 sucai_lib.to_svg 同样的合批，但用 <path> 而不是一堆 <rect>，体积砍一半"""
    h, w = len(g), len(g[0])
    by_color = {}
    for y, row in enumerate(g):
        x = 0
        while x < w:
            ch = row[x]
            if ch == '.' or ch not in pal:
                x += 1
                continue
            x2 = x
            while x2 + 1 < w and row[x2 + 1] == ch:
                x2 += 1
            by_color.setdefault(ch, []).append("M%d %dh%dv1H%dz" % (x, y, x2 - x + 1, x))
            x = x2 + 1
    body = "\n  ".join('<path fill="%s" d="%s"/>' % (pal[ch], "".join(segs))
                       for ch, segs in by_color.items())
    return ('<!-- %s -->\n'
            '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d" shape-rendering="crispEdges" data-grid="%dx%d">\n'
            '<title>%s</title>\n  %s\n</svg>\n'
            % (comment, w, h, w, h, w, h, name, body))


def main():
    img = Image.open(SRC).convert("RGB")
    rgb, alpha = cut_background(img)
    box = alpha.getbbox()
    rgb, alpha = rgb.crop(box), alpha.crop(box)
    print("  content box: %dx%d  ratio %.2f" % (rgb.size[0], rgb.size[1],
                                                rgb.size[0] / rgb.size[1]))

    g, pal = to_grid(rgb, alpha, W_POINTS)
    h = len(g)
    print("  grid %dx%d, %d colors" % (W_POINTS, h, len(pal)))

    os.makedirs(OUT_SVG, exist_ok=True)
    svg_path = os.path.join(OUT_SVG, "logo.svg")
    io.open(svg_path, "w", encoding="utf-8").write(to_svg_path(
        g, pal, name="QQ糖 · logo · %dx%d" % (W_POINTS, h),
        comment="QQ糖 夺宝 · 品牌 logo · %dx%d · 像素素材（透明底）" % (W_POINTS, h)))
    print("  -> logo.svg  %.0f KB" % (os.path.getsize(svg_path) / 1024))

    write_png(os.path.join(OUT_PNG, "logo.png"), g, pal, scale=5)
    print("  -> _preview/logo.png")

    for row in g:
        print("   " + "".join('#' if c != '.' else ' ' for c in row))


if __name__ == "__main__":
    main()
