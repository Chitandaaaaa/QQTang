# -*- coding: utf-8 -*-
"""QQ糖 · 素材数据库 —— 像素素材总表（自 build_sucai.py 的数据部分独立成模块）

build_v2.py 用它生成：
    assets/sucai/*.svg     全部素材（素材库页与游戏的共同来源）
    assets/sucai/_scene.svg 组合样张
    v2/data/gallery-data.js 素材库页面数据
"""
import os
import io
import collections

from sucai_lib import to_svg, svg_inner, normalize, mirror_left, OUT_SVG
import sucai_chars as CH
import sucai_map as MP
import sucai_fx as FX
import sucai_props as IT
import sucai_bombs as BB   # 糖弹家族（9 种口味，24×24）
import obstacle_tags       # 障碍标签（与地图编辑器共用同一份定义）
import build_assets as TD  # 像素风页的点阵（糖豆），直接复用


# ------------------------------------------------------------------ 资产表
def build_assets():
    """返回 [(id, 中文名, 分类, grid, pal, 备注)]"""
    out = []
    # 人物
    for key, fn, pal, label in CH.CHARS:
        g, p = fn(), pal()
        normalize(g, p)
        out.append((key, label, 'char', g, p, ''))
        side = key.split('-')[1] in ('side', 'right')
        if side:
            base = key.replace('-side', '-left') if '-side' in key else key + '-left'
            name = label.replace('右侧', '左侧')
            gl = mirror_left([row[:] for row in g])
            out.append((base, name, 'char', gl, p, '镜像'))
    # 糖豆（像素风 v1 的主角，三视图 + 镜像）
    for key, fn, label in [('tangdou-front', TD.front, '糖豆 · 正面'),
                           ('tangdou-side', TD.side, '糖豆 · 右侧'),
                           ('tangdou-back', TD.back, '糖豆 · 背面')]:
        g = fn()
        normalize(g, TD.PAL)
        out.append((key, label, 'char', g, TD.PAL, ''))
    gl = mirror_left([row[:] for row in TD.side()])
    normalize(gl, TD.PAL)
    out.append(('tangdou-left', '糖豆 · 左侧', 'char', gl, TD.PAL, '镜像'))
    # 炮弹：糖弹家族（同一副球体换口味）+ 每种口味一块同色爆炸格
    for key, fn, label in BB.BOMB_ASSETS:
        g, p = fn()
        normalize(g, p)
        out.append((key, label, 'shell', g, p, BB.NOTES.get(key, '')))
    for key, fn, label in BB.CELL_ASSETS:
        g, p = fn()
        normalize(g, p)
        out.append((key, label, 'shell', g, p, ''))
    # 地图 / 障碍
    for key, fn, label in MP.MAP_ASSETS:
        g, p = fn()
        normalize(g, p)
        cat = 'ground' if key.startswith('tile-') else ('wall' if key.startswith('wall-') else 'prop')
        out.append((key, label, cat, g, p, ''))
    # 道具（增益）
    for key, fn, label in IT.ITEM_ASSETS:
        g = fn()
        normalize(g, IT.ITEM)
        out.append((key, label, 'item', g, IT.ITEM, ''))
    # 特效
    for key, fn, label in FX.FX_ASSETS:
        g, p = fn()
        normalize(g, p)
        note = '游戏内' if key == 'bomb' else ''
        out.append((key, label, 'shell', g, p, note))
    return out


def fx_tags(key):
    """爆炸特效组的小标签（糖弹 / 口味爆炸格不走这里）"""
    if key == 'bomb':
        return [('32×32 整格', 'mute')]
    if key == 'boom-cell':
        return [('通用爆炸格', 'mute')]
    return [('爆炸帧', 'mute')]


SRC = {
    'zelda-front': 'sucai/人物/塞尔达正面.png',
    'zelda-side': 'sucai/人物/塞尔达右侧.png',
    'zelda-left': 'sucai/人物/塞尔达左侧.png',
    'zelda-back': 'sucai/人物/塞尔达背.png',
    'link-front': 'sucai/人物/林克新参考_正面.png',
    'link-side': 'sucai/人物/林克新参考_右侧.png',
    'link-left': 'sucai/人物/林克新参考_右侧.png 镜像',
    'link-back': 'sucai/人物/林克新参考_背面.png',
    'tile-sand': 'sucai/地图/地面/夺宝_沙地.png',
    'tile-temple': 'sucai/地图/地面/夺宝_神殿石砖.png',
    'tile-carpet': 'sucai/地图/地面/夺宝_红色地毯.png',
    'tile-carpet-emblem': 'sucai/地图/地面/夺宝_红色地毯_中心徽章.png',
    'tile-carpet-astral': 'sucai/地图/地面/夺宝_红色地毯_占星环.png',
    'tile-carpet-vortex': 'sucai/地图/地面/夺宝_红色地毯_漩涡火.png',
    'tile-carpet-rune': 'sucai/地图/地面/夺宝_红色地毯_魔法纹.png',
    'wall-stone': 'sucai/地图/围墙/夺宝_古石墙.png',
    'wall-pillar': 'sucai/地图/围墙/夺宝_石柱.png',
    'prop-amphora': 'sucai/地图/障碍物/夺宝_彩陶罐.png',
    'prop-crate': 'sucai/地图/障碍物/夺宝_木箱.png',
    'prop-chest': 'sucai/地图/障碍物/夺宝_金宝箱.png',
    'prop-power': 'sucai/道具/加炮弹威力.png',
    'prop-bombs': 'sucai/道具/加炮弹数量.png',
    'prop-speed': 'sucai/道具/加移动速度.png',
    'bomb': 'sucai/炮弹/炮弹.jpeg',
    'boom-cell': 'sucai/炮弹/爆炸格.png',
}

