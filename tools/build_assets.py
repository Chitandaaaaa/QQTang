# -*- coding: utf-8 -*-
"""
QQ糖 · 像素风素材生成器 v2
- 手绘点阵 -> 真正的 .svg（rect 横向合批，透明底，crispEdges）
- 可导出 PNG / ASCII 点阵校验
运行：
  python build_assets.py            # 生成 assets/*.svg
  python build_assets.py ascii      # 打印点阵
"""
import os, sys, zlib, struct

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)
OUT = os.path.join(DESIGN, "assets")

# ---------------------------------------------------------------- 调色板
PAL = {
    'k': '#2A1B33',   # 描边
    'h': '#FF7BA8',   # 头发（草莓冻）
    'H': '#FFB0CB',   # 头发高光
    'd': '#D24B7D',   # 头发暗部
    's': '#FFE3C2',   # 皮肤
    'S': '#EFB893',   # 皮肤暗部
    'e': '#2A1B33',   # 眼睛
    'w': '#FFFFFF',   # 高光
    'b': '#FF9CBB',   # 腮红
    'c': '#63DFC0',   # 上衣（薄荷）
    'C': '#A9F1DE',   # 上衣亮部
    'x': '#2FA98F',   # 上衣暗部
    'p': '#3C3163',   # 裤子
    'P': '#2A2148',   # 裤子暗部
    'f': '#FFFDF7',   # 鞋
    'F': '#D7DBEE',   # 鞋底
    'n': '#FFD166',   # 奶油 / 蝴蝶结
    'o': '#FF9E3D',   # 蝴蝶结结心 / 火花
    'r': '#FF5E86',   # 糖弹主体
    'R': '#FF9EB6',   # 糖弹亮部
    'q': '#C43A63',   # 糖弹暗部
    'u': '#8C5A3C',   # 引线
}

W = 32


def grid(w=W, h=W):
    return [['.'] * w for _ in range(h)]


def put(g, y, x, text):
    for i, ch in enumerate(text):
        g[y][x + i] = ch


def band(g, y, x0, x1, fill):
    for x in range(x0, x1 + 1):
        g[y][x] = 'k'
    for x in range(x0 + 1, x1):
        g[y][x] = fill


def fill(g, y, x0, x1, ch):
    for x in range(x0, x1 + 1):
        g[y][x] = ch


def coords(g, pts, ch):
    for x, y in pts:
        g[y][x] = ch


CH_H = 48   # 糖豆与塞尔达/林克同规格：32×48 一格半高
            # 二头身：头（含蝴蝶结）22 行 + 身子 26 行，腿只露 4 行，鞋加厚


def body_front(g):
    """上衣 / 短裤 / 腿 / 鞋（正面 & 背面共用）—— 二头身短腿版"""
    for y in range(22, 28):
        band(g, y, 7, 24, 'c')          # 肩线 + 连袖
        g[y][10] = 'k'                  # 袖缝
        g[y][21] = 'k'
    band(g, 28, 9, 22, 'c')
    band(g, 29, 10, 21, 'c')
    band(g, 28, 7, 8, 's')              # 手
    band(g, 29, 7, 8, 's')
    band(g, 28, 23, 24, 's')
    band(g, 29, 23, 24, 's')
    # 短裤
    band(g, 30, 10, 21, 'p')
    for y in range(31, 36):
        band(g, y, 10, 14, 'p')
        band(g, y, 17, 21, 'p')
        g[y][15] = 'k'
        g[y][16] = 'k'
    coords(g, [(11, 35), (14, 35), (17, 35), (20, 35)], 'P')
    # 小短腿
    for y in range(36, 40):
        band(g, y, 11, 13, 's')
        band(g, y, 18, 20, 's')
    # 厚底鞋
    for y in range(40, 46):
        band(g, y, 9, 14, 'f')
        band(g, y, 17, 22, 'f')
    band(g, 46, 9, 14, 'F')
    band(g, 46, 17, 22, 'F')
    band(g, 47, 9, 14, 'F')
    band(g, 47, 17, 22, 'F')


