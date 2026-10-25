# -*- coding: utf-8 -*-
"""把地图编辑器与 SVG 素材打包成单文件 HTML。

    python build_editor.py
    -> QQTang-mapeditor-v1.html   单文件分享版
    -> dev/editor/                多文件开发版（index.html + 独立 js/css）

游戏本体（main.js / style.css / 素材 data URI）会一起塞进来，
这样编辑器能直接「导出一份烧好当前地图的可玩网页」，不需要联网。
dev 版同样保留这份内嵌副本（导出功能要离线可用）；
「用这张图开一局」则通过注入的 QQ_GAME_URL 指向 dev/battle/。
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_game  # noqa: E402  复用游戏的素材清单与 HTML 模板
import obstacle_tags  # noqa: E402  障碍标签（与素材页共用同一份定义）

DESIGN = os.path.dirname(HERE)
OUT = os.path.join(DESIGN, "QQTang-mapeditor-v1.html")
DEV_DIR = os.path.join(DESIGN, "dev", "editor")

CSS = io.open(os.path.join(HERE, "editor", "style.css"), encoding="utf-8").read()
JS = io.open(os.path.join(HERE, "editor", "main.js"), encoding="utf-8").read()
GAME_JS = io.open(os.path.join(HERE, "game", "main.js"), encoding="utf-8").read()
GAME_CSS = io.open(os.path.join(HERE, "game", "style.css"), encoding="utf-8").read()


def js_string(s):
    """安全地塞进 <script> 里的字符串字面量（</script> 会提前闭合标签）"""
    return json.dumps(s, ensure_ascii=False).replace("</", "<\\/")


def build_sprites():
    parts, total = [], 0
    for name in build_game.SPRITES:
        uri = build_game.data_uri(name)
        total += len(uri)
        parts.append('    "%s": "%s"' % (name, uri))
    print("  sprites: %d 个, %.0f KB" % (len(build_game.SPRITES), total / 1024))
    return "{\n" + ",\n".join(parts) + "\n  }"


def game_tpl():
    """游戏页面的 HTML 模板：logo / 两侧面板填好，留出 __CSS__ __JS__ 和一个 <!--MAPS--> 插口"""
    t = build_game.TEMPLATE
    t = t.replace("__LOGO__", build_game.logo_inline())
    t = t.replace("__P1__", build_game.panel(1, "塞尔达", "PLAYER 1", build_game.P1_KEYS))
    t = t.replace("__P2__", build_game.panel(2, "林克", "PLAYER 2", build_game.P2_KEYS))
    t = t.replace("<script>", "<!--MAPS-->\n<script>")
    assert "<!--MAPS-->" in t
    return t


TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>地图编辑器 · QQ糖</title>
<style>
__CSS__
</style>
</head>
<body>
<div class="app">
  <header class="bar">
    <div class="brand">
      <span class="logo">__LOGO__</span>
      <div class="ttl"><b>地图编辑器</b><i>MAP EDITOR · 21 × 12 · 32PX</i></div>
    </div>
    <div class="spacer"></div>
    <button class="ghost" id="btnNew">新建</button>
    <button class="ghost" id="btnSave">保存</button>
    <button class="ghost" id="btnSaveAs">另存为</button>
    <button class="ghost" id="btnExport">导出 JSON</button>
    <button class="ghost" id="btnImport">导入</button>
    <button class="ghost" id="btnHtml">导出可玩网页</button>
    <button class="primary" id="btnPlay">用这张图开一局</button>
  </header>

  <main>
    <aside class="panel" id="pal"></aside>

    <section class="board">
      <div class="tools" id="tools">
        <span class="lab">工具</span>
        <div class="seg">
          <button data-tool="brush" type="button">画笔</button>
          <button data-tool="rect" type="button">矩形</button>
          <button data-tool="fill" type="button">油漆桶</button>
        </div>
        <div class="seg">
          <button id="btnUndo" type="button">撤销</button>
          <button id="btnRedo" type="button">重做</button>
        </div>
        <div class="div"></div>
        <div class="seg"><button id="btnGrid" type="button">网格</button></div>
        <div class="div"></div>
        <div class="seg">
          <button id="btnRand" type="button">随机生成</button>
          <button id="btnSym" type="button">对称生成</button>
        </div>
        <div class="seg">
          <button id="btnMirrorX" type="button">左右镜像</button>
          <button id="btnMirrorY" type="button">上下镜像</button>
          <button id="btnMirrorO" type="button">中心对称</button>
        </div>
        <div class="seg"><button id="btnClear" type="button">清空</button></div>
      </div>

      <div class="cwrap"><canvas id="cv"></canvas></div>

      <div class="hint">
        <span><b>左键</b> 落笔 · <b>右键</b> 擦掉 · <b>1/2/3</b> 切工具 · <b>Ctrl+Z</b> 撤销 · <b>Ctrl+S</b> 保存</span>
        <span>出生点各只有一个，挪到新格子时旧的会自动清掉</span>
      </div>
    </section>

    <aside class="panel">
      <div class="fld">
        <label>地图名</label>
        <input type="text" id="fName" maxlength="18" placeholder="我的地图">
      </div>
      <div class="fld">
        <label>主题（决定粒子色与默认贴图）</label>
        <select id="fTheme">
          <option value="temple">夺宝神殿</option>
          <option value="ice">冰原</option>
        </select>
      </div>
      <div class="fld">
        <label>可炸障碍掉落率 · <b id="fDropVal">40%</b></label>
        <input type="range" id="fDrop" min="0" max="0.9" step="0.05" value="0.4">
      </div>
      <div class="fld">
        <label>地面</label>
        <div class="row2"><button class="mini-btn" id="btnFloor" type="button">铺满当前主题地面</button></div>
      </div>

      <div class="lib" id="tagLegend">
        <h4>障碍标签</h4>
__TAG_LEGEND__
      </div>

      <div class="chk">
        <h4>校验</h4>
        <div id="chkList"></div>
        <div id="chkBadge" class="crow"></div>
      </div>

      <div class="lib">
        <h4>模板（拿内置地图改）</h4>
        <div id="tplList">
          <button class="mini-btn" data-tpl="temple" type="button">夺宝神殿</button>
          <button class="mini-btn" data-tpl="ice" type="button">冰原</button>
        </div>
      </div>

      <div class="lib">
        <h4>我的地图（存在本机浏览器里）</h4>
        <div id="libList"></div>
      </div>
    </aside>
  </main>
</div>

<input type="file" id="fileIn" accept=".json,application/json" hidden>
<div class="toast" id="toast"></div>
<script>
__JS__
</script>
</body>
</html>
'''


def tag_legend():
    """侧栏的标签速查：把 obstacle_tags 那张表原样列出来"""
    rows = []
    for ch, k in obstacle_tags.KINDS.items():
        chips = ''.join('<span class="chip %s">%s</span>' % (tone, label)
                        for label, tone in obstacle_tags.chips(ch))
        rows.append('<div class="tagrow"><b>%s</b><div class="tags">%s</div>'
                    '<i>%s</i></div>' % (k['name'], chips, k['note']))
    return '\n        '.join(rows)


def build_js():
    """编辑器 JS + 全部内嵌数据（游戏副本/素材/障碍标签），单文件版与 dev 版共用"""
    sprites = build_sprites()

    assert JS.count("__SPRITE_DATA__") == 1, JS.count("__SPRITE_DATA__")
    js = JS.replace("__SPRITE_DATA__", sprites)
    js = js.replace("__GAME_TPL__", js_string(game_tpl()))
    js = js.replace("__GAME_JS__", js_string(GAME_JS))
    js = js.replace("__GAME_CSS__", js_string(GAME_CSS))
    js = js.replace("__OBSTACLE_TAGS__", json.dumps(
        obstacle_tags.js_table(), ensure_ascii=False, sort_keys=True))
    for k in ("__GAME_TPL__", "__GAME_JS__", "__GAME_CSS__"):
        assert k not in js, k
    # __SPRITE_DATA__ 要留一份在游戏脚本里，导出可玩网页时由编辑器现场填素材
    assert js.count("__SPRITE_DATA__") == 1, js.count("__SPRITE_DATA__")
    return js


def build_dev(js):
    """多文件开发版：dev/editor/，壳与样式/脚本分文件，QQ_GAME_URL 指向 dev/battle/"""
    shell = TEMPLATE
    shell = shell.replace("<style>\n__CSS__\n</style>",
                          '<link rel="stylesheet" href="style.css">')
    shell = shell.replace(
        '<script>\n__JS__\n</script>',
        "<script>window.QQ_GAME_URL = '../battle/index.html';</script>\n"
        '<script src="js/editor.js"></script>')
    assert "__CSS__" not in shell and "__JS__" not in shell

    shell = shell.replace("__LOGO__", build_game.logo_inline())
    shell = shell.replace("__TAG_LEGEND__", tag_legend())

    os.makedirs(os.path.join(DEV_DIR, "js"), exist_ok=True)
    io.open(os.path.join(DEV_DIR, "index.html"), "w", encoding="utf-8").write(shell)
    io.open(os.path.join(DEV_DIR, "style.css"), "w", encoding="utf-8").write(CSS)
    io.open(os.path.join(DEV_DIR, "js", "editor.js"), "w", encoding="utf-8").write(js)
    print("  -> %s  (多文件开发版)" % os.path.relpath(DEV_DIR, DESIGN))


def main():
    print("打包 地图编辑器 ...")
    js = build_js()

    html = TEMPLATE.replace("__CSS__", CSS).replace("__JS__", js)
    html = html.replace("__LOGO__", build_game.logo_inline())
    html = html.replace("__TAG_LEGEND__", tag_legend())

    io.open(OUT, "w", encoding="utf-8").write(html)
    print("  -> %s  (%.0f KB)" % (os.path.relpath(OUT, DESIGN), os.path.getsize(OUT) / 1024))

    build_dev(js)


if __name__ == "__main__":
    main()
