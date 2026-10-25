# -*- coding: utf-8 -*-
"""
QQ糖 · 夺宝素材库 · 总装
- 输出 assets/sucai/*.svg（26 个）
- 输出 assets/sucai/_scene.svg（组合样张）
- 输出 QQTang-sucai-v1.html（静态素材管理页，内联全部 SVG）
运行： python build_sucai.py
"""
import os, io, json, collections
from sucai_lib import (to_svg, svg_inner, normalize, mirror_left,
                       OUT_SVG, DESIGN)
import sucai_chars as CH
import sucai_map as MP
import sucai_fx as FX
import sucai_props as IT
import sucai_bombs as BB   # 糖弹家族（9 种口味，24×24）
import obstacle_tags      # 障碍标签（与地图编辑器共用同一份定义）
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
    'tangdou-front': '手绘点阵 · 像素风 v1（QQTang-pixel-v1.html）',
    'tangdou-side': '手绘点阵 · 像素风 v1（QQTang-pixel-v1.html）',
    'tangdou-left': 'tangdou-side 镜像',
    'tangdou-back': '手绘点阵 · 像素风 v1（QQTang-pixel-v1.html）',
    'candy-bomb': '手绘点阵 · 像素风 v1（QQTang-pixel-v1.html）',
    'bomb-mint': 'candy-bomb 形状 · 换主色（tools/sucai_bombs.py）',
    'bomb-choco': 'candy-bomb 形状 · 换主色（tools/sucai_bombs.py）',
    'bomb-lemon': 'candy-bomb 形状 · 换主色（tools/sucai_bombs.py）',
    'bomb-grape': 'candy-bomb 形状 · 换主色（tools/sucai_bombs.py）',
    'bomb-soda': 'candy-bomb 形状 · 换主色（tools/sucai_bombs.py）',
    'bomb-melon': 'candy-bomb 形状 · 换主色（tools/sucai_bombs.py）',
    'bomb-gold': 'candy-bomb 形状 + 高光星（tools/sucai_bombs.py）',
    'bomb-rainbow': 'candy-bomb 形状 · 七色条带（tools/sucai_bombs.py）',
    'boom-cell-strawberry': 'sucai/炮弹/爆炸格.png · 换草莓色（tools/sucai_bombs.py）',
    'boom-cell-mint': '爆炸格形状 · 换薄荷色（tools/sucai_bombs.py）',
    'boom-cell-choco': '爆炸格形状 · 换可可色（tools/sucai_bombs.py）',
    'boom-cell-lemon': '爆炸格形状 · 换柠檬色（tools/sucai_bombs.py）',
    'boom-cell-grape': '爆炸格形状 · 换葡萄色（tools/sucai_bombs.py）',
    'boom-cell-soda': '爆炸格形状 · 换汽水色（tools/sucai_bombs.py）',
    'boom-cell-melon': '爆炸格形状 · 换蜜瓜色（tools/sucai_bombs.py）',
    'boom-cell-gold': '爆炸格形状 · 换金色（tools/sucai_bombs.py）',
    'boom-cell-rainbow': '爆炸格形状 · 七色条带（tools/sucai_bombs.py）',
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