# ---------------------------------------------------------------- 正面
def front():
    g = grid(W, CH_H)
    # 头顶蝴蝶结（双环 + 橙色结心）
    band(g, 1, 10, 21, 'n')
    coords(g, [(14, 1), (15, 1), (16, 1), (17, 1)], 'o')
    band(g, 2, 9, 22, 'n')
    coords(g, [(14, 2), (15, 2), (16, 2), (17, 2)], 'o')
    band(g, 3, 10, 21, 'n')
    coords(g, [(14, 3), (15, 3), (16, 3), (17, 3)], 'o')
    # 头（大了一圈）
    band(g, 4, 11, 20, 'h')
    band(g, 5, 10, 21, 'h')
    band(g, 6, 9, 22, 'h')
    band(g, 7, 8, 23, 'h')
    band(g, 8, 7, 24, 'h')
    band(g, 9, 6, 25, 'h')
    band(g, 10, 5, 26, 'h')
    band(g, 11, 5, 26, 'h')             # 刘海整排
    band(g, 12, 5, 26, 'h')             # 刘海第二排（压住额头）
    for y in range(13, 19):
        band(g, y, 5, 26, 'h')
        fill(g, y, 8, 23, 's')
    band(g, 19, 5, 26, 'h')
    fill(g, 19, 9, 22, 's')
    band(g, 20, 5, 26, 'h')
    fill(g, 20, 13, 18, 's')
    coords(g, [(7, 21), (24, 21)], 'h')     # 侧发梢
    coords(g, [(6, 21), (8, 21), (23, 21), (25, 21)], 'k')
    body_front(g)
    # —— 头发明暗 ——
    coords(g, [(14, 4), (15, 4), (12, 5), (13, 5), (14, 5), (10, 6), (11, 6),
               (12, 6), (9, 7), (10, 7), (11, 7), (8, 8), (9, 8), (7, 9),
               (8, 9), (6, 10), (7, 10), (6, 11)], 'H')
    coords(g, [(18, 5), (19, 5), (20, 6), (21, 6), (21, 7), (22, 7),
               (22, 8), (23, 9)], 'H')
    coords(g, [(9, 13), (10, 13), (13, 13), (14, 13), (17, 13), (18, 13),
               (21, 13), (22, 13)], 'd')            # 刘海锯齿
    coords(g, [(7, 14), (7, 15), (7, 16), (24, 14), (24, 15), (24, 16)], 'H')
    coords(g, [(6, 18), (6, 19), (25, 18), (25, 19)], 'd')
    # 眼睛（2×4 圆角 + 高光）
    coords(g, [(11, 14), (12, 14), (11, 15), (12, 15), (11, 16), (12, 16),
               (11, 17), (12, 17),
               (19, 14), (20, 14), (19, 15), (20, 15), (19, 16), (20, 16),
               (19, 17), (20, 17)], 'e')
    coords(g, [(11, 15), (20, 15)], 'w')
    # 腮红 / 嘴
    coords(g, [(9, 18), (10, 18), (21, 18), (22, 18)], 'b')
    coords(g, [(15, 19), (16, 19)], 'k')
    # 上衣细节
    coords(g, [(14, 23), (15, 23), (16, 23), (17, 23)], 'C')
    coords(g, [(15, 24), (16, 24), (15, 25), (16, 25)], 'C')
    coords(g, [(20, 26), (20, 27)], 'x')
    coords(g, [(23, 29)], 'S')
    return g


