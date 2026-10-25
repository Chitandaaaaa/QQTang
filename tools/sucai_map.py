# -*- coding: utf-8 -*-
"""
QQ糖 · 夺宝素材库 · 地图（地面 / 围墙 / 障碍物）
32x32 无缝贴图 + 24-32px 道具；全部程序化绘制，保证拼接不出现接缝
"""
from sucai_lib import (grid, put, fill, band, rect, frame, coords, shape,
                       outline, line, disc, ring, mirror_right)
import math

# ------------------------------------------------------------------ 调色
SAND = {'a': '#E9C87C', 'b': '#DDBA6C', 'c': '#F4DC9E', 'd': '#CFA75C',
        'k': '#B08A3E', 'e': '#FBEEC4'}

STONE = {'a': '#D6C098', 'b': '#C6AE84', 'c': '#E7D6B0', 'd': '#AE9468',
         'k': '#8C7448', 'e': '#F3E7C8'}

CARPET = {'k': '#4E0C18', 'r': '#8E1F2F', 'R': '#A82A3B', 'q': '#6E1424',
          'g': '#C89A3A', 'G': '#EFC96A', 'j': '#8E6620',
          'w': '#F7E6BF', 'f': '#FFB347', 'F': '#FFF3C4', 'o': '#FF8A3D'}

WALL = {'k': '#4A3722', 'm': '#7C6440', 'a': '#CBB089', 'b': '#B99C74',
        'c': '#DEC9A2', 'd': '#9C825C', 'e': '#F0E1C2'}

POT = {'k': '#2E1B14', 't': '#3E9F9B', 'T': '#6FD3CB', 'u': '#277F7C',
       'g': '#D9A441', 'G': '#F5D07A', 'j': '#A5762A',
       'r': '#C2453C', 'R': '#E07064', 'w': '#FFFFFF',
       'n': '#8A5A2E', 'N': '#AA7644'}

CRATE = {'k': '#38220F', 'w': '#9C6B38', 'W': '#C08A4E', 'v': '#7A4E22',
         'm': '#8C8C96', 'M': '#C3C6CE', 'n': '#5E3A18', 'g': '#D9A441'}

CHEST = {'k': '#3A2416', 'w': '#8A5A2E', 'W': '#A97644', 'v': '#5E3A18',
         'g': '#D9A441', 'G': '#F7D77A', 'j': '#A5762A',
         'b': '#2E7CD6', 'B': '#8FD4FF', 'e': '#F3E7C8'}


# ------------------------------------------------------------------ 工具
def noise(x, y, seed=0):
    """确定性伪随机 0-99（位混合，避免斜向条纹）"""
    n = (x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)
    n = (n ^ (n >> 13)) * 1274126177
    n = n ^ (n >> 16)
    return abs(n) % 100


def speckle(g, x0, y0, x1, y1, pal_chars, seed=0, dens=14):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            n = noise(x, y, seed)
            if n % 100 < dens:
                g[y][x] = pal_chars[n % len(pal_chars)]


# ------------------------------------------------------------------ 沙地
def tile_sand():
    g = grid(32, 32)
    rect(g, 0, 0, 31, 31, 'a')
    # 大颗粒噪点
    for y in range(32):
        for x in range(32):
            n = noise(x, y, 1)
            if n < 13:
                g[y][x] = 'b'
            elif n < 22:
                g[y][x] = 'c'
            elif n < 25:
                g[y][x] = 'd'
    # 风纹（斜向波纹，首尾衔接保证无缝）
    for i, (y0, amp, ph) in enumerate([(6, 1.6, 0), (15, 1.2, 2), (24, 1.8, 4)]):
        for x in range(32):
            y = y0 + int(round(amp * math.sin((x + ph * 4) / 5.2)))
            if 0 <= y < 32:
                g[y][x] = 'c'
                if g[(y + 1) % 32][x] == 'a':
                    g[(y + 1) % 32][x] = 'b'
    # 小石子
    for (cx, cy) in [(7, 11), (23, 18), (14, 27), (27, 4)]:
        coords(g, [(cx, cy), (cx + 1, cy), (cx, cy + 1)], 'd')
        coords(g, [(cx + 1, cy + 1)], 'b')
    return g, SAND


# ------------------------------------------------------------------ 神殿石砖（地面）
def tile_temple():
    g = grid(32, 32)
    rect(g, 0, 0, 31, 31, 'a')
    speckle(g, 0, 0, 31, 31, ['b', 'c', 'b'], 3, 11)
    # 砖缝
    frame(g, 0, 0, 31, 31, 'k')
    # 斜面高光 / 阴影
    fill(g, 1, 1, 30, 'c')
    for y in range(1, 31):
        g[y][1] = 'c'
    fill(g, 30, 1, 30, 'd')
    for y in range(1, 31):
        g[y][30] = 'd'
    # 内框浅雕
    frame(g, 4, 4, 27, 27, 'b')
    frame(g, 5, 5, 26, 26, 'c')
    # 裂纹
    coords(g, [(9, 5), (10, 6), (10, 7), (11, 8), (11, 9), (12, 10)], 'd')
    coords(g, [(20, 26), (21, 25), (22, 24), (23, 23)], 'd')
    # 角落磨痕
    coords(g, [(2, 2), (3, 2), (2, 3), (29, 29), (28, 29), (29, 28)], 'e')
    return g, STONE