# ------------------------------------------------------------------ 页面
HTML_HEAD = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>夺宝素材库 · SUCAI v1</title>
<style>
  :root{
    --ink:#3A2416; --ink2:#6E5136; --ink3:#9C7C58;
    --paper:#FFFBF1; --paper2:#F6EAD2; --line:#E0CBA6;
    --gold:#C89A3A; --gold2:#F0C860; --red:#A82A3B; --teal:#3E9F9B;
    --shadow:0 6px 0 rgba(58,36,22,.13);
    --shadow-sm:0 3px 0 rgba(58,36,22,.12);
    --mono:ui-monospace,SFMono-Regular,"Cascadia Mono","JetBrains Mono",Consolas,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{
    color:var(--ink);
    background:
      radial-gradient(900px 420px at 12% -6%, #FFF7E4 0%, transparent 60%),
      radial-gradient(760px 380px at 92% 0%, #FBE7CE 0%, transparent 58%),
      repeating-linear-gradient(0deg, rgba(58,36,22,.022) 0 2px, transparent 2px 4px),
      var(--paper2);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
    min-height:100vh;
  }
  a{color:inherit}
  button{font:inherit;color:inherit}
  ::selection{background:#F0C860;color:#3A2416}

  /* ---------------- 顶栏 ---------------- */
  .top{
    position:sticky; top:0; z-index:60;
    background:rgba(255,251,241,.94);
    backdrop-filter:blur(10px);
    border-bottom:2.5px solid var(--ink);
  }
  .top-in{
    max-width:1420px; margin:0 auto; padding:12px 26px;
    display:flex; align-items:center; gap:18px; flex-wrap:wrap;
  }
  .brand{display:flex; align-items:center; gap:11px; margin-right:4px}
  .brand .mark{
    width:38px; height:38px; border:2.5px solid var(--ink); border-radius:11px;
    background:linear-gradient(150deg,#FFD866,#C89A3A 62%,#8E6620);
    display:grid; place-items:center; box-shadow:var(--shadow-sm);
    flex:none;
  }
  .brand h1{font-size:16.5px; margin:0; letter-spacing:.4px; line-height:1.15}
  .brand h1 b{color:var(--red)}
  .brand .meta{font-family:var(--mono); font-size:10.5px; color:var(--ink3);
    letter-spacing:.6px; margin-top:3px; text-transform:uppercase}

  .search{
    flex:1 1 220px; min-width:180px; max-width:340px;
    display:flex; align-items:center; gap:8px; padding:0 12px; height:38px;
    background:#fff; border:2.5px solid var(--ink); border-radius:11px;
    box-shadow:var(--shadow-sm);
  }
  .search input{
    border:0; outline:0; background:transparent; font:inherit; font-size:13px;
    width:100%; color:var(--ink);
  }
  .search input::placeholder{color:#B39C7C}
  .search svg{flex:none; opacity:.55}

  .top-actions{display:flex; gap:8px; margin-left:auto; flex-wrap:wrap}
  .btn{
    appearance:none; cursor:pointer; border:2.5px solid var(--ink);
    background:#fff; border-radius:10px; padding:8px 13px; font-size:12.5px;
    font-weight:800; letter-spacing:.2px; box-shadow:var(--shadow-sm);
    transition:transform .12s, box-shadow .12s, background .12s;
    display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
  }
  .btn:hover{transform:translateY(-1px); box-shadow:0 5px 0 rgba(58,36,22,.16)}
  .btn:active{transform:translateY(2px); box-shadow:0 1px 0 rgba(58,36,22,.2)}
  .btn.on{background:var(--ink); color:#FFFBF1}
  .btn.gold{background:linear-gradient(160deg,#FFE29A,#F0C860 55%,#D9A441)}
  .btn.ghost{box-shadow:none; border-style:dashed; background:transparent}

  /* ---------------- 布局 ---------------- */
  .shell{
    max-width:1420px; margin:0 auto; padding:24px 26px 90px;
    display:grid; grid-template-columns:216px minmax(0,1fr); gap:26px;
    align-items:start;
  }
  aside{position:sticky; top:78px}
  .side-h{
    font-family:var(--mono); font-size:10px; letter-spacing:1.4px;
    color:var(--ink3); text-transform:uppercase; margin:0 0 9px 4px;
  }
  .nav{display:flex; flex-direction:column; gap:5px}
  .nav button{
    appearance:none; border:2.5px solid transparent; background:transparent;
    border-radius:10px; padding:8px 10px; display:flex; align-items:center;
    gap:9px; cursor:pointer; font-size:13px; font-weight:750; text-align:left;
    transition:background .12s, border-color .12s, transform .12s;
  }
  .nav button:hover{background:#FFF6E2; border-color:var(--line)}
  .nav button.on{
    background:var(--ink); color:#FFFBF1; border-color:var(--ink);
    box-shadow:var(--shadow-sm);
  }
  .nav .dot{width:9px;height:9px;border-radius:3px;border:2px solid currentColor;flex:none}
  .nav .n{
    margin-left:auto; font-family:var(--mono); font-size:10.5px;
    background:rgba(58,36,22,.08); border-radius:6px; padding:1px 6px;
  }
  .nav button.on .n{background:rgba(255,255,255,.18)}

  .side-box{
    margin-top:22px; padding:13px 13px 14px; background:var(--paper);
    border:2.5px solid var(--ink); border-radius:13px; box-shadow:var(--shadow-sm);
  }
  .side-box h4{margin:0 0 9px; font-size:11.5px; letter-spacing:.6px; color:var(--ink2)}
  .bg-switch{display:flex; gap:6px}
  .bg-switch button{
    flex:1; height:30px; border:2.5px solid var(--ink); border-radius:8px;
    cursor:pointer; font-size:10px; font-weight:800; letter-spacing:.4px;
    background:#fff; box-shadow:0 2px 0 rgba(58,36,22,.16);
  }
  .bg-switch button[data-bg="checker"]{background:
    linear-gradient(45deg,#E8DDC8 25%,transparent 25%,transparent 75%,#E8DDC8 75%) 0 0/8px 8px,
    linear-gradient(45deg,#E8DDC8 25%,#FFF9EC 25%,#FFF9EC 75%,#E8DDC8 75%) 4px 4px/8px 8px}
  .bg-switch button[data-bg="sand"]{background:#E9C87C}
  .bg-switch button[data-bg="night"]{background:#2B1E2E}
  .bg-switch button.on{outline:2.5px solid var(--red); outline-offset:1px}
  .legend{font-size:11px; line-height:1.85; color:var(--ink2)}
  .legend code{font-family:var(--mono); font-size:10.5px; color:var(--ink)}

  /* ---------------- 场景横幅 ---------------- */
  .hero{
    border:2.5px solid var(--ink); border-radius:16px; overflow:hidden;
    background:#2B1E2E; box-shadow:var(--shadow); position:relative;
  }
  .hero > svg{display:block; width:100%; height:auto; image-rendering:pixelated}
  .hero .cap{
    position:absolute; left:14px; bottom:12px; display:flex; gap:8px;
    align-items:center; padding:7px 11px; border-radius:999px;
    background:rgba(20,12,6,.72); color:#FFF3D6; font-size:11.5px;
    font-weight:700; letter-spacing:.3px; backdrop-filter:blur(4px);
    border:1.5px solid rgba(255,227,150,.35);
  }
  .hero .cap b{color:#F0C860}
  .hero .tag{
    position:absolute; right:14px; top:12px; font-family:var(--mono);
    font-size:10px; letter-spacing:1.2px; color:#FFE9B0;
    background:rgba(20,12,6,.6); padding:5px 9px; border-radius:6px;
  }

  /* ---------------- 分组 + 卡片 ---------------- */
  .group{margin-top:34px}
  .group-h{display:flex; align-items:baseline; gap:11px; margin-bottom:14px}
  .group-h h2{font-size:17px; margin:0; letter-spacing:.3px}
  .group-h .c{
    font-family:var(--mono); font-size:11px; color:#fff; background:var(--ink);
    border-radius:999px; padding:2px 8px;
  }
  .group-h .d{font-size:12px; color:var(--ink3)}
  .group-h .line{flex:1; height:2.5px; background:repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 11px); border-radius:2px}

  .grid{display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(168px,1fr))}
  .card{
    position:relative; background:var(--paper); border:2.5px solid var(--ink);
    border-radius:13px; padding:0; cursor:pointer; overflow:hidden;
    box-shadow:var(--shadow-sm); transition:transform .14s, box-shadow .14s;
    text-align:left;
  }
  .card:hover{transform:translateY(-3px); box-shadow:0 8px 0 rgba(58,36,22,.16)}
  .card:active{transform:translateY(1px); box-shadow:0 2px 0 rgba(58,36,22,.18)}
  .card .thumb{
    height:112px; display:grid; place-items:center; padding:10px;
    border-bottom:2.5px solid var(--ink); position:relative; overflow:hidden;
    background:
      linear-gradient(45deg,#E8DDC8 25%,transparent 25%,transparent 75%,#E8DDC8 75%) 0 0/10px 10px,
      linear-gradient(45deg,#E8DDC8 25%,#FFF9EC 25%,#FFF9EC 75%,#E8DDC8 75%) 5px 5px/10px 10px;
  }
  .card .thumb svg{image-rendering:pixelated; display:block}
  .card .info{padding:9px 11px 10px; display:flex; align-items:flex-start; gap:8px}
  .card .nm{font-size:12.5px; font-weight:800; line-height:1.3}
  .card .id{font-family:var(--mono); font-size:9.5px; color:var(--ink3); margin-top:3px;
    letter-spacing:.2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
  .card .sz{
    margin-left:auto; flex:none; font-family:var(--mono); font-size:9.5px;
    color:var(--ink2); background:#F3E7CE; border:1.5px solid var(--line);
    border-radius:5px; padding:1px 4px; margin-top:1px;
  }
  .card .badge{
    position:absolute; top:7px; right:7px; font-family:var(--mono); font-size:9px;
    background:var(--gold); color:#3A2416; border:1.5px solid var(--ink);
    border-radius:5px; padding:1px 5px; letter-spacing:.4px; font-weight:700;
  }
  /* 障碍标签：可炸 / 不可炸、可推动 / 不可推动 */
  .card .tags{display:flex; flex-wrap:wrap; gap:4px; padding:0 11px 10px}
  .chip{
    font-family:var(--mono); font-size:9px; line-height:1.6; padding:0 5px;
    border:1.5px solid var(--ink2); border-radius:5px; color:var(--ink2);
    background:var(--paper2); white-space:nowrap;
  }
  .chip.yes{
    color:#1E4020; background:#CDEBCF; border-color:#4C8A54; font-weight:700;
  }
  .chip.mute{color:#3A2416; background:var(--gold2); border-color:var(--ink)}
  .sheet-top .tags{display:flex; flex-wrap:wrap; gap:5px; margin-top:7px}
  body[data-bg="night"] .card .thumb{background:#241a2c}
  body[data-bg="sand"] .card .thumb{background:#E9C87C}

  .empty{padding:60px 10px; text-align:center; color:var(--ink3); font-size:13px}

  /* ---------------- 详情面板 ---------------- */
  .modal{
    position:fixed; inset:0; z-index:100; display:none;
    background:rgba(38,24,14,.55); backdrop-filter:blur(3px);
    padding:34px 22px; overflow:auto;
  }
  .modal.on{display:block}
  .sheet{
    max-width:1000px; margin:0 auto; background:var(--paper);
    border:3px solid var(--ink); border-radius:18px; overflow:hidden;
    box-shadow:0 18px 0 rgba(20,12,6,.25);
    animation:pop .18s ease-out;
  }
  @keyframes pop{from{transform:translateY(14px) scale(.99); opacity:.6} to{transform:none; opacity:1}}
  .sheet-top{
    display:flex; align-items:center; gap:12px; padding:13px 16px;
    border-bottom:2.5px solid var(--ink); background:linear-gradient(180deg,#FFF6E2,#F7EAD1);
  }
  .sheet-top h3{margin:0; font-size:15px}
  .sheet-top .mono{font-family:var(--mono); font-size:10.5px; color:var(--ink3)}
  .sheet-body{display:grid; grid-template-columns:minmax(0,1fr) 306px; gap:0}
  .stage{
    padding:22px; display:grid; place-items:center; min-height:330px;
    border-right:2.5px solid var(--ink);
    background:
      linear-gradient(45deg,#E8DDC8 25%,transparent 25%,transparent 75%,#E8DDC8 75%) 0 0/14px 14px,
      linear-gradient(45deg,#E8DDC8 25%,#FFF9EC 25%,#FFF9EC 75%,#E8DDC8 75%) 7px 7px/14px 14px;
    position:relative;
  }
  .stage.night{background:#241a2c}
  .stage.sand{background:#E9C87C}
  .stage svg{image-rendering:pixelated; display:block; max-width:100%}
  .stage .gridlines{
    position:absolute; inset:0; pointer-events:none; display:none;
  }
  .stage .tilewrap{display:none; width:min(100%,420px); aspect-ratio:1;}
  .stage .tilewrap.on{display:block}

  .side-info{padding:16px; display:flex; flex-direction:column; gap:14px}
  .kv{display:grid; grid-template-columns:64px 1fr; gap:6px 10px; font-size:12px}
  .kv dt{color:var(--ink3); font-size:11px}
  .kv dd{margin:0; font-family:var(--mono); font-size:11px}
  .pal{display:flex; flex-wrap:wrap; gap:5px}
  .sw{
    width:22px; height:22px; border-radius:6px; border:2px solid var(--ink);
    cursor:pointer; position:relative; box-shadow:0 2px 0 rgba(58,36,22,.15);
    transition:transform .12s;
  }
  .sw:hover{transform:translateY(-2px) scale(1.08)}
  .sw span{
    position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
    background:var(--ink); color:#FFF3D6; font-family:var(--mono); font-size:9.5px;
    padding:2px 5px; border-radius:4px; opacity:0; pointer-events:none;
    transition:opacity .12s; white-space:nowrap;
  }
  .sw:hover span{opacity:1}
  .acts{display:grid; grid-template-columns:1fr 1fr; gap:7px}
  .acts .btn{justify-content:center; padding:8px 8px; font-size:11.5px}
  .src{font-family:var(--mono); font-size:10px; color:var(--ink2);
    background:#F6EAD2; border:1.5px solid var(--line); border-radius:7px;
    padding:6px 8px; word-break:break-all; line-height:1.5}
  .code{
    font-family:var(--mono); font-size:10px; line-height:1.6; color:#F4E6C8;
    background:#2C1D12; border:2.5px solid var(--ink); border-radius:9px;
    padding:9px 10px; max-height:132px; overflow:auto; white-space:pre-wrap;
    word-break:break-all;
  }
  .close{
    margin-left:auto; width:32px; height:32px; border-radius:9px; border:2.5px solid var(--ink);
    background:#fff; cursor:pointer; font-weight:900; box-shadow:var(--shadow-sm);
    display:grid; place-items:center; font-size:15px; line-height:1;
  }
  .toast{
    position:fixed; left:50%; bottom:26px; transform:translate(-50%,14px);
    background:var(--ink); color:#FFF3D6; padding:10px 18px; border-radius:999px;
    font-size:12.5px; font-weight:700; opacity:0; pointer-events:none;
    transition:opacity .2s, transform .2s; z-index:200; box-shadow:0 6px 0 rgba(0,0,0,.18);
  }
  .toast.on{opacity:1; transform:translate(-50%,0)}

  /* 动画播放 */
  .player{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
  .frames{display:flex; gap:6px}
  .frame{
    width:44px; height:44px; border:2px solid var(--line); border-radius:8px;
    background:#241a2c; display:grid; place-items:center; cursor:pointer; overflow:hidden;
  }
  .frame.on{border-color:var(--gold); box-shadow:0 0 0 2px rgba(240,200,96,.45)}
  .frame svg{width:38px;height:38px;image-rendering:pixelated}

  @media (max-width:960px){
    .shell{grid-template-columns:1fr}
    aside{position:static; order:2}
    .sheet-body{grid-template-columns:1fr}
    .stage{border-right:0; border-bottom:2.5px solid var(--ink)}
  }
</style>
</head>
<body data-bg="checker">
<div class="top">
  <div class="top-in">
    <div class="brand">
      <div class="mark">__MARK__</div>
      <div>
        <h1>夺宝素材库 <b>v1</b></h1>
        <div class="meta">SUCAI · PIXEL SVG · __COUNT__ ASSETS</div>
      </div>
    </div>
    <label class="search">
      __SEARCHICON__
      <input id="q" type="search" placeholder="搜索名称或 ID，如 zelda / 地毯 / 糖弹 / 爆炸格" autocomplete="off" />
    </label>
    <div class="top-actions">
      <button class="btn" id="btn-sprite">导出精灵图 .svg</button>
      <button class="btn" id="btn-json">导出清单 .json</button>
    </div>
  </div>
</div>

<div class="shell">
  <aside>
    <div class="side-h">分类 / CATEGORY</div>
    <div class="nav" id="nav"></div>
    <div class="side-box">
      <h4>预览底色</h4>
      <div class="bg-switch" id="bgswitch">
        <button data-bg="checker" class="on">棋盘</button>
        <button data-bg="sand">沙地</button>
        <button data-bg="night">暗色</button>
      </div>
    </div>
    <div class="side-box">
      <h4>规范</h4>
      <div class="legend">
        网格 <code>1 unit = 1px</code><br>
        人物成品 <code>32×48</code>（整格宽 / 一格半高；上 16 行是探出碰撞格的头部）<br>
        人物画稿 <code>32×40</code> · 地砖 <code>32×32</code><br>
        糖弹 <code>24×24</code>（落在一格内居中）<br>
        爆炸格 <code>32×32</code>（无外框，相邻拼接成一片火）<br>
        描边 <code>1px #3A2416</code><br>
        渲染 <code>image-rendering: pixelated</code>
      </div>
    </div>
  </aside>

  <main>
    <div class="hero">
      <div class="tag">SCENE PREVIEW · 640×352</div>
      __SCENE__
      <div class="cap"><b>组合样张</b> 沙地 + 石墙 + 红毯 + 道具 + 人物 + 糖弹 + 同色火焰</div>
    </div>
    <div id="groups"></div>
  </main>
</div>

<div class="modal" id="modal">
  <div class="sheet">
    <div class="sheet-top">
      <div>
        <h3 id="m-name">—</h3>
        <div class="mono" id="m-id">—</div>
        <div class="tags" id="m-tags"></div>
      </div>
      <button class="close" id="m-close">✕</button>
    </div>
    <div class="sheet-body">
      <div class="stage" id="m-stage">
        <div id="m-preview"></div>
        <div class="tilewrap" id="m-tiling"></div>
      </div>
      <div class="side-info">
        <dl class="kv">
          <dt>分类</dt><dd id="m-cat">—</dd>
          <dt>尺寸</dt><dd id="m-size">—</dd>
          <dt>网格</dt><dd id="m-grid">—</dd>
          <dt>颜色</dt><dd id="m-ncol">—</dd>
        </dl>
        <div>
          <div class="side-h" style="margin-bottom:5px">来源 / SOURCE</div>
          <div class="src" id="m-src">—</div>
        </div>
        <div>
          <div class="side-h" style="margin-bottom:7px">调色板 / CLICK TO COPY</div>
          <div class="pal" id="m-pal"></div>
        </div>
        <div>
          <div class="side-h" style="margin-bottom:7px">缩放</div>
          <div class="bg-switch" id="m-zoom">
            <button data-z="2">2×</button><button data-z="4" class="on">4×</button><button data-z="6">6×</button><button data-z="8">8×</button>
          </div>
        </div>
        <div class="acts">
          <button class="btn" id="m-copy">复制 SVG</button>
          <button class="btn" id="m-png">下载 PNG</button>
          <button class="btn" id="m-svg">下载 SVG</button>
          <button class="btn" id="m-tile">拼接预览</button>
        </div>
        <div>
          <div class="side-h" style="margin-bottom:7px">源码</div>
          <div class="code" id="m-code"></div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
const CATS = __CATS__;
const ASSETS = __DATA__;

/* ---------- 渲染 ---------- */
const navEl = document.getElementById('nav');
const groupsEl = document.getElementById('groups');
const state = { cat: 'all', q: '' };

function countOf(cat){ return ASSETS.filter(a => cat === 'all' || a.cat === cat).length; }

function buildNav(){
  const items = [{id:'all', name:'全部素材', desc:'整套 v1'}, ...CATS];
  navEl.innerHTML = items.map(c => `
    <button data-cat="${c.id}" class="${state.cat===c.id?'on':''}">
      <span class="dot"></span>${c.name}<span class="n">${countOf(c.id)}</span>
    </button>`).join('');
  navEl.querySelectorAll('button').forEach(b => b.onclick = () => {
    state.cat = b.dataset.cat; buildNav(); render();
  });
}

function match(a){
  const q = state.q.trim().toLowerCase();
  if (state.cat !== 'all' && a.cat !== state.cat) return false;
  if (!q) return true;
  return (a.name + ' ' + a.id + ' ' + a.cat).toLowerCase().includes(q);
}

function cardHTML(a){
  const tileCls = (a.w === 32 && a.h === 32) ? ' tile' : '';
  const sc = Math.max(1, Math.floor(100 / Math.max(a.w, a.h)));
  return `<button class="card${tileCls}" data-id="${a.id}">
    <div class="thumb">${a.svg.replace(/width="\\d+" height="\\d+"/,
      `width="${a.w * sc}" height="${a.h * sc}"`)}</div>
    <div class="info">
      <div>
        <div class="nm">${a.name}</div>
        <div class="id">${a.id}</div>
      </div>
      <div class="sz">${a.w}×${a.h}</div>
    </div>
    ${a.note ? `<div class="badge">${a.note}</div>` : ''}
    ${a.tags && a.tags.length ? `<div class="tags">${a.tags.map(t =>
        `<span class="chip ${t[1]}">${t[0]}</span>`).join('')}</div>` : ''}
  </button>`;
}

function render(){
  const list = ASSETS.filter(match);
  if (!list.length){
    groupsEl.innerHTML = '<div class="empty">没有匹配的素材，试试别的关键词。</div>';
    return;
  }
  const cats = state.cat === 'all' ? CATS : CATS.filter(c => c.id === state.cat);
  let html = '';
  for (const c of cats){
    const items = list.filter(a => a.cat === c.id);
    if (!items.length) continue;
    html += `<section class="group">
      <div class="group-h">
        <h2>${c.name}</h2><span class="c">${items.length}</span>
        <span class="d">${c.desc}</span><span class="line"></span>
      </div>
      <div class="grid">${items.map(cardHTML).join('')}</div>
    </section>`;
  }
  groupsEl.innerHTML = html;
  groupsEl.querySelectorAll('.card').forEach(el => {
    el.onclick = () => openAsset(el.dataset.id);
  });
}

/* ---------- 详情 ---------- */
const modal = document.getElementById('modal');
let current = null, zoom = 4;
const $ = id => document.getElementById(id);

function openAsset(id){
  const a = ASSETS.find(x => x.id === id);
  if (!a) return;
  current = a;
  zoom = Math.min(8, Math.max(2, Math.round(240 / Math.max(a.w, a.h))));
  $('m-name').textContent = a.name;
  $('m-id').textContent = a.id + (a.note ? '  ·  ' + a.note : '');
  const tg = a.tags || [];
  $('m-tags').innerHTML = tg.map(t =>
    `<span class="chip ${t[1]}">${t[0]}</span>`).join('');
  $('m-tags').style.display = tg.length ? '' : 'none';
  $('m-cat').textContent = (CATS.find(c => c.id === a.cat) || {}).name || a.cat;
  $('m-size').textContent = a.w + ' × ' + a.h;
  $('m-grid').textContent = a.w + ' × ' + a.h + ' units';
  $('m-ncol').textContent = a.pal.length + ' 色';
  $('m-pal').innerHTML = a.pal.map(c =>
    `<div class="sw" style="background:${c}" data-c="${c}"><span>${c}</span></div>`).join('');
  $('m-pal').querySelectorAll('.sw').forEach(s => s.onclick = () => {
    copyText(s.dataset.c); toast('已复制 ' + s.dataset.c);
  });
  $('m-src').textContent = a.src || '—';
  $('m-code').textContent = a.svg.replace(/></g, '>\\n<');
  $('m-tiling').classList.toggle('on', false);
  $('m-tile').classList.toggle('on', false);
  $('m-preview').style.display = '';
  paint();
  modal.classList.add('on');
}

function paint(){
  const a = current;
  const s = a.svg.replace(/width="[\\d.]+" height="[\\d.]+"/,
    `width="${a.w * zoom}" height="${a.h * zoom}"`);
  $('m-preview').innerHTML = s;
}

$('m-zoom').querySelectorAll('button').forEach(b => b.onclick = () => {
  $('m-zoom').querySelectorAll('button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); zoom = +b.dataset.z; paint();
});
$('m-close').onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };
function closeModal(){ modal.classList.remove('on'); current = null; }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (!current) return;
  const list = ASSETS.filter(match);
  const i = list.findIndex(x => x.id === current.id);
  if (e.key === 'ArrowRight' && i >= 0) openAsset(list[(i + 1) % list.length].id);
  if (e.key === 'ArrowLeft' && i >= 0) openAsset(list[(i - 1 + list.length) % list.length].id);
});

/* ---------- 拼接预览 ---------- */
$('m-tile').onclick = () => {
  const a = current; if (!a) return;
  const on = $('m-tiling').classList.toggle('on');
  $('m-tile').classList.toggle('on', on);
  $('m-preview').style.display = on ? 'none' : '';
  if (on){
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
    $('m-tiling').style.background = `url("${uri}") 0 0/64px 64px repeat`;
    $('m-tiling').style.imageRendering = 'pixelated';
  }
};

/* ---------- 下载 / 复制 ---------- */
function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 1600);
}
function copyText(txt){
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
  else {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}
function download(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
$('m-copy').onclick = () => { if (current){ copyText(current.svg); toast('SVG 已复制'); } };
$('m-svg').onclick = () => {
  if (!current) return;
  download(new Blob([current.svg], {type:'image/svg+xml'}), current.id + '.svg');
  toast('已下载 ' + current.id + '.svg');
};
$('m-png').onclick = () => {
  const a = current; if (!a) return;
  const scale = 8;
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = a.w * scale; cv.height = a.h * scale;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob(b => { download(b, a.id + '@' + scale + 'x.png'); toast('已下载 PNG (8×)'); }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
};

/* ---------- 导出 ---------- */
$('btn-json').onclick = () => {
  const manifest = {
    name: 'QQTang 夺宝素材库', version: 'v1', count: ASSETS.length,
    categories: CATS.map(c => ({id:c.id, name:c.name, desc:c.desc, count:countOf(c.id)})),
    assets: ASSETS.map(a => ({id:a.id, name:a.name, cat:a.cat, w:a.w, h:a.h, src:a.src, palette:a.pal})),
  };
  download(new Blob([JSON.stringify(manifest, null, 2)], {type:'application/json'}), 'sucai-manifest.json');
  toast('清单已导出');
};
$('btn-sprite').onclick = () => {
  const syms = ASSETS.map(a => {
    const inner = a.svg.replace(/^[\\s\\S]*?<svg[^>]*>/, '').replace(/<\\/svg>[\\s\\S]*$/, '');
    return `<symbol id="${a.id}" viewBox="0 0 ${a.w} ${a.h}" shape-rendering="crispEdges">${inner}</symbol>`;
  }).join('');
  const out = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" shape-rendering="crispEdges">${syms}</svg>`;
  download(new Blob([out], {type:'image/svg+xml'}), 'sucai-sprite.svg');
  toast('精灵图已导出 · 用 <use href="#id"> 引用');
};

/* ---------- 底色 ---------- */
const stage = $('m-stage');
document.getElementById('bgswitch').querySelectorAll('button').forEach(b => b.onclick = () => {
  document.getElementById('bgswitch').querySelectorAll('button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  document.body.dataset.bg = b.dataset.bg;
  stage.className = 'stage' + (b.dataset.bg === 'night' ? ' night' : (b.dataset.bg === 'sand' ? ' sand' : ''));
});

/* ---------- 搜索 ---------- */
document.getElementById('q').oninput = e => { state.q = e.target.value; render(); };

buildNav(); render();
</script>
</body>
</html>
'''

SEARCH_ICON = ('<svg width="15" height="15" viewBox="0 0 16 16" fill="none">'
               '<circle cx="7" cy="7" r="4.6" stroke="#3A2416" stroke-width="2"/>'
               '<path d="M10.6 10.6L14 14" stroke="#3A2416" stroke-width="2" stroke-linecap="round"/></svg>')

MARK = ('<svg width="22" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges">'
        '<rect x="4" y="2" width="8" height="2" fill="#3A2416"/>'
        '<rect x="3" y="4" width="10" height="2" fill="#A82A3B"/>'
        '<rect x="2" y="6" width="12" height="6" fill="#FFFBF1"/>'
        '<rect x="3" y="12" width="10" height="2" fill="#3A2416"/>'
        '<rect x="6" y="7" width="2" height="2" fill="#3A2416"/>'
        '<rect x="9" y="7" width="2" height="2" fill="#3A2416"/>'
        '<rect x="7" y="10" width="3" height="1" fill="#3A2416"/></svg>')


def main():
    os.makedirs(OUT_SVG, exist_ok=True)
    assets = build_assets()

    data = []
    total = 0
    for (key, name, cat, g, p, note) in assets:
        w, h = len(g[0]), len(g)
        svg = to_svg(g, p, '%s · %s' % (name, key), 'QQ糖 夺宝 · %s · 像素素材（透明底）' % name)
        with io.open(os.path.join(OUT_SVG, key + '.svg'), 'w', encoding='utf-8') as f:
            f.write(svg)
        total += len(svg)
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
        print('  %-20s %-4s %2dx%-2d %6d bytes' % (key + '.svg', cat, w, h, len(svg)))

    scene = compose_scene(assets)
    with io.open(os.path.join(OUT_SVG, '_scene.svg'), 'w', encoding='utf-8') as f:
        f.write(scene)

    cats_json = json.dumps([{'id': c, 'name': n, 'desc': d} for c, n, d in CATS],
                           ensure_ascii=False)
    data_json = json.dumps(data, ensure_ascii=False)

    html = (HTML_HEAD
            .replace('__MARK__', MARK)
            .replace('__SEARCHICON__', SEARCH_ICON)
            .replace('__COUNT__', str(len(data)))
            .replace('__SCENE__', scene)
            .replace('__CATS__', cats_json)
            .replace('__DATA__', data_json))
    out_html = os.path.join(DESIGN, 'QQTang-sucai-v1.html')
    with io.open(out_html, 'w', encoding='utf-8') as f:
        f.write(html)

    print('\nSVG 合计 %d 个 / %.1f KB' % (len(data), total / 1024.0))
    print('页面 -> %s (%.1f KB)' % (out_html, len(html) / 1024.0))


if __name__ == '__main__':
    main()
