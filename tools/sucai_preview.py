# -*- coding: utf-8 -*-
"""快速预览：把若干网格拼成一张 PNG 用于人工检查"""
import sys, os
from sucai_lib import grid, write_png, OUT_PNG


def compose(items, cols=6, gap=3, bg='#F0E2C8'):
    """items: [(name, grid, pal), ...] -> grid"""
    # 先算每格尺寸
    cells = []
    for name, g, pal in items:
        cells.append((len(g[0]), len(g)))
    cw = max(c[0] for c in cells) + gap * 2
    ch = max(c[1] for c in cells) + gap * 2
    rows = (len(items) + cols - 1) // cols
    W, H = cw * min(cols, len(items)), ch * rows
    out = grid(W, H)
    for y in range(H):
        for x in range(W):
            out[y][x] = 'bg'
    pal = {'bg': bg}
    for i, (name, g, p) in enumerate(items):
        r, c = divmod(i, cols)
        ox = c * cw + gap
        oy = r * ch + gap
        for y, row in enumerate(g):
            for x, chx in enumerate(row):
                if chx != '.':
                    out[oy + y][ox + x] = '#%02X%02X%02X' % _rgb(p[chx])
    # 分隔线
    for i in range(1, min(cols, len(items))):
        for y in range(H):
            out[y][i * cw - 1] = '#C9B492'
    for r in range(1, rows):
        for x in range(W):
            out[r * ch - 1][x] = '#C9B492'
    return out


def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def dump(items, name='preview', cols=6, scale=6, bg='#F0E2C8'):
    g = compose(items, cols=cols, bg=bg)
    path = os.path.join(OUT_PNG, name + '.png')
    pal = {}
    # pal 直接是 hex 值
    for y in range(len(g)):
        for x in range(len(g[0])):
            if g[y][x] != 'bg':
                pal[g[y][x]] = g[y][x]
    pal['bg'] = bg
    write_png(path, g, pal, scale=scale)
    print('%s.png  %dx%d @%dx -> %s' % (name, len(g[0]), len(g), scale, path))
    return path