# ------------------------------------------------------------------ 红色地毯（底）
def carpet_base(g):
    k, r, R, q, gd, G, j = 'k', 'r', 'R', 'q', 'g', 'G', 'j'
    rect(g, 0, 0, 31, 31, r)
    # 织纹
    for y in range(32):
        for x in range(32):
            n = noise(x, y, 5)
            if n < 12:
                g[y][x] = q
            elif n < 20:
                g[y][x] = R
    # 外框：黑 - 暗金 - 亮金
    frame(g, 0, 0, 31, 31, k)
    frame(g, 1, 1, 30, 30, j)
    frame(g, 2, 2, 29, 29, gd)
    frame(g, 3, 3, 28, 28, G)
    frame(g, 4, 4, 27, 27, j)
    # 四角莲花结
    for (cx, cy) in [(6, 6), (25, 6), (6, 25), (25, 25)]:
        coords(g, [(cx, cy), (cx + 1, cy), (cx, cy + 1), (cx + 1, cy + 1)], gd)
        coords(g, [(cx, cy)], G)
    # 边框中点菱形
    for (cx, cy) in [(16, 2), (16, 29), (2, 16), (29, 16)]:
        coords(g, [(cx, cy)], k)
    return g


def tile_carpet():
    g = grid(32, 32)
    carpet_base(g)
    return g, CARPET


def _ornament_ring(g, cx, cy, r, ch, thick=1.0):
    ring(g, cx, cy, r, ch, thick)


def tile_carpet_emblem():
    """中心徽章：金色同心圆 + 四向菱形 + 红宝石"""
    g = grid(32, 32)
    carpet_base(g)
    cx = cy = 15.5
    ring(g, cx, cy, 8.4, 'j', 1.0)
    ring(g, cx, cy, 7.4, 'g', 1.2)
    ring(g, cx, cy, 6.2, 'j', 1.0)
    disc(g, cx, cy, 5.0, 'G')
    disc(g, cx, cy, 4.0, 'g')
    disc(g, cx, cy, 2.6, 'G')
    # 四向菱形
    for (x, y) in [(15, 8), (16, 8), (15, 9), (16, 9),
                   (15, 22), (16, 22), (15, 23), (16, 23),
                   (8, 15), (8, 16), (9, 15), (9, 16),
                   (22, 15), (22, 16), (23, 15), (23, 16)]:
        g[y][x] = 'g'
    coords(g, [(15, 8), (16, 23), (8, 16), (22, 15)], 'G')
    # 中心宝石
    coords(g, [(15, 15), (16, 15), (15, 16), (16, 16)], 'r')
    coords(g, [(15, 15)], 'R')
    return g, CARPET


def tile_carpet_astral():
    """占星环：同心环 + 星点 + 轨道"""
    g = grid(32, 32)
    carpet_base(g)
    cx = cy = 15.5
    ring(g, cx, cy, 9, CARPET['j'], 1.1)
    ring(g, cx, cy, 6, CARPET['g'], 1.1)
    ring(g, cx, cy, 2.4, CARPET['G'], 1.1)
    # 轨道斜线
    for a in range(6):
        ang = a * math.pi / 3 + 0.4
        for t in range(3, 10):
            x = int(round(cx + math.cos(ang) * t))
            y = int(round(cy + math.sin(ang) * t * 0.62))
            if 0 <= x < 32 and 0 <= y < 32:
                g[y][x] = CARPET['j']
    # 星点
    for a in range(5):
        ang = a * math.pi * 2 / 5 - 0.6
        x = int(round(cx + math.cos(ang) * 7.4))
        y = int(round(cy + math.sin(ang) * 7.4))
        coords(g, [(x, y)], CARPET['w'])
        coords(g, [(x + 1, y), (x, y + 1)], CARPET['G'])
    coords(g, [(15, 15), (16, 15), (15, 16), (16, 16)], CARPET['w'])
    return g, CARPET


def tile_carpet_vortex():
    """漩涡火：金色螺旋 + 火心"""
    g = grid(32, 32)
    carpet_base(g)
    cx = cy = 15.5
    for t in range(0, 78):
        ang = t * 0.42
        r = 1.2 + t * 0.115
        x = int(round(cx + math.cos(ang) * r))
        y = int(round(cy + math.sin(ang) * r))
        if 0 <= x < 32 and 0 <= y < 32:
            g[y][x] = CARPET['j'] if t % 3 else CARPET['G']
    # 火心
    coords(g, [(15, 15), (16, 15), (15, 16), (16, 16)], 'f')
    coords(g, [(15, 15)], 'F')
    coords(g, [(14, 16), (17, 16), (15, 17), (16, 17)], 'o')
    # 外围火星
    for (x, y) in [(7, 10), (24, 9), (9, 24), (23, 22), (15, 6), (15, 25)]:
        g[y][x] = CARPET['G']
    return g, CARPET