CATS = [
    ('char', '人物', '角色四向行走图'),
    ('ground', '地面', '32×32 无缝地砖'),
    ('wall', '围墙', '石墙与浮雕柱'),
    ('prop', '障碍物', '可破坏道具'),
    ('item', '道具', '增益道具 · 掉落拾取'),
    ('shell', '炮弹', '9 种口味糖弹 · 同色爆炸格'),
]


def palette_of(g, pal):
    """统计实际使用的颜色，按出现次数排序"""
    cnt = collections.Counter()
    for row in g:
        for ch in row:
            if ch != '.' and ch in pal:
                cnt[pal[ch]] += 1
    return [c for c, _ in cnt.most_common()]


# ------------------------------------------------------------------ 组合样张
def compose_scene(assets):
    """把地砖、围墙、道具、人物拼成一张 20x11 格样张（640x352）
    用 <symbol> + <use> 复用，避免重复内联几十万像素"""
    idx = {a[0]: a for a in assets}
    TW = 32
    scene_w, scene_h = 20 * TW, 11 * TW
    used = []

    def place(key, gx, gy, dy=0, dx=0):
        a = idx.get(key)
        if not a:
            return
        if key not in used:
            used.append(key)
        w, h = a[3], a[4]
        parts.append('<use href="#s-%s" x="%d" y="%d" width="%d" height="%d"/>'
                     % (key, gx * TW + dx, gy * TW + dy, len(w[0]), len(w)))

    parts = []
    # 背景沙地
    for gy in range(11):
        for gx in range(20):
            place('tile-sand', gx, gy)
    # 上方石墙 2 行
    for gy in range(2):
        for gx in range(20):
            place('wall-stone', gx, gy)
    # 两侧石柱收边
    for gy in range(2, 11):
        place('wall-pillar', 0, gy)
        place('wall-pillar', 19, gy)
    # 中央红毯（中间 2x2 徽章）
    for gy in range(3, 9):
        for gx in range(8, 14):
            if (gx, gy) in [(9, 5), (10, 5), (9, 6), (10, 6)]:
                place('tile-carpet-emblem', gx, gy)
            else:
                place('tile-carpet', gx, gy)
    # 障碍物（贴图已经是 32×32，直接铺满格子）
    place('prop-amphora', 3, 6)
    place('prop-crate', 4, 5)
    place('prop-chest', 15, 6)
    place('prop-amphora', 16, 8)
    place('prop-power', 14, 4)
    place('prop-bombs', 15, 4)
    place('prop-speed', 16, 4)
    # 人物
    place('zelda-front', 6, 8)
    place('tangdou-front', 9, 8)
    place('link-front', 12, 8)
    # 特效
    place('boom-cell-rainbow', 10, 3)
    place('bomb', 13, 7, 4)
    place('candy-bomb', 15, 7, 4)
    # 糖弹家族：左下弹药堆（24×24 在 32 格内居中）
    for i, key in enumerate(['bomb-mint', 'bomb-choco', 'bomb-lemon',
                             'bomb-grape', 'bomb-gold']):
        place(key, 1 + i, 9, 4, 4)
    place('bomb-rainbow', 17, 9, 4, 4)
    # 口味火焰：草莓 / 薄荷各连着烧两格（顺带验证相邻格能连成一片、不留缝）
    for gx in (13, 14):
        place('boom-cell-strawberry', gx, 9)
    for gx in (15, 16):
        place('boom-cell-mint', gx, 9)

    defs = []
    for key in used:
        a = idx[key]
        g, p = a[3], a[4]
        defs.append('<symbol id="s-%s" viewBox="0 0 %d %d">%s</symbol>'
                    % (key, len(g[0]), len(g), svg_inner(g, p)))
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d" shape-rendering="crispEdges">\n'
            '<defs>%s</defs>\n%s\n</svg>\n'
            % (scene_w, scene_h, scene_w, scene_h, "".join(defs), "\n".join(parts)))


def build_all():
    """生成素材表并落盘 assets/sucai/*.svg + _scene.svg，返回 (data, scene)

    文件即美术真源：assets/sucai/ 里已存在的 SVG 一律不覆盖（手调的满格版
    炮弹等都以文件为准），只给新增素材按模块定义生成初稿。
    素材库页与游戏统一使用文件内容。"""
    os.makedirs(OUT_SVG, exist_ok=True)
    assets = build_assets()

    data = []
    for (key, name, cat, g, p, note) in assets:
        w, h = len(g[0]), len(g)
        path = os.path.join(OUT_SVG, key + '.svg')
        if os.path.exists(path):
            with io.open(path, encoding='utf-8') as f:
                svg = f.read()
        else:
            svg = to_svg(g, p, '%s · %s' % (name, key), 'QQ糖 夺宝 · %s · 像素素材（透明底）' % name)
            with io.open(path, 'w', encoding='utf-8') as f:
                f.write(svg)
        # 障碍标签（可炸 / 不可炸、可推动 / 不可推动）与编辑器共用一张表；
        # 糖弹 / 口味爆炸格挂口味标签，其余炮弹挂类型标签
        tags = obstacle_tags.asset_chips(key) + BB.TAGS.get(key, [])
        if cat == 'shell' and not tags:
            tags = fx_tags(key)
        data.append({
            'id': key, 'name': name, 'cat': cat, 'w': w, 'h': h,
            'note': note, 'src': SRC.get(key, ''), 'svg': svg.strip(),
            'pal': palette_of(g, p),
            'tags': tags,
        })

    scene = compose_scene(assets)
    with io.open(os.path.join(OUT_SVG, '_scene.svg'), 'w', encoding='utf-8') as f:
        f.write(scene)
    return data, scene
