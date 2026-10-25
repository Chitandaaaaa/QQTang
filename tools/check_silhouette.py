# -*- coding: utf-8 -*-
"""剪影校验：包围盒 / 像素数 / 两两 IoU / 每行左右宽度轮廓"""
import sys
import build_chars
from build_assets import front as tang_front, side as tang_side, back as tang_back

SETS = {
    '糖豆':   (tang_front, tang_side, tang_back),
    '青羽':   (build_chars.archer_front, build_chars.archer_side, build_chars.archer_back),
    '夜蔷薇': (build_chars.glam_front, build_chars.glam_side, build_chars.glam_back),
    '银霜':   (build_chars.sword_front, build_chars.sword_side, build_chars.sword_back),
}


def mask(g):
    return [[1 if c != '.' else 0 for c in row] for row in g]


def stats(m):
    ys = [y for y in range(len(m)) if any(m[y])]
    xs = [x for y in range(len(m)) for x in range(len(m[y])) if m[y][x]]
    cnt = sum(sum(r) for r in m)
    return (min(xs), max(xs), min(ys), max(ys), cnt)


def iou(a, b):
    inter = union = 0
    for y in range(len(a)):
        for x in range(len(a[y])):
            p, q = a[y][x], b[y][x]
            if p and q:
                inter += 1
            if p or q:
                union += 1
    return inter / union if union else 0


def profile(m, y0, y1):
    out = []
    for y in range(y0, y1 + 1):
        xs = [x for x in range(len(m[y])) if m[y][x]]
        out.append('%2d %s' % (y, '%2d-%2d w=%2d' % (min(xs), max(xs), max(xs) - min(xs) + 1) if xs else '   --'))
    return out


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else 'front'
    idx = {'front': 0, 'side': 1, 'back': 2}[which]
    masks = {}
    print('\n===== %s 剪影 =====' % which)
    for name, fns in SETS.items():
        m = mask(fns[idx]())
        masks[name] = m
        x0, x1, y0, y1, cnt = stats(m)
        print('%-6s 包围盒 %2dx%-2d (%d..%d, %d..%d)  像素 %d' %
              (name, x1 - x0 + 1, y1 - y0 + 1, x0, x1, y0, y1, cnt))
    names = list(masks)
    print('\n--- IoU ---')
    worst = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            v = iou(masks[names[i]], masks[names[j]])
            flag = '  <== 过高' if v > 0.85 else ''
            print('%-6s vs %-6s IoU=%.2f%s' % (names[i], names[j], v, flag))
            worst.append(v)
    print('\n--- 行宽轮廓 ---')
    for name, m in masks.items():
        print('\n[%s]' % name)
        for line in profile(m, 18, 30):
            print('  ' + line)


if __name__ == '__main__':
    main()