# ---------------------------------------------------------------- 侧面（朝右）
def side():
    g = grid(W, CH_H)
    # 蝴蝶结（偏向脑后）
    band(g, 1, 11, 20, 'n')
    coords(g, [(14, 1), (15, 1), (16, 1), (17, 1)], 'o')
    band(g, 2, 10, 21, 'n')
    coords(g, [(14, 2), (15, 2), (16, 2), (17, 2)], 'o')
    band(g, 3, 11, 20, 'n')
    coords(g, [(14, 3), (15, 3), (16, 3), (17, 3)], 'o')
    # 头
    band(g, 4, 12, 20, 'h')
    band(g, 5, 10, 22, 'h')
    band(g, 6, 9, 23, 'h')
    band(g, 7, 8, 24, 'h')
    band(g, 8, 7, 24, 'h')
    band(g, 9, 7, 24, 'h')
    band(g, 10, 7, 24, 'h')
    band(g, 11, 7, 24, 'h')             # 刘海整排
    band(g, 12, 7, 24, 'h')             # 刘海第二排
    for y in range(13, 19):
        band(g, y, 7, 24, 'h')
        fill(g, y, 14, 23, 's')
    band(g, 19, 7, 24, 'h')
    fill(g, 19, 16, 23, 's')
    band(g, 20, 7, 24, 'h')
    fill(g, 20, 18, 22, 's')
    band(g, 21, 8, 22, 'h')
    fill(g, 21, 19, 21, 's')
    body_front(g)
    # 侧向下身：抹掉正面对称腿，改画走路步（前脚落地、后脚微抬）
    for y in range(28, CH_H):
        g[y][:] = ['.'] * W
    band(g, 28, 9, 22, 'c')             # 衣摆
    band(g, 29, 10, 21, 'c')
    band(g, 28, 19, 21, 's')            # 前手
    band(g, 29, 19, 21, 's')
    # 短裤
    band(g, 30, 12, 22, 'p')
    for y in range(31, 34):
        band(g, y, 12, 16, 'p')
        band(g, y, 18, 22, 'p')
        g[y][17] = 'k'
    coords(g, [(12, 34), (16, 34), (18, 34), (22, 34)], 'P')
    for y in range(35, 39):             # 后腿（微抬）
        band(g, y, 13, 15, 's')
    for y in range(35, 41):             # 前腿（落地）
        band(g, y, 19, 21, 's')
    for y in range(39, 43):             # 后鞋
        band(g, y, 10, 16, 'f')
    band(g, 43, 10, 16, 'F')
    band(g, 44, 10, 16, 'F')
    for y in range(41, 46):             # 前鞋
        band(g, y, 18, 23, 'f')
    band(g, 46, 18, 23, 'F')
    band(g, 47, 18, 23, 'F')
    # —— 头发明暗 ——
    coords(g, [(13, 4), (14, 4), (11, 5), (12, 5), (13, 5), (10, 6), (11, 6),
               (9, 7), (10, 7), (8, 8), (9, 8), (8, 9)], 'H')
    coords(g, [(19, 5), (20, 5), (21, 6), (22, 6), (22, 7), (23, 8)], 'H')
    coords(g, [(15, 13), (16, 13), (19, 13), (22, 13)], 'h')    # 刘海锯齿
    coords(g, [(7, 13), (7, 14), (7, 15), (7, 16), (7, 17)], 'd')
    # 鼻子 / 嘴
    coords(g, [(24, 16), (24, 17)], 's')
    coords(g, [(25, 16), (25, 17)], 'k')
    coords(g, [(21, 19), (22, 19)], 'k')
    # 眼睛 / 腮红
    coords(g, [(19, 14), (20, 14), (19, 15), (20, 15), (19, 16), (20, 16),
               (19, 17), (20, 17)], 'e')
    coords(g, [(20, 15)], 'w')
    coords(g, [(16, 18), (17, 18)], 'b')
    # 上衣细节
    coords(g, [(13, 24), (14, 24), (13, 25)], 'C')
    coords(g, [(12, 26), (12, 27)], 'x')
    coords(g, [(20, 29)], 'S')
    # 袖缝（侧面手臂在身前，用一道缝切开）
    for y in range(23, 28):
        g[y][18] = 'k'
    return g


# ---------------------------------------------------------------- 背面
def back():
    g = grid(W, CH_H)
    # 头顶蝴蝶结（结心朝后）
    band(g, 1, 10, 21, 'n')
    coords(g, [(14, 1), (15, 1), (16, 1), (17, 1)], 'o')
    band(g, 2, 9, 22, 'n')
    coords(g, [(14, 2), (15, 2), (16, 2), (17, 2)], 'o')
    band(g, 3, 10, 21, 'n')
    coords(g, [(14, 3), (15, 3), (16, 3), (17, 3)], 'o')
    # 头（后脑整片）
    band(g, 4, 11, 20, 'h')
    band(g, 5, 10, 21, 'h')
    band(g, 6, 9, 22, 'h')
    band(g, 7, 8, 23, 'h')
    band(g, 8, 7, 24, 'h')
    band(g, 9, 6, 25, 'h')
    for y in range(10, 21):
        band(g, y, 5, 26, 'h')
    band(g, 21, 6, 25, 'h')
    band(g, 22, 9, 22, 'h')
    body_front(g)
    # —— 头发明暗 ——
    coords(g, [(11, 5), (12, 5), (13, 5), (10, 6), (11, 6), (12, 6),
               (9, 7), (10, 7), (8, 8), (9, 8), (7, 9), (8, 9), (6, 10)], 'H')
    coords(g, [(19, 6), (20, 6), (21, 7), (22, 7), (22, 8), (23, 9),
               (23, 10)], 'H')
    coords(g, [(7, 14), (7, 15), (7, 16), (24, 14), (24, 15), (24, 16)], 'd')
    coords(g, [(11, 18), (11, 19), (20, 18), (20, 19)], 'd')
    # 后脑垂下的缎带
    coords(g, [(13, 12), (14, 12), (17, 12), (18, 12),
               (13, 13), (14, 13), (17, 13), (18, 13),
               (13, 14), (18, 14)], 'n')
    coords(g, [(15, 13), (16, 13)], 'o')
    coords(g, [(13, 15), (14, 15), (17, 15), (18, 15)], 'o')
    # 连帽（背面垂下的帽边）
    coords(g, [(13, 23), (14, 23), (15, 23), (16, 23), (17, 23), (18, 23)], 'C')
    coords(g, [(14, 24), (15, 24), (16, 24), (17, 24)], 'C')
    coords(g, [(20, 26), (20, 27)], 'x')
    coords(g, [(23, 29)], 'S')
    return g


