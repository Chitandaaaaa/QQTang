# -*- coding: utf-8 -*-
"""QQ糖 v2 · 数据管线

    python tools/build_v2.py

v2 的页面（v2/index.html、v2/gallery.html）是纯静态多文件结构，没有打包步骤；
本脚本只负责把像素素材与地图数据生成为页面引用的 js 数据文件：

    data/sprites.js       游戏 51 个素材 data URI   -> window.QQ_SPRITES
    data/maps.js          内置地图（tools/maps/*.json）-> window.QQ_BUILTIN_MAPS
    data/tags.js          障碍标签表                -> window.QQ_OBSTACLE_TAGS
    data/gallery-data.js  素材库（分类+素材+组合样张）-> window.QQ_GALLERY
    data/spec-data.js     人物规格（四角色三视图）   -> window.QQ_SPEC

同时刷新 assets/sucai/*.svg 与 _scene.svg（素材库与游戏的共同来源）。
改像素素材定义（tools/sucai_*.py、build_chars.py）或地图 JSON 后重跑本脚本；
改 logo 单独跑 tools/sucai_logo.py。
"""
import base64
import glob
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import asset_db     # noqa: E402
import spec_db      # noqa: E402
import obstacle_tags  # noqa: E402
from sucai_lib import DESIGN  # noqa: E402

V2 = os.path.join(os.path.dirname(HERE), 'v2')
DATA = os.path.join(V2, 'data')
SVG_DIR = os.path.join(DESIGN, 'assets', 'sucai')
MAPS_DIR = os.path.join(HERE, 'maps')

# 游戏实际用到的素材（游戏弹体必须是 32×32 满格版）
SPRITES = [
    "zelda-front", "zelda-side", "zelda-back",
    "link-front", "link-side", "link-back",
    "bomb", "boom-cell",
    # ---- 炮弹口味（sucai_bombs.FLAVORS，游戏 08-player.js 同名引用）----
    "candy-bomb", "bomb-mint", "bomb-choco", "bomb-lemon", "bomb-grape",
    "bomb-soda", "bomb-melon", "bomb-gold", "bomb-rainbow",
    "boom-cell-strawberry", "boom-cell-mint", "boom-cell-choco",
    "boom-cell-lemon", "boom-cell-grape", "boom-cell-soda",
    "boom-cell-melon", "boom-cell-gold", "boom-cell-rainbow",
    "prop-crate", "prop-amphora", "prop-chest",
    "prop-power", "prop-bombs", "prop-speed",
    "wall-stone", "wall-pillar",
    "tile-sand", "tile-temple", "tile-carpet", "tile-carpet-emblem",
    # ---- 编辑器可选的地砖 ----
    "tile-carpet-astral", "tile-carpet-rune", "tile-carpet-vortex",
    # ---- 冰原主题 ----
    "wall-icebrick", "wall-icepillar",
    "tile-ice", "tile-ice-snow",
    "prop-iceblock", "prop-icechest", "prop-snowman",
    # ---- 纯色方块（可炸 / 不可推动）+ 雪块（可炸 / 可推动）----
    "prop-block-red", "prop-block-violet", "prop-snowblock",
]


def write(name, text):
    os.makedirs(DATA, exist_ok=True)
    io.open(os.path.join(DATA, name), 'w', encoding='utf-8', newline='').write(text)
    print('  data/%s  %5.0f KB' % (name, len(text) / 1024.0))


def data_uri(name):
    path = os.path.join(SVG_DIR, name + '.svg')
    raw = io.open(path, 'rb').read()
    return 'data:image/svg+xml;base64,' + base64.b64encode(raw).decode('ascii')


def sprites_js():
    missing = [k for k in SPRITES if not os.path.exists(os.path.join(SVG_DIR, k + '.svg'))]
    if missing:
        raise SystemExit('assets/sucai/ 缺素材：%s（先跑 asset_db.build_all，见本文件 main）' % missing)
    rows = ',\n'.join('    "%s": "%s"' % (k, data_uri(k)) for k in SPRITES)
    return 'window.QQ_SPRITES = {\n' + rows + '\n};\n'


def maps_js():
    maps = []
    for path in sorted(glob.glob(os.path.join(MAPS_DIR, '*.json'))):
        with io.open(path, encoding='utf-8') as f:
            maps.append(json.load(f))
    if len(maps) < 2:
        raise SystemExit('tools/maps/ 里至少要有两张地图，现在只有 %d 张' % len(maps))
    print('  maps: %d 张 (%s)' % (len(maps), '、'.join(m['name'] for m in maps)))
    return 'window.QQ_BUILTIN_MAPS = ' + json.dumps(maps, ensure_ascii=False) + ';\n'


def main():
    print('生成素材 SVG ...')
    data, scene = asset_db.build_all()
    print('  assets/sucai: %d 个 + _scene.svg' % len(data))

    # logo 拷进 v2/，保证 v2 目录单独拷走也能打开（页面不引用目录外的文件）
    import shutil
    logo_src = os.path.join(SVG_DIR, 'logo.svg')
    logo_dst = os.path.join(V2, 'assets', 'logo.svg')
    os.makedirs(os.path.dirname(logo_dst), exist_ok=True)
    shutil.copyfile(logo_src, logo_dst)
    print('  v2/assets/logo.svg')

    print('生成页面数据 ...')
    write('sprites.js', sprites_js())
    write('maps.js', maps_js())
    write('tags.js', 'window.QQ_OBSTACLE_TAGS = ' +
          json.dumps(obstacle_tags.js_table(), ensure_ascii=False, sort_keys=True) + ';\n')

    cats = [{'id': c, 'name': n, 'desc': d} for c, n, d in asset_db.CATS]
    write('gallery-data.js', 'window.QQ_GALLERY = ' +
          json.dumps({'cats': cats, 'assets': data, 'scene': scene}, ensure_ascii=False) + ';\n')
    write('spec-data.js', 'window.QQ_SPEC = ' +
          json.dumps(spec_db.spec_data(), ensure_ascii=False) + ';\n')
    print('完成。')


if __name__ == '__main__':
    main()
