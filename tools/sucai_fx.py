# -*- coding: utf-8 -*-
"""
QQ糖 · 夺宝素材库 · 炮弹
- 整格炮弹 32x32
- 爆炸格 32x32（故障风粉色/蓝色条纹）

口味糖弹 / 同色爆炸格走 tools/sucai_bombs.py。
"""
from sucai_lib import grid, fill, coords, outline, normalize

BOMB = {'k': '#4A2436', 'p': '#FF9EC4', 'P': '#FFC7DD', 'q': '#E06C9A',
        'b': '#8FD8F5', 'B': '#C8EEFF', 'c': '#4FB8DC',
        'w': '#FFFFFF', 'g': '#F7D77A', 'G': '#FFF3C4', 'v': '#B24A8E'}

CELL = {'k': '#241046', 'd': '#3C1C6E', 'v': '#7C3FD0', 'm': '#5B6BF0',
        'b': '#1E7CF0', 'c': '#0C58C8', 'B': '#5FB0FF',
        'p': '#FF6FB0', 'P': '#FFB3D6', 'w': '#FFFFFF'}



# ------------------------------------------------------------------ 糖弹
def bomb():
    """糖弹：整格 32×32 —— 球体外接圆和格子四边相切（半径 15 + 1px 描边 = 16）"""
    import math
    g = grid(32, 32)
    cx = cy = 15.5
    R = 15.0

    # 1) 球体（显式画圆，保证上下左右都刚好碰到描边）
    for y in range(32):
        for x in range(32):
            if math.hypot(x - cx, y - cy) <= R:
                g[y][x] = 'p'
    # 2) 右下半球偏青，分界是一道斜线
    for y in range(32):
        for x in range(32):
            if g[y][x] == 'p' and (x - cx) * 0.85 + (y - cy) > 1.5:
                g[y][x] = 'b'
    outline(g, 'k')

    # 3) 左上边光 / 右下暗边（贴着描边往里一圈）
    for y in range(32):
        for x in range(32):
            d = math.hypot(x - cx, y - cy)
            if not (11.0 <= d <= 13.6):
                continue
            if g[y][x] == 'p' and (x - cx) + (y - cy) < -5:
                g[y][x] = 'P'
            elif g[y][x] == 'b' and (x - cx) + (y - cy) > 7:
                g[y][x] = 'c'

    # 4) 左上高光块
    for (x, y) in [(7, 8), (8, 8), (9, 8),
                   (6, 9), (7, 9), (8, 9), (9, 9), (10, 9),
                   (6, 10), (7, 10), (8, 10), (9, 10),
                   (7, 11), (8, 11)]:
        g[y][x] = 'P'
    for (x, y) in [(7, 9), (8, 9), (8, 10), (7, 10)]:
        g[y][x] = 'w'
    # 5) 底部一小块反光（不是星屑，是个软反光）
    for (x, y) in [(12, 22), (13, 22), (12, 23), (11, 23)]:
        g[y][x] = 'B'
    return g, BOMB


# ------------------------------------------------------------------ 爆炸格（故障条纹）
# 参考图是一块「上紫下蓝、带粉白撕裂」的发光方砖。
# 关键：不画整圈深边框 —— 游戏里相邻两格要无缝连成一片火。
def boom_cell():
    g = grid(32, 32)
    # 1) 竖向渐变：上粉紫 -> 蓝紫 -> 亮蓝，段与段之间只留 1 行棋盘过渡
    bands = [('P', 2), ('dv', 1), ('v', 4), ('vm', 1), ('m', 3), ('mb', 1),
             ('b', 8), ('bB', 1), ('B', 11)]
    y = 0
    for ch, h in bands:
        if y >= 32:
            break
        for i in range(h):
            if y >= 32:
                break
            if len(ch) == 2:
                for x in range(32):
                    g[y][x] = ch[0] if (x + y) % 2 else ch[1]
            else:
                fill(g, y, 0, 31, ch)
            y += 1
    # 余下的行一律压成亮蓝，别留空
    while y < 32:
        fill(g, y, 0, 31, 'B')
        y += 1
    # 2) 短故障条：只有 4~11px 长，绝不能整行贯通（否则拼起来像条形码）
    streaks = [(3, 5, 11, 'w'), (6, 19, 9, 'P'), (10, 7, 8, 'B'),
               (13, 22, 7, 'P'), (17, 4, 10, 'B'), (21, 15, 9, 'w'),
               (25, 9, 8, 'B'), (28, 21, 7, 'P')]
    for (y, x0, ln, ch) in streaks:
        fill(g, y, x0, min(31, x0 + ln), ch)
    # 3) 白热芯 + 外圈蓝
    for y in range(13, 19):
        for x in range(13, 19):
            g[y][x] = 'w' if (abs(x - 15.5) < 1.6 and abs(y - 15.5) < 1.6) else 'B'
    # 4) 极角压暗一点点，让每格自己立起来
    for (x, y) in [(0, 0), (31, 0), (0, 31), (31, 31)]:
        g[y][x] = 'd'
    return g, CELL


FX_ASSETS = [
    ('bomb', bomb, '整格炮弹 · 32×32'),
    ('boom-cell', boom_cell, '通用爆炸格 · 32×32'),
]