def tile_carpet_rune():
    """魔法纹：对称符文 + 菱形阵"""
    g = grid(32, 32)
    carpet_base(g)
    # 左右对称手绘符文（只画左半，再镜像）
    left = [(15, 8), (14, 9), (13, 9), (13, 10), (14, 10), (15, 10),
            (12, 11), (13, 11), (11, 12), (11, 13), (12, 13), (13, 13),
            (10, 14), (10, 15), (11, 15), (12, 15), (13, 15), (14, 15),
            (9, 16), (9, 17), (10, 17), (11, 17), (12, 17), (13, 17),
            (10, 18), (11, 18), (12, 18), (11, 19), (11, 20), (12, 20),
            (13, 20), (14, 20), (15, 20)]
    for (x, y) in left:
        g[y][x] = CARPET['w']
        g[y][31 - x] = CARPET['w']
    # 符文外圈
    ring(g, 15.5, 14, 9.5, CARPET['g'], 1.1)
    # 四角小菱形
    for (cx, cy) in [(11, 7), (20, 7), (11, 22), (20, 22)]:
        coords(g, [(cx, cy), (cx + 1, cy), (cx, cy + 1), (cx + 1, cy + 1)], CARPET['G'])
    return g, CARPET


# ------------------------------------------------------------------ 古石墙
def tile_wall():
    g = grid(32, 32)
    rect(g, 0, 0, 31, 31, WALL['m'])
    bh = 8
    bw = 16
    for row in range(4):
        off = 0 if row % 2 == 0 else 8
        y0 = row * bh
        for bx in range(-1, 3):
            x0 = bx * bw + off
            x1 = x0 + bw - 1
            ya, yb = y0, y0 + bh - 1
            # 砖面
            rect(g, max(0, x0), ya, min(31, x1), yb, WALL['a'])
            # 高光 / 阴影
            fill(g, ya, x0 + 1, x1 - 1, WALL['c'])
            for y in range(ya, yb + 1):
                if 0 <= x0 < 32:
                    g[y][x0] = WALL['c']
                if 0 <= x1 < 32:
                    g[y][x1] = WALL['d']
            fill(g, yb, x0 + 1, x1 - 1, WALL['d'])
            # 砖缝
            for y in range(ya, yb + 1):
                if 0 <= y < 32:
                    g[y][(x0 - 1) % 32] = WALL['k']
            for x in range(max(0, x0 - 1), min(32, x1 + 1)):
                g[yb][x] = WALL['k']
    # 表面颗粒
    speckle(g, 0, 0, 31, 31, ['b', 'b', 'c'], 9, 8)
    # 雕刻符文（圆 / 三角 / 椭圆 / 菱形）
    def glyph_circle(cx, cy, r=2):
        for a in range(12):
            ang = a * math.pi / 6
            x = int(round(cx + math.cos(ang) * r))
            y = int(round(cy + math.sin(ang) * r))
            if 0 <= x < 32 and 0 <= y < 32:
                g[y][x] = WALL['d']
    glyph_circle(15, 11, 2.4)
    coords(g, [(15, 11), (16, 11), (15, 12)], WALL['d'])
    # 三角形
    for i in range(4):
        coords(g, [(6 - i, 22 + i), (6 + i, 22 + i)], WALL['d'])
    coords(g, [(6, 26)], WALL['d'])
    # 椭圆
    for a in range(14):
        ang = a * math.pi * 2 / 14
        x = int(round(23 + math.cos(ang) * 3))
        y = int(round(30 + math.sin(ang) * 1.6))
        if 0 <= y < 32:
            g[y][x] = WALL['d']
    # 菱形
    coords(g, [(23, 3), (22, 4), (24, 4), (23, 5)], WALL['d'])
    return g, WALL


# ------------------------------------------------------------------ 石柱（浮雕墙）
def tile_pillar():
    g = grid(32, 32)
    rect(g, 0, 0, 31, 31, WALL['b'])
    speckle(g, 0, 0, 31, 31, ['a', 'a', 'c'], 13, 10)
    # 上下两层雕饰块
    for (y0, y1) in [(1, 14), (17, 30)]:
        rect(g, 1, y0, 30, y1, WALL['a'])
        frame(g, 1, y0, 30, y1, WALL['d'])
        fill(g, y0, 2, 29, WALL['c'])
        # 两个拱形壁龛
        for (cx, cy) in [(9, y0 + 4), (22, y0 + 4)]:
            for dy in range(0, 7):
                half = 4 if dy > 2 else 4 - (2 - dy)
                for dx in range(-half, half + 1):
                    x, y = cx + dx, cy + dy
                    if 0 <= x < 32 and 0 <= y < 32:
                        g[y][x] = WALL['d'] if abs(dx) >= half - 0 else WALL['b']
            # 龛内阴影
            for dy in range(1, 7):
                half = 3 if dy > 2 else 3 - (2 - dy)
                for dx in range(-half, half + 1):
                    x, y = cx + dx, cy + dy
                    if 0 <= x < 32 and 0 <= y < 32:
                        g[y][x] = WALL['b'] if dy < 5 else WALL['d']
    # 莲花浮雕
    for cx in (9, 22):
        cy = 27
        coords(g, [(cx, cy)], WALL['c'])
        coords(g, [(cx - 1, cy + 1), (cx + 1, cy + 1)], WALL['e'])
        coords(g, [(cx - 2, cy + 2), (cx + 2, cy + 2)], WALL['c'])
        coords(g, [(cx, cy + 2), (cx - 1, cy + 3), (cx + 1, cy + 3)], WALL['e'])
    # 横向分割石线
    for y in (15, 16):
        fill(g, y, 0, 31, WALL['d'] if y == 15 else WALL['k'])
    # 侧边
    for y in range(32):
        g[y][0] = WALL['k']
        g[y][31] = WALL['k']
    return g, WALL


