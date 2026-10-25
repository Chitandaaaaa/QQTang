# -*- coding: utf-8 -*-
"""构建 + 无头浏览器跑回归：
   1) 游戏本体    game/_test.js
   2) 地图编辑器  editor/_test.js
   3) 集成：把编辑器导出的地图塞进 localStorage，验证游戏真的用上了 game/_itest.js
"""
import io
import json
import html as H
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PY = sys.executable
# 浏览器配置和探针页放系统临时目录，不污染项目
PROFILES = os.path.join(tempfile.gettempdir(), "qqtang-edge")

GAME = os.path.join(DESIGN, "QQTang-battle-v1.html")
EDITOR = os.path.join(DESIGN, "QQTang-mapeditor-v1.html")


def run_edge(page, prof, budget=25000):
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--no-sandbox",
           "--allow-file-access-from-files", "--user-data-dir=" + prof,
           "--window-size=1440,1000", "--virtual-time-budget=%d" % budget,
           "--dump-dom", "file:///" + page.replace("\\", "/")]
    res = subprocess.run(cmd, capture_output=True, timeout=240)
    dom = res.stdout.decode("utf-8", "ignore")
    i = dom.find('data-diag="')
    if i < 0:
        print("!! 没拿到诊断数据，DOM 长度", len(dom))
        print(dom[:1200])
        return None
    j = dom.find('"', i + len('data-diag="'))
    return json.loads(H.unescape(dom[i + len('data-diag="'):j]))


def report(title, d):
    if not d:
        print("%s：失败（没拿到诊断）" % title)
        return 1
    print("%s  PASS %d / FAIL %d" % (title, len(d["ok"]), len(d["bad"])))
    for b in d["bad"]:
        print("  x", b)
    for k in d["ok"]:
        print("  .", k)
    for k, v in d["logs"].items():
        print("  log", k, "=", v)
    return len(d["bad"])


def suite(out_html, test_js, prof, inject_head=""):
    """把测试脚本塞到页面尾部（可选：在第一个 <script> 前插一段）"""
    html = io.open(out_html, encoding="utf-8").read()
    js = io.open(test_js, encoding="utf-8").read()
    if inject_head:
        html = html.replace("<script>", inject_head + "<script>", 1)
    html = html.replace("</body>", "<script>" + js + "</script></body>")
    tmp = os.path.join(PROFILES, "_probe_" + os.path.basename(prof) + ".html")
    os.makedirs(PROFILES, exist_ok=True)
    io.open(tmp, "w", encoding="utf-8").write(html)
    return run_edge(tmp, prof)


# ---------------------------------------------------------------- 集成用的地图
def custom_map():
    rows = []
    for y in range(12):
        line = ""
        for x in range(21):
            if x == 0 or y == 0 or x == 20 or y == 11:
                line += "#"
            else:
                line += "."
        rows.append(line)
    def put(x, y, ch):
        rows[y] = rows[y][:x] + ch + rows[y][x + 1:]
    put(1, 1, "1")
    put(19, 10, "2")
    put(5, 5, "c")        # 可炸障碍
    put(8, 7, "$")        # 宝箱
    put(3, 3, "d")        # 实心装饰（雪人，挡路）
    put(9, 4, "s")        # 雪块（可炸 / 可推动）
    frows = ["7" * 21 for _ in range(12)]     # 整张铺冰面
    return {
        "v": 1, "id": "u_testmap", "name": "集成测试图", "theme": "temple", "drop": 0.6,
        "rows": rows, "frows": frows,
        "pal": {"#": "wall-icebrick", "P": "wall-icepillar", "c": "prop-iceblock",
                "$": "prop-icechest", "s": "prop-snowblock", "d": "prop-snowman"}
    }


def main():
    subprocess.run([PY, os.path.join(HERE, "build_game.py")], check=True, cwd=HERE)
    subprocess.run([PY, os.path.join(HERE, "build_editor.py")], check=True, cwd=HERE)

    bad = 0
    print("\n=== 1/3 游戏本体 ===")
    bad += report("游戏", suite(GAME, os.path.join(HERE, "game", "_test.js"),
                                os.path.join(PROFILES, "game")))

    print("\n=== 2/3 地图编辑器 ===")
    bad += report("编辑器", suite(EDITOR, os.path.join(HERE, "editor", "_test.js"),
                                  os.path.join(PROFILES, "editor")))

    print("\n=== 3/3 集成：编辑器 -> 游戏 ===")
    store = {"v": 1, "maps": [custom_map()]}
    inject = ("<script>try{localStorage.setItem('qqtang.maps.v1', %s);}catch(e){}</script>"
              % json.dumps(json.dumps(store, ensure_ascii=False)))
    bad += report("集成", suite(GAME, os.path.join(HERE, "game", "_itest.js"),
                                os.path.join(PROFILES, "integ"), inject))

    print("\n=== 4/4 AI 人机 ===")
    bad += report("AI", suite(GAME, os.path.join(HERE, "game", "_aitest.js"),
                              os.path.join(PROFILES, "ai")))

    print("\n总计失败 %d 条" % bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
