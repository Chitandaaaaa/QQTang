# -*- coding: utf-8 -*-
"""
QQ糖 · 夺宝素材库 · 像素 -> SVG 基础库
- 网格绘制助手（band / fill / 自动描边 / 左右镜像）
- SVG 导出（rect 横向合批、crispEdges、透明底）
- PNG 预览导出（自带 zlib 编码，无第三方依赖）
"""
import os, zlib, struct, math, random

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)
OUT_SVG = os.path.join(DESIGN, "assets", "sucai")
OUT_PNG = os.path.join(DESIGN, "assets", "sucai", "_preview")


# ------------------------------------------------------------------ 网格
def grid(w, h=None):
    return [['.'] * w for _ in range(h or w)]


def gsize(g):
    return len(g[0]), len(g)


def put(g, y, x, text):
    """在 (x,y) 起横向写入一串字符"""
    for i, ch in enumerate(text):
        if 0 <= y < len(g) and 0 <= x + i < len(g[0]):
            g[y][x + i] = ch


def fill(g, y, x0, x1, ch):
    """横向纯色填充（不含端点描边）"""
    if not (0 <= y < len(g)):
        return
    w = len(g[0])
    for x in range(max(0, x0), min(w - 1, x1) + 1):
        g[y][x] = ch


def band(g, y, x0, x1, ch, edge='k'):
    """横向填充，两端自动压描边"""
    fill(g, y, x0, x1, ch)
    if 0 <= y < len(g):
        if 0 <= x0 < len(g[0]):
            g[y][x0] = edge
        if 0 <= x1 < len(g[0]):
            g[y][x1] = edge


def rect(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        fill(g, y, x0, x1, ch)


def frame(g, x0, y0, x1, y1, ch):
    """矩形边框"""
    fill(g, y0, x0, x1, ch)
    fill(g, y1, x0, x1, ch)
    for y in range(y0, y1 + 1):
        if 0 <= x0 < len(g[0]):
            g[y][x0] = ch
        if 0 <= x1 < len(g[0]):
            g[y][x1] = ch


def coords(g, pts, ch):
    for x, y in pts:
        if 0 <= y < len(g) and 0 <= x < len(g[0]):
            g[y][x] = ch


def shape(g, rows, ch):
    """rows = [(y, x0, x1), ...]"""
    for y, x0, x1 in rows:
        fill(g, y, x0, x1, ch)


def shape_outline(g, rows, ch='k'):
    """在形状外围补 1px"""
    for y, x0, x1 in rows:
        if 0 <= y < len(g):
            for x in (x0 - 1, x1 + 1):
                if 0 <= x < len(g[0]):
                    g[y][x] = ch
        if 0 <= y - 1 < len(g):
            fill(g, y - 1, x0, x1, ch)
        if 0 <= y + 1 < len(g):
            fill(g, y + 1, x0, x1, ch)


def outline(g, ch='k', diag=True):
    """给整个剪影自动补描边（只画在空格上）"""
    h, w = len(g), len(g[0])
    add = []
    for y in range(h):
        for x in range(w):
            if g[y][x] != '.':
                continue
            nb = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
            if diag:
                nb += [(x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1), (x + 1, y + 1)]
            for nx, ny in nb:
                if 0 <= nx < w and 0 <= ny < h and g[ny][nx] not in ('.', ch):
                    add.append((x, y))
                    break
    for x, y in add:
        g[y][x] = ch


def mirror_right(g):
    """把左半镜像到右半（宽度为偶数时）"""
    h, w = len(g), len(g[0])
    half = w // 2
    for y in range(h):
        for x in range(half):
            g[y][w - 1 - x] = g[y][x]
    return g


def mirror_left(g):
    """左右翻转"""
    h, w = len(g), len(g[0])
    out = [['.'] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            out[y][x] = g[y][w - 1 - x]
    return out


def line(g, x0, y0, x1, y1, ch):
    """Bresenham 直线"""
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        if 0 <= y0 < len(g) and 0 <= x0 < len(g[0]):
            g[y0][x0] = ch
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy


def disc(g, cx, cy, r, ch):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.4:
                if 0 <= y < len(g) and 0 <= x < len(g[0]):
                    g[y][x] = ch


def ring(g, cx, cy, r, ch, thick=1.0):
    for y in range(int(cy - r - 1), int(cy + r) + 2):
        for x in range(int(cx - r - 1), int(cx + r) + 2):
            d = math.hypot(x - cx, y - cy)
            if r - thick <= d <= r:
                if 0 <= y < len(g) and 0 <= x < len(g[0]):
                    g[y][x] = ch


def normalize(g, pal):
    """把直接写入的 #RRGGBB 值还原成调色板字符"""
    rev = {}
    for k, v in pal.items():
        rev.setdefault(v, k)
    for row in g:
        for i, ch in enumerate(row):
            if isinstance(ch, str) and ch.startswith('#') and ch in rev:
                row[i] = rev[ch]
    return g


# ------------------------------------------------------------------ SVG
def to_svg(g, pal, name="", comment="", scale=1):
    h, w = len(g), len(g[0])
    parts = []
    for y, row in enumerate(g):
        x = 0
        while x < w:
            ch = row[x]
            if ch == '.':
                x += 1
                continue
            x2 = x
            while x2 + 1 < w and row[x2 + 1] == ch:
                x2 += 1
            col = pal.get(ch)
            if col:
                parts.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"/>'
                             % (x, y, x2 - x + 1, col))
            x = x2 + 1
    body = "\n  ".join(parts)
    head = '<!-- %s -->\n' % comment if comment else ''
    return (head +
            '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d" shape-rendering="crispEdges" '
            'data-grid="%dx%d">\n'
            '<title>%s</title>\n  %s\n</svg>\n'
            % (w * scale, h * scale, w, h, w, h, name, body))


def svg_inner(g, pal):
    """只输出内部 rect（用于页面内联，省掉 svg 外层）"""
    h, w = len(g), len(g[0])
    parts = []
    for y, row in enumerate(g):
        x = 0
        while x < w:
            ch = row[x]
            if ch == '.':
                x += 1
                continue
            x2 = x
            while x2 + 1 < w and row[x2 + 1] == ch:
                x2 += 1
            col = pal.get(ch)
            if col:
                parts.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"/>'
                             % (x, y, x2 - x + 1, col))
            x = x2 + 1
    return "".join(parts)


# ------------------------------------------------------------------ PNG
def hex2rgb(s):
    s = s.lstrip('#')
    if len(s) == 3:
        s = ''.join(c * 2 for c in s)
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def write_png(path, g, pal, scale=8, bg=None):
    """bg=None -> 透明底"""
    h, w = len(g), len(g[0])
    raw = bytearray()
    b = hex2rgb(bg) + (255,) if bg else (0, 0, 0, 0)
    for row in g:
        lineb = bytearray()
        for ch in row:
            if ch == '.' or ch not in pal:
                lineb += bytes(b) * scale
            else:
                lineb += (bytes(hex2rgb(pal[ch])) + b'\xff') * scale
        for _ in range(scale):
            raw += b'\x00' + bytes(lineb)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w * scale, h * scale, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(png)


def ascii_dump(g, title='', ruler=True):
    w, h = gsize(g)
    print('\n== %s (%dx%d) ==' % (title, w, h))
    if ruler:
        print('    ' + ''.join(str(x % 10) for x in range(w)))
    for y, row in enumerate(g):
        print('%3d ' % y + ''.join(row))