# ------------------------------------------------------------------ 彩陶罐
def prop_amphora():
    """32x32 满格：罐身顶到格子上下边，双耳外扩"""
    g = grid(32, 32)
    # 罐身（最宽 26px，高 24px）
    body = [(6, 11, 20), (7, 9, 22), (8, 8, 23), (9, 7, 24), (10, 6, 25),
            (11, 5, 26), (12, 4, 27), (13, 4, 27), (14, 4, 27), (15, 4, 27),
            (16, 4, 27), (17, 4, 27), (18, 5, 26), (19, 5, 26), (20, 6, 25),
            (21, 7, 24), (22, 8, 23), (23, 9, 22), (24, 10, 21), (25, 11, 20),
            (26, 12, 19)]
    shape(g, body, POT['t'])
    # 腰线
    for y in range(11, 24):
        fill(g, y, 7, 24, POT['t'])
    # 底部收口
    shape(g, [(27, 12, 19), (28, 12, 19)], POT['u'])
    # 罐口：远端口沿亮 -> 口内深 -> 近端口沿
    shape(g, [(2, 11, 20)], POT['R'])
    shape(g, [(3, 9, 10), (3, 21, 22)], POT['r'])
    fill(g, 3, 11, 20, POT['k'])
    shape(g, [(4, 8, 9), (4, 22, 23)], POT['r'])
    fill(g, 4, 10, 21, POT['u'])
    shape(g, [(5, 8, 23)], POT['r'])
    coords(g, [(11, 2), (12, 2), (19, 2), (20, 2)], POT['r'])
    # 双耳：贴着罐身的竖向把手
    shape(g, [(8, 3, 6), (9, 2, 6), (10, 2, 5), (11, 2, 5),
              (12, 2, 5), (13, 2, 5), (14, 2, 6), (15, 3, 6)], POT['t'])
    shape(g, [(8, 25, 28), (9, 25, 29), (10, 26, 29), (11, 26, 29),
              (12, 26, 29), (13, 26, 29), (14, 25, 29), (15, 25, 28)], POT['t'])
    outline(g, 'k')
    # 耳朵高光（在描边之后画，避免被吃掉）
    coords(g, [(3, 10), (3, 11), (3, 12), (3, 13)], POT['T'])
    coords(g, [(26, 10), (26, 11), (26, 12), (26, 13)], POT['T'])
    coords(g, [(4, 9)], POT['T'])
    # 金饰带
    for y in (14, 15):
        fill(g, y, 6, 25, POT['g'])
    coords(g, [(10, 14), (11, 14), (12, 14), (13, 14), (14, 14), (15, 14)], POT['G'])
    # 菱形纹
    for cx in (9, 15, 22):
        coords(g, [(cx, 18), (cx - 1, 19), (cx + 1, 19), (cx - 2, 20), (cx + 2, 20),
                   (cx - 1, 21), (cx + 1, 21), (cx, 22)], POT['G'])
    # 高光 / 阴影
    for y in range(9, 27):
        if g[y][7] == POT['t']:
            g[y][7] = POT['T']
    for y in range(9, 28):
        if g[y][24] == POT['t']:
            g[y][24] = POT['u']
    coords(g, [(10, 10), (11, 10), (10, 11), (9, 12)], POT['T'])
    coords(g, [(19, 8), (20, 8), (20, 9)], POT['R'])
    return g, POT


# ------------------------------------------------------------------ 木箱
def prop_crate():
    """32x32 满格木箱：四条横板 + X 形加固 + 金属包角"""
    g = grid(32, 32)
    # 四条横板，板缝用暗线
    for (y0, y1) in [(1, 8), (9, 16), (17, 24), (25, 30)]:
        fill(g, y0, 1, 30, CRATE['W'])
        for y in range(y0 + 1, y1):
            fill(g, y, 1, 30, CRATE['w'])
        fill(g, y1, 1, 30, CRATE['v'])
    # 木纹
    for (x, y, n) in [(4, 4, 4), (19, 5, 3), (7, 12, 5), (21, 14, 3),
                      (5, 20, 4), (20, 21, 3), (10, 27, 4), (22, 28, 3)]:
        for i in range(n):
            if 0 <= x + i < 32 and g[y][x + i] == CRATE['w']:
                g[y][x + i] = CRATE['v']
    # X 形加固：2px 深条 + 1px 亮边
    for k in (0, 1):
        line(g, 3 + k, 2, 28 + k, 29, CRATE['n'])
    for k in (0, 1):
        line(g, 28 - k, 2, 3 - k, 29, CRATE['n'])
    line(g, 4, 3, 29, 30, CRATE['v'])
    line(g, 27, 3, 2, 30, CRATE['v'])
    # 金属包角（四角 L 形）
    for (cx, cy, sx, sy) in [(2, 2, 1, 1), (29, 2, -1, 1), (2, 29, 1, -1), (29, 29, -1, -1)]:
        for i in range(5):
            for t in range(2):
                g[cy + sy * t][cx + sx * i] = CRATE['m']
                g[cy + sy * i][cx + sx * t] = CRATE['m']
        g[cy][cx] = CRATE['M']
        g[cy + sy][cx + sx] = CRATE['M']
        g[cy + sy * 2][cx + sx * 2] = CRATE['M']
    # 边框
    frame(g, 0, 0, 31, 31, CRATE['k'])
    frame(g, 1, 1, 30, 30, CRATE['n'])
    return g, CRATE


