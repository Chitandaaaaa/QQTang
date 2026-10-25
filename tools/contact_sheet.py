# -*- coding: utf-8 -*-
"""把四角色 × 三视图拼成一张 PNG 联系表，用于肉眼核稿
运行：python contact_sheet.py [out.png] [--sil]
"""
import os
import sys

import build_assets as B
import build_chars as C

ROWS = [
    ('tangdou', '糖豆', (B.front, B.side, B.back)),
    ('archer', '青羽', (C.archer_front, C.archer_side, C.archer_back)),
    ('glam', '夜蔷薇', (C.glam_front, C.glam_side, C.glam_back)),
    ('sword', '银霜', (C.sword_front, C.sword_side, C.sword_back)),
]
CELL, GUT = 32, 4


def compose(sil=False):
    cols = len(ROWS)
    w = GUT + cols * (CELL + GUT)
    h = GUT + 3 * (CELL + GUT)
    out = [['.'] * w for _ in range(h)]
    for ci, (_, _, fns) in enumerate(ROWS):
        for ri, fn in enumerate(fns):
            g = fn()
            ox = GUT + ci * (CELL + GUT)
            oy = GUT + ri * (CELL + GUT)
            for y, row in enumerate(g):
                for x, ch in enumerate(row):
                    if ch == '.':
                        continue
                    out[oy + y][ox + x] = 'k' if sil else ch
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sil = '--sil' in sys.argv
    path = args[0] if args else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'contact-sil.png' if sil else 'contact-sheet.png')
    g = compose(sil)
    B.write_png(path, g, scale=7 if not sil else 6)
    print('->', path, len(g[0]), 'x', len(g), 'px   scale', 7 if not sil else 6)


if __name__ == '__main__':
    main()