# ---------------------------------------------------------------- 炮弹 24x24
BW = 24


def bomb():
    g = grid(BW, BW)
    rows = {6: (7, 15), 7: (6, 16), 8: (5, 17), 9: (4, 18), 10: (4, 18),
            11: (3, 19), 12: (3, 19), 13: (3, 19), 14: (3, 19), 15: (3, 19),
            16: (4, 18), 17: (4, 18), 18: (5, 17), 19: (6, 16), 20: (7, 15)}
    for y, (x0, x1) in rows.items():
        band(g, y, x0, x1, 'r')
    # 引线
    coords(g, [(12, 5), (13, 4), (14, 3), (15, 2), (16, 2)], 'u')
    # 火花
    coords(g, [(17, 0), (16, 1), (18, 1), (17, 2)], 'o')
    coords(g, [(17, 1)], 'w')
    # 左上高光
    coords(g, [(7, 7), (8, 7), (6, 8), (7, 8), (5, 9), (6, 9)], 'R')
    coords(g, [(7, 9), (8, 9), (7, 10)], 'w')
    # 右下暗部
    coords(g, [(17, 14), (17, 15), (16, 16), (16, 17), (15, 18)], 'q')
    coords(g, [(12, 19), (13, 19)], 'R')
    return g


SPRITES = [
    ('tangdou-front', front, '糖豆 · 正面'),
    ('tangdou-side', side, '糖豆 · 侧面'),
    ('tangdou-back', back, '糖豆 · 背面'),
]


# ---------------------------------------------------------------- 输出
def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_svg(g, name="", comment=""):
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
            parts.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"/>'
                         % (x, y, x2 - x + 1, PAL[ch]))
            x = x2 + 1
    body = "\n  ".join(parts)
    head = '<!-- %s -->\n' % comment if comment else ''
    return (head +
            '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d" shape-rendering="crispEdges">\n'
            '<title>%s</title>\n  %s\n</svg>\n' % (w, h, w, h, name, body))


def write_png(path, g, scale=8, bg=(251, 243, 228)):
    h, w = len(g), len(g[0])
    raw = bytearray()
    for row in g:
        line = bytearray()
        for ch in row:
            line += bytes(bg if ch == '.' else hex2rgb(PAL[ch])) + b'\xff'
        for _ in range(scale):
            raw += b'\x00' + bytes(line)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w * scale, h * scale, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def ascii_dump(g, title):
    print('\n== %s  (%dx%d) ==' % (title, len(g[0]), len(g)))
    print('    ' + ''.join(str(x % 10) for x in range(len(g[0]))))
    for y, row in enumerate(g):
        print('%3d ' % y + ''.join(row).replace('.', ' '))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'ascii':
        for key, fn, label in SPRITES:
            ascii_dump(fn(), label)
        return
    os.makedirs(OUT, exist_ok=True)
    for key, fn, label in SPRITES:
        svg = to_svg(fn(), label, 'QQ糖 · %s · 像素素材（透明底）' % label)
        open(os.path.join(OUT, key + '.svg'), 'w', encoding='utf-8').write(svg)
        print('%-16s %5d bytes' % (key + '.svg', len(svg)))


if __name__ == '__main__':
    main()