# ------------------------------------------------------------------ 金宝箱
def prop_chest():
    """32x32 满格金宝箱：拱形盖 + 竖向金带 + 锁扣"""
    g = grid(32, 32)
    # 箱体（不透明底，保证满格）
    rect(g, 1, 12, 30, 31, CHEST['w'])
    # 拱形箱盖
    lid = [(1, 5, 26), (2, 3, 28), (3, 2, 29), (4, 1, 30)]
    for y in range(5, 12):
        lid.append((y, 1, 30))
    shape(g, lid, CHEST['W'])
    # 木纹：竖条 + 横缝
    for x in range(5, 29, 5):
        for y in range(12, 31):
            if g[y][x] == CHEST['w']:
                g[y][x] = CHEST['v']
    for y in (8, 10, 17, 21, 25, 29):
        for x in range(2, 30):
            if g[y][x] == CHEST['w']:
                g[y][x] = CHEST['v']
    # 盖沿金色描边（跟着弧线走）
    for (y, x0, x1) in lid:
        coords(g, [(x0, y), (x1, y)], CHEST['g'])
    for (y, x0, x1) in lid:
        if g[y][x0 + 1] != '.':
            g[y][x0 + 1] = CHEST['G']
    # 盖与箱体分界
    fill(g, 11, 1, 30, CHEST['G'])
    fill(g, 12, 1, 30, CHEST['g'])
    fill(g, 13, 1, 30, CHEST['j'])
    # 竖向金带
    for y in range(3, 31):
        g[y][14] = CHEST['j']
        g[y][15] = CHEST['G']
        g[y][16] = CHEST['g']
        g[y][17] = CHEST['j']
    # 锁扣
    rect(g, 12, 13, 19, 20, CHEST['g'])
    fill(g, 13, 13, 18, CHEST['G'])
    frame(g, 12, 13, 19, 20, CHEST['j'])
    rect(g, 14, 15, 17, 19, CHEST['k'])
    coords(g, [(15, 16), (16, 16), (15, 17), (16, 17)], CHEST['b'])
    coords(g, [(15, 16)], CHEST['B'])
    coords(g, [(15, 18), (16, 18)], CHEST['j'])
    # 底部暗边
    fill(g, 30, 1, 30, CHEST['v'])
    # 角钉
    for (x, y) in [(2, 12), (29, 12), (2, 30), (29, 30)]:
        g[y][x] = CHEST['j']
    frame(g, 0, 0, 31, 31, CHEST['k'])
    return g, CHEST


# ================================================================ 冰面主题
# 参考素材：sucai/地图/{围墙,地面,障碍物}/冰面_*.png
ICE = {'k': '#3E7DB3', 'a': '#A8DAFB', 'b': '#93D1FD', 'c': '#C7E8FE',
       'd': '#7FBFE8', 'e': '#EDF8FF', 'f': '#DCF0FF'}

ICEW = {'k': '#0A3E80', 'a': '#2169B7', 'b': '#2B78C4', 'c': '#5298D9',
        'd': '#1558A5', 'e': '#79B6EA'}

ICEP = {'k': '#173F6B', 'a': '#4A8BC4', 'b': '#5C9AD0', 'c': '#7FB4E0',
        'd': '#35699E', 'e': '#AFD6F2'}

ICEB = {'k': '#23608F', 'a': '#D3EDFD', 'b': '#E7F5FE', 'c': '#FBFFFF',
        'd': '#A3D3F2', 'e': '#6FB6E4', 'w': '#FFFFFF',
        'm': '#44A1D9', 'n': '#1871B3', 'N': '#88DBFC', 'x': '#10314B'}

SNOW = {'k': '#3C5875', 'w': '#FFFFFF', 'a': '#EEF5FD', 'b': '#D6E5F6',
        'c': '#B9CFE8', 'o': '#F0913C', 'O': '#FFB65C',
        's': '#3F7BC4', 'S': '#6FA8E8', 'n': '#4A3728'}


def _flake(g, cx, cy, r, ch, sub=0.5):
    """六角雪花：6 根主轴 + 每轴两根 60° 斜枝"""
    for a in range(6):
        ang = a * math.pi / 3
        for t in range(0, int(r) + 1):
            x = int(round(cx + math.cos(ang) * t))
            y = int(round(cy + math.sin(ang) * t))
            if 0 <= x < 32 and 0 <= y < 32:
                g[y][x] = ch
        bx = cx + math.cos(ang) * r * 0.52
        by = cy + math.sin(ang) * r * 0.52
        for side in (-1, 1):
            ba = ang + side * 1.05
            for t in range(1, int(r * 0.46) + 2):
                x = int(round(bx + math.cos(ba) * t))
                y = int(round(by + math.sin(ba) * t))
                if 0 <= x < 32 and 0 <= y < 32:
                    g[y][x] = ch


def ice_base():
    """冰地砖底：一整片平整冰面。左/上各 1px 深缝、右/下 1px 亮边，
       相邻两块拼起来正好是一道 2px 的浅浮雕缝 —— 是「缝」不是「框」。"""
    g = grid(32, 32)
    rect(g, 0, 0, 31, 31, 'a')
    # 极淡的斜向光带：左上稍亮，右下稍暗，避免整片死平
    for y in range(32):
        for x in range(32):
            if x + y < 16:
                g[y][x] = 'c'
    # 稀疏气泡
    for y in range(2, 30):
        for x in range(2, 30):
            if noise(x, y, 21) < 7:
                g[y][x] = 'b'
    for x in range(32):
        g[0][x] = 'd'
        g[31][x] = 'f'
    for y in range(32):
        g[y][0] = 'd'
        g[y][31] = 'f'
    return g


