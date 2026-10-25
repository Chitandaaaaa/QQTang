# -*- coding: utf-8 -*-
"""炮弹导出：把 sucai_bombs 的 9 种糖弹写成 32×32 实装弹体 SVG。
运行：python build_bombs.py
- 32×32 实装弹体 -> assets/sucai/（游戏用，撑满整格；build_game.py 从这里打包）
口味定义只在 sucai_bombs.FLAVORS 一处，这里只负责导出成文件。
"""
import os

from sucai_lib import to_svg
import sucai_bombs as BB

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)
GAME_SVG = os.path.join(DESIGN, "assets", "sucai")


def export(items, size, out=GAME_SVG):
    total = 0
    for key, fn, label in items:
        g, p = fn()
        svg = to_svg(g, p, '%s · %s' % (label, key),
                     'QQ糖 · %s · %s（透明底）' % (label, size))
        with open(os.path.join(out, key + '.svg'), 'w', encoding='utf-8') as f:
            f.write(svg)
        total += len(svg)
        print('%-40s %5d bytes  %s' % (os.path.relpath(
            os.path.join(out, key + '.svg'), DESIGN), len(svg), label))
    return total


def main():
    os.makedirs(GAME_SVG, exist_ok=True)
    t = export(BB.BOMB32_ASSETS, '32×32')
    print('\n共 %d 件，合计 %d bytes' % (len(BB.BOMB32_ASSETS), t))


if __name__ == '__main__':
    main()
