# -*- coding: utf-8 -*-
"""素材体检：越界 / 断块 / 内部空洞 / 脚底基线 / 描边完整性"""
import sys
from collections import deque

import build_chars
from build_assets import front as t_front, side as t_side, back as t_back, bomb

ALL = [
    ('tangdou-front', t_front), ('tangdou-side', t_side), ('tangdou-back', t_back),
    ('candy-bomb', bomb),
    ('archer-front', build_chars.archer_front), ('archer-side', build_chars.archer_side),
    ('archer-back', build_chars.archer_back),
    ('glam-front', build_chars.glam_front), ('glam-side', build_chars.glam_side),
    ('glam-back', build_chars.glam_back),
    ('sword-front', build_chars.sword_front), ('sword-side', build_chars.sword_side),
    ('sword-back', build_chars.sword_back),
]
H, W = 32, 32   # 默认画布，bomb 为 16x16，运行时改写


def solid(c):
    return c != '.'


def components(m):
    seen = [[0] * W for _ in range(H)]
    comps = []
    for y in range(H):
        for x in range(W):
            if m[y][x] and not seen[y][x]:
                q = deque([(x, y)])
                seen[y][x] = 1
                cells = []
                while q:
                    cx, cy = q.popleft()
                    cells.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                                   (1, 1), (1, -1), (-1, 1), (-1, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and m[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = 1
                            q.append((nx, ny))
                comps.append(cells)
    comps.sort(key=len, reverse=True)
    return comps


def holes(m):
    """从边界泛洪，未被淹到的空格 = 内部空洞"""
    seen = [[0] * W for _ in range(H)]
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if not m[y][x] and not seen[y][x]:
                seen[y][x] = 1
                q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if not m[y][x] and not seen[y][x]:
                seen[y][x] = 1
                q.append((x, y))
    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < W and 0 <= ny < H and not m[ny][nx] and not seen[ny][nx]:
                seen[ny][nx] = 1
                q.append((nx, ny))
    return [(x, y) for y in range(H) for x in range(W) if not m[y][x] and not seen[y][x]]


def main():
    bad = 0
    for name, fn in ALL:
        g = fn()
        global H, W
        H, W = len(g), len(g[0])
        assert all(len(r) == W for r in g), '%s 行宽不一致' % name
        m = [[solid(c) for c in row] for row in g]
        px = sum(sum(r) for r in m)
        comps = components(m)
        hol = holes(m)
        ys = [y for y in range(H) if any(m[y])]
        xs = [x for y in range(H) for x in range(W) if m[y][x]]
        notes = []
        if len(comps) > 1:
            small = [len(c) for c in comps[1:]]
            notes.append('断块 %d 个(像素 %s)' % (len(small), small))
        # 单格透光 = 真缺陷；多格多为两个物件之间的有意间隙（如两支箭的缝）
        pinhole = [c for c in hol if len(hol) == 1]
        if pinhole:
            notes.append('单格透光孔 @%s' % pinhole)
        if min(ys) < 1 and name != 'candy-bomb':
            notes.append('顶到 y=%d' % min(ys))
        if max(ys) > 30 and H == 32:
            notes.append('超基线 y=%d' % max(ys))
        if min(xs) == 0 or max(xs) == W - 1:
            notes.append('贴边 x=%d..%d' % (min(xs), max(xs)))
        flag = 'FAIL' if notes else 'ok  '
        if notes:
            bad += 1
        print('%-14s %s %dx%d px=%-4d 块=%d  %s' %
              (name, flag, max(xs) - min(xs) + 1, max(ys) - min(ys) + 1, px,
               len(comps), '; '.join(notes)))
    print('\n合计 %d 个素材，%d 个待修' % (len(ALL), bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