def tile_ice():
    """冰地砖：干净冰面 + 两道细冰裂（不画内框，否则密铺就成网格）"""
    g = ice_base()
    coords(g, [(11, 12), (12, 12), (13, 13), (14, 14), (14, 15)], 'f')
    coords(g, [(18, 22), (19, 22), (20, 21)], 'f')
    coords(g, [(22, 9), (23, 10)], 'f')
    coords(g, [(7, 20)], 'e')
    return g, ICE


def tile_ice_snow():
    """雪花冰地砖：同一块冰底上压一大片雪花，中心再叠一层小的"""
    g = ice_base()
    _flake(g, 15.5, 15.5, 12.0, 'e')
    coords(g, [(15, 15), (16, 15), (15, 16), (16, 16)], 'f')
    for (cx, cy) in [(6, 6), (25, 6), (6, 25), (25, 25)]:
        coords(g, [(cx, cy)], 'e')
        coords(g, [(cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)], 'f')
    return g, ICE


def tile_wall_ice():
    """冰砖墙：深蓝冰砖错缝砌，顶面一条受光亮边"""
    g = grid(32, 32)
    rect(g, 0, 0, 31, 31, ICEW['k'])
    bh, bw = 15, 16
    for row in range(2):
        ya = row * 16
        yb = ya + bh - 1
        off = 0 if row == 0 else -8
        for bx in range(-1, 3):
            x0 = bx * bw + off
            x1 = x0 + bw - 2
            xa, xb = max(0, x0), min(31, x1)
            if xa > xb:
                continue
            rect(g, xa, ya, xb, yb, 'a')
            for y in range(ya, yb + 1):
                for x in range(xa, xb + 1):
                    n = noise(x, y, 31)
                    if n < 19:
                        g[y][x] = 'b'
                    elif n < 25:
                        g[y][x] = 'd'
            fill(g, ya, xa, xb, 'c')
            fill(g, yb, xa, xb, 'd')
            for y in range(ya, yb + 1):
                g[y][xb] = 'd'
                if x0 >= 0:
                    g[y][xa] = 'b'
    fill(g, 0, 0, 31, 'c')
    for x in range(32):
        if g[0][x] == 'c':
            g[0][x] = 'e'
    return g, ICEW


def tile_ice_pillar():
    """冰柱：深蓝实心立柱 —— 左右收暗做圆柱体积，顶部一块受光台面，
       底边压最深的收口。和近白的冰块、浅蓝的地面形成三级色阶。"""
    g = grid(32, 32)
    rect(g, 0, 0, 31, 31, 'd')          # 外圈背光
    rect(g, 1, 1, 30, 30, 'a')          # 柱身主色（中蓝）
    # 左右两侧逐层收暗 → 圆柱感
    for y in range(1, 31):
        g[y][1] = 'd'
        g[y][2] = 'b'
        g[y][29] = 'b'
        g[y][30] = 'd'
    # 中段竖向受光带
    for y in range(4, 29):
        g[y][10] = 'c'
        g[y][11] = 'c'
    # 顶部受光台面
    fill(g, 2, 3, 29, 'e')
    fill(g, 3, 4, 28, 'c')
    fill(g, 5, 2, 29, 'b')
    # 台面下的一道暗棱（把顶和柱身分开）
    fill(g, 6, 3, 28, 'd')
    # 底部最深收口 + 一点地面反光
    fill(g, 28, 2, 29, 'k')
    fill(g, 29, 3, 28, 'k')
    coords(g, [(13, 29), (14, 29), (17, 29), (18, 29)], 'd')
    # 柱身噪点（冰的杂质）
    for y in range(7, 28):
        for x in range(4, 28):
            if noise(x, y, 41) < 6:
                g[y][x] = 'b'
    # 内描边，别让柱子糊到隔壁格
    outline(g, 'k', diag=False)
    return g, ICEP


def prop_ice_block():
    """冰块：近白立方体 —— 顶面最亮、正面中亮、右下压暗，深蓝粗描边。
       描边落在格子最外圈，所以密集摆开时会连成一堵冰墙。"""
    g = grid(32, 32)
    # 正面主体
    rect(g, 1, 7, 30, 30, 'b')
    # 顶面：往上收的斜台
    shape(g, [(1, 15, 26), (2, 12, 28), (3, 10, 29), (4, 8, 30), (5, 7, 30), (6, 7, 30)], 'c')
    # 正面左亮右暗
    for y in range(7, 31):
        g[y][1] = 'c'
        g[y][2] = 'b'
        g[y][29] = 'd'
        g[y][30] = 'd'
    # 顶棱亮线（正面与顶面的转折）
    fill(g, 7, 2, 29, 'c')
    fill(g, 8, 2, 29, 'b')
    # 正面一条竖向高光
    for y in range(10, 27):
        g[y][5] = 'c'
        g[y][6] = 'c'
    # 顶面左上白斜条
    for i in range(6):
        coords(g, [(4 + i, 9 + i), (5 + i, 9 + i)], 'w')
    # 内部气泡
    for (x, y) in [(11, 20), (12, 21), (21, 25), (23, 15)]:
        coords(g, [(x, y), (x + 1, y)], 'c')
    # 右下背光
    fill(g, 26, 18, 29, 'd')
    fill(g, 29, 16, 29, 'd')
    # 描边画在最外圈（0 / 31），正好占满整格
    outline(g, 'k', diag=False)
    return g, ICEB


