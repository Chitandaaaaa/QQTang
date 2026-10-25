# -*- coding: utf-8 -*-
"""把游戏代码与 SVG 素材打包成单文件 HTML。

    python build_game.py
    -> QQTang-battle-v1.html      单文件分享版（双击即玩）
    -> dev/battle/                多文件开发版（index.html + 独立 js/css，调试用）
"""
import base64
import glob
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)
SVG_DIR = os.path.join(DESIGN, "assets", "sucai")
MAPS_DIR = os.path.join(HERE, "game", "maps")
OUT = os.path.join(DESIGN, "QQTang-battle-v1.html")
DEV_DIR = os.path.join(DESIGN, "dev", "battle")

# 游戏实际用到的素材
SPRITES = [
    "zelda-front", "zelda-side", "zelda-back",
    "link-front", "link-side", "link-back",
    "bomb", "boom-cell",
    # ---- 炮弹口味（sucai_bombs.FLAVORS，main.js BOMB_KINDS 同名引用）----
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
    # ---- 新增障碍：纯色方块（可炸 / 不可推动）+ 雪块（可炸 / 可推动）----
    "prop-block-red", "prop-block-violet", "prop-snowblock",
]

CSS = io.open(os.path.join(HERE, "game", "style.css"), encoding="utf-8").read()
JS = io.open(os.path.join(HERE, "game", "main.js"), encoding="utf-8").read()


def builtin_maps_js():
    """game/maps/*.json 按文件名排序打包成数组；加图 = 丢一个 JSON 进目录再构建"""
    maps = []
    for path in sorted(glob.glob(os.path.join(MAPS_DIR, "*.json"))):
        with io.open(path, encoding="utf-8") as f:
            maps.append(json.load(f))
    if len(maps) < 2:
        raise SystemExit("game/maps/ 里至少要有两张地图，现在只有 %d 张" % len(maps))
    print("  maps: %d 张 (%s)" % (len(maps), "、".join(m["name"] for m in maps)))
    return json.dumps(maps, ensure_ascii=False, separators=(",", ":"))


def logo_inline():
    """品牌 logo 直接内联（不 base64），体积省三分之一"""
    raw = io.open(os.path.join(SVG_DIR, "logo.svg"), encoding="utf-8").read()
    return "\n".join(l for l in raw.splitlines() if not l.strip().startswith("<!--"))


def data_uri(name):
    path = os.path.join(SVG_DIR, name + ".svg")
    raw = io.open(path, "rb").read()
    b64 = base64.b64encode(raw).decode("ascii")
    return "data:image/svg+xml;base64," + b64


def build_sprites():
    parts = []
    total = 0
    for name in SPRITES:
        uri = data_uri(name)
        total += len(uri)
        parts.append('    "%s": "%s"' % (name, uri))
    print("  sprites: %d 个, %.0f KB" % (len(SPRITES), total / 1024))
    return "{\n" + ",\n".join(parts) + "\n  }"


P1_KEYS = ('<div class="krow"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>'
           '<span class="lbl">移动</span></div>'
           '<div class="krow"><kbd class="space">空格</kbd><span class="lbl">放糖弹</span></div>')
P2_KEYS = ('<div class="krow"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>'
           '<span class="lbl">移动</span></div>'
           '<div class="krow"><kbd class="wide">回车</kbd><span class="lbl">放糖弹</span></div>')


def panel(n, name, sub, keys):
    ai = '<span class="ai-badge" id="ai{n}">AI 托管</span>'.format(n=n) if n == 2 else ''
    return f'''      <aside class="pcard" data-p="{n}" id="pc{n}">
        <div class="pc-head">
          <div class="pc-face"><img id="face{n}" alt="{name}"></div>
          <div>
            <h2>{name}</h2>
            <p>{sub}</p>
          </div>
          <span class="tag">P{n}</span>{ai}
        </div>
        <div class="pc-stats">
          <div class="stat"><span>糖弹</span><b id="b{n}">1<em>/1</em></b></div>
          <div class="stat"><span>威力</span><b id="ps{n}">1</b></div>
          <div class="stat"><span>速度</span><b id="sp{n}">1</b></div>
        </div>
        <div class="pc-bombs" id="pb{n}"></div>
        <div class="pc-keys" id="keys{n}">{keys}</div>
      </aside>'''


TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>夺宝对决 · QQ糖</title>
<style>
__CSS__
</style>
</head>
<body>
<div class="app">
  <header class="bar">
    <div class="brand">
      <span class="logo">__LOGO__</span>
    </div>
    <div class="score">
      <div class="side" id="side1"><i>塞尔达</i><b id="sc1">0</b></div>
      <span class="vs">:</span>
      <div class="side" id="side2"><b id="sc2">0</b><i>林克</i></div>
    </div>
    <button class="ghost" id="btnMap">地图 · 夺宝神殿</button>
    <button class="ghost" id="btnRestart">重开</button>
    <button class="ghost" id="btnSound">音效 开</button>
    <button class="ghost" id="btnEdit">地图编辑</button>
  </header>

  <main>
    <section class="stage" id="stage">
      <canvas id="cv" width="672" height="384"></canvas>
      <div class="overlay" id="ov"></div>
    </section>
    <div class="rail" id="rail">
__P1__
__P2__
    </div>
  </main>
</div>
<script>window.QQ_BUILTIN_MAPS=__MAPS__;</script>
<script>
__JS__
</script>
</body>
</html>
'''


def build_dev(sprites, maps_js):
    """多文件开发版：同一套源码，经典 <script src> 引用（不用 fetch/ES module），file:// 双击可用"""
    shell = TEMPLATE
    shell = shell.replace("<style>\n__CSS__\n</style>",
                          '<link rel="stylesheet" href="style.css">')
    shell = shell.replace(
        '<script>window.QQ_BUILTIN_MAPS=__MAPS__;</script>\n<script>\n__JS__\n</script>',
        '<script src="js/sprites.js"></script>\n'
        '<script src="js/maps.js"></script>\n'
        '<script src="js/game.js"></script>')
    assert "__CSS__" not in shell and "__JS__" not in shell and "__MAPS__" not in shell

    shell = shell.replace("__LOGO__", logo_inline())
    shell = shell.replace("__BOMB__", data_uri("bomb"))
    shell = shell.replace("__P1__", panel(1, "塞尔达", "PLAYER 1", P1_KEYS))
    shell = shell.replace("__P2__", panel(2, "林克", "PLAYER 2", P2_KEYS))

    js = JS.replace("__SPRITE_DATA__", "window.QQ_SPRITES")
    assert "__SPRITE_DATA__" not in js

    os.makedirs(os.path.join(DEV_DIR, "js"), exist_ok=True)
    io.open(os.path.join(DEV_DIR, "index.html"), "w", encoding="utf-8").write(shell)
    io.open(os.path.join(DEV_DIR, "style.css"), "w", encoding="utf-8").write(CSS)
    io.open(os.path.join(DEV_DIR, "js", "game.js"), "w", encoding="utf-8").write(js)
    io.open(os.path.join(DEV_DIR, "js", "sprites.js"), "w", encoding="utf-8").write(
        "window.QQ_SPRITES = " + sprites + ";\n")
    io.open(os.path.join(DEV_DIR, "js", "maps.js"), "w", encoding="utf-8").write(
        "window.QQ_BUILTIN_MAPS = " + maps_js + ";\n")
    print("  -> %s  (多文件开发版)" % os.path.relpath(DEV_DIR, DESIGN))


def main():
    print("打包 夺宝对决 ...")
    sprites = build_sprites()
    maps_js = builtin_maps_js()

    # JS 里的占位替换（用切片拼接，避免 .format 解析 JS 里的花括号）
    js = JS.replace("__SPRITE_DATA__", sprites)
    assert "__SPRITE_DATA__" not in js

    html = TEMPLATE
    html = html.replace("__CSS__", CSS)
    html = html.replace("__MAPS__", maps_js)
    html = html.replace("__JS__", js)
    html = html.replace("__LOGO__", logo_inline())
    html = html.replace("__BOMB__", data_uri("bomb"))
    html = html.replace("__P1__", panel(1, "塞尔达", "PLAYER 1", P1_KEYS))
    html = html.replace("__P2__", panel(2, "林克", "PLAYER 2", P2_KEYS))

    io.open(OUT, "w", encoding="utf-8").write(html)
    size = os.path.getsize(OUT) / 1024
    print("  -> %s  (%.0f KB)" % (os.path.relpath(OUT, DESIGN), size))

    build_dev(sprites, maps_js)


if __name__ == "__main__":
    main()