def prop_ice_chest():
    """冰宝箱：圆顶拱盖 + 深色开口露两颗蓝宝石 + 窄冰锁扣 + 箱体那对圆眼睛"""
    g = grid(32, 32)
    # 箱体（中间调）
    rect(g, 2, 14, 29, 29, 'b')
    # 圆顶拱盖
    shape(g, [(2, 13, 18), (3, 11, 20), (4, 9, 22), (5, 8, 23), (6, 6, 25),
              (7, 5, 26), (8, 4, 27), (9, 3, 28), (10, 2, 29), (11, 2, 29),
              (12, 2, 29), (13, 2, 29)], 'a')
    # 盖面受光（左上）
    shape(g, [(2, 14, 17), (3, 12, 19), (4, 10, 21), (5, 9, 22), (6, 7, 24)], 'c')
    coords(g, [(12, 3), (13, 3), (11, 4), (12, 4), (10, 5), (9, 6), (8, 7), (7, 8)], 'w')
    # 盖中缝
    for y in range(2, 14):
        if g[y][15] != '.':
            g[y][15] = 'd'
        if g[y][16] != '.':
            g[y][16] = 'f'
    # 深色开口
    fill(g, 12, 3, 28, 'n')
    fill(g, 13, 4, 27, 'm')
    # 两颗蓝宝石（尖朝上，从开口冒出来）
    for cx in (8, 23):
        for (dy, x0, x1) in [(9, cx, cx), (10, cx - 1, cx + 1), (11, cx - 2, cx + 2),
                             (12, cx - 1, cx + 1), (13, cx, cx)]:
            fill(g, dy, x0, x1, 'm')
        coords(g, [(cx, 9), (cx - 2, 11), (cx + 2, 11), (cx, 13)], 'n')
        coords(g, [(cx - 1, 10), (cx - 1, 11), (cx, 11)], 'N')
        coords(g, [(cx, 10)], 'w')
    # 窄冰锁扣
    rect(g, 13, 11, 18, 18, 'c')
    frame(g, 13, 11, 18, 18, 'n')
    fill(g, 12, 14, 17, 'f')
    coords(g, [(15, 13), (16, 13), (15, 14), (16, 14)], 'n')
    coords(g, [(14, 12), (15, 12)], 'w')
    # 箱体竖棱 + 底沿
    for y in range(19, 30):
        g[y][15] = 'f'
        g[y][16] = 'a'
    fill(g, 19, 3, 28, 'a')
    fill(g, 29, 2, 29, 'e')
    # 眼睛：4×4 近黑 + 左上白点
    for ex in (5, 22):
        rect(g, ex, 20, ex + 3, 23, 'x')
        coords(g, [(ex, 20)], 'w')
    outline(g, 'k', diag=False)
    return g, ICEB


def prop_snowman():
    """小雪人：两个雪球 + 胡萝卜鼻 + 蓝围巾 + 树枝手"""
    g = grid(32, 32)
    # 树枝手先画，压在身体后面
    for (x0, y0, x1, y1) in [(10, 20, 3, 15), (21, 20, 28, 15)]:
        line(g, x0, y0, x1, y1, 'n')
    line(g, 5, 17, 2, 19, 'n')
    line(g, 26, 17, 29, 19, 'n')
    # 身体 + 头
    disc(g, 15.5, 22.5, 9.0, 'w')
    disc(g, 15.5, 10.5, 7.0, 'w')
    # 暗面（右下）
    for y in range(14, 32):
        for x in range(16, 32):
            d = math.hypot(x - 15.5, y - 22.5)
            if 8.2 <= d <= 9.2:
                g[y][x] = 'b'
    for y in range(4, 18):
        for x in range(16, 32):
            d = math.hypot(x - 15.5, y - 10.5)
            if 6.2 <= d <= 7.2:
                g[y][x] = 'b'
    outline(g, 'k')
    # 眼睛
    coords(g, [(12, 9), (13, 9), (12, 10), (13, 10)], 'k')
    coords(g, [(18, 9), (19, 9), (18, 10), (19, 10)], 'k')
    coords(g, [(13, 9), (18, 9)], SNOW['c'])
    # 胡萝卜鼻
    coords(g, [(16, 11), (17, 11), (18, 11), (19, 11)], 'o')
    coords(g, [(16, 12), (17, 12), (18, 12)], 'O')
    coords(g, [(19, 11)], 'O')
    # 围巾
    fill(g, 16, 9, 22, 's')
    fill(g, 17, 9, 22, 'S')
    fill(g, 18, 12, 22, 's')
    coords(g, [(9, 16), (9, 17), (9, 18)], 'S')
    # 飘带
    coords(g, [(22, 19), (23, 19), (23, 20), (24, 20), (24, 21), (25, 21)], 's')
    coords(g, [(22, 20), (23, 20), (24, 21)], 'S')
    # 纽扣
    for y in (21, 24, 27):
        coords(g, [(15, y), (16, y)], 'k')
        coords(g, [(15, y)], 'c')
    # 头顶高光
    coords(g, [(12, 5), (13, 5), (12, 6), (13, 6), (14, 4), (11, 7)], 'w')
    return g, SNOW


# ------------------------------------------------------------------ 纯色方块（可炸 · 不可推动）
# 两种纯色块共用一个造型，只换配色：整格实心 + 顶面亮带 + 右下压暗，不带任何纹理，
# 跟有木纹 / 有 X 加固的木箱一眼分得开。
BLOCK_R = {'k': '#4E1109', 'a': '#C13A2B', 'b': '#E0684F', 'c': '#8B2417', 'w': '#F7A68C'}
BLOCK_V = {'k': '#2C1449', 'a': '#7C4CC4', 'b': '#A97FE2', 'c': '#4E2C85', 'w': '#CFB0F3'}


def _pure_block(pal):
    g = grid(32, 32)
    rect(g, 1, 1, 30, 30, 'a')                       # 主色铺满整格
    rect(g, 1, 1, 30, 7, 'b')                        # 顶面（受光）
    fill(g, 8, 2, 29, 'b')                           # 顶面与正面的转折棱
    for y in range(1, 31):
        g[y][1] = 'b' if y <= 8 else 'a'             # 左缘提亮
        g[y][30] = 'c'                               # 右缘压暗
    fill(g, 29, 1, 30, 'c')                          # 底沿（背光）
    fill(g, 30, 1, 30, 'c')
    coords(g, [(4, 3), (5, 3), (4, 4), (5, 4)], 'w')  # 左上角一点高光
    frame(g, 0, 0, 31, 31, 'k')
    return g, pal


def prop_block_red():
    """纯色方块 · 朱红：可炸，不可推动"""
    return _pure_block(BLOCK_R)


def prop_block_violet():
    """纯色方块 · 紫晶：可炸，不可推动"""
    return _pure_block(BLOCK_V)


# ------------------------------------------------------------------ 雪块（可炸 · 可推动）
# 哑光软雪砖：圆角、带一枚雪花印。跟冰块的区别是——冰块是光面硬立方（深蓝描边 +
# 正面竖高光），雪块没有高光，边是圆的，中间压一枚雪花。
SNOWB = {'k': '#5E7A96', 'a': '#E3EDF6', 'b': '#F8FCFF', 'c': '#C2D4E6',
         'd': '#A6BED4', 'w': '#FFFFFF'}


def prop_snow_block():
    g = grid(32, 32)
    rect(g, 1, 1, 30, 30, 'a')
    # 顶面：微微起伏的一层新雪
    for x in range(1, 31):
        top = 8 + int(round(1.3 * math.sin((x + 2) / 4.6)))
        for y in range(1, top + 1):
            g[y][x] = 'b'
    # 右下背光（哑光，所以只压一档，不做硬边）
    for y in range(9, 31):
        g[y][30] = 'c'
        g[y][29] = 'c' if y > 24 else g[y][29]
    fill(g, 29, 20, 30, 'd')
    fill(g, 30, 1, 30, 'd')
    # 圆角：四个角各削掉一小块，轮廓才软
    for (x, y) in [(1, 1), (2, 1), (1, 2), (30, 1), (29, 1), (30, 2),
                   (1, 30), (2, 30), (1, 29), (30, 30), (29, 30), (30, 29)]:
        g[y][x] = '.'
    # 正面一枚雪花印（雪块唯一的花纹）
    _flake(g, 16, 20, 3, 'c')
    coords(g, [(16, 20)], 'd')
    # 几粒雪屑
    coords(g, [(6, 13), (24, 16), (10, 26), (22, 26)], 'w')
    outline(g, 'k')
    return g, SNOWB


# ------------------------------------------------------------------ 组装表
MAP_ASSETS = [
    ('tile-sand', tile_sand, '沙地 · 32×32 无缝'),
    ('tile-temple', tile_temple, '神殿石砖 · 32×32'),
    ('tile-carpet', tile_carpet, '红色地毯 · 32×32'),
    ('tile-carpet-emblem', tile_carpet_emblem, '红色地毯 · 中心徽章'),
    ('tile-carpet-astral', tile_carpet_astral, '红色地毯 · 占星环'),
    ('tile-carpet-vortex', tile_carpet_vortex, '红色地毯 · 漩涡火'),
    ('tile-carpet-rune', tile_carpet_rune, '红色地毯 · 魔法纹'),
    ('wall-stone', tile_wall, '古石墙 · 32×32'),
    ('wall-pillar', tile_pillar, '雕纹石柱 · 32×32'),
    ('prop-amphora', prop_amphora, '彩陶罐 · 32×32'),
    ('prop-crate', prop_crate, '木箱 · 32×32'),
    ('prop-chest', prop_chest, '金宝箱 · 32×32'),
    # ---- 冰面主题 ----
    ('tile-ice', tile_ice, '冰地砖 · 32×32'),
    ('tile-ice-snow', tile_ice_snow, '冰地砖 · 雪花'),
    ('wall-icebrick', tile_wall_ice, '冰砖墙 · 32×32'),
    ('wall-icepillar', tile_ice_pillar, '冰柱 · 32×32'),
    ('prop-iceblock', prop_ice_block, '冰块 · 32×32'),
    ('prop-icechest', prop_ice_chest, '冰宝箱 · 32×32'),
    ('prop-snowman', prop_snowman, '小雪人 · 32×32'),
    # ---- 新增障碍：两种纯色方块 + 可推动的雪块 ----
    ('prop-block-red', prop_block_red, '纯色方块 · 朱红 · 32×32'),
    ('prop-block-violet', prop_block_violet, '纯色方块 · 紫晶 · 32×32'),
    ('prop-snowblock', prop_snow_block, '雪块 · 32×32'),
]
