# -*- coding: utf-8 -*-
"""QQ糖 v2 · 回归测试：生成数据 + 无头浏览器跑五套断言

    python tools/run_test.py          （或设 QQTANG_EDGE_PATH 指定浏览器）

    1) 游戏本体   tests/game_test.js    -> v2/index.html
    2) 地图编辑器 tests/editor_test.js   -> v2/index.html（页内模式）
    3) 集成       tests/itest.js        -> 编辑器图经 localStorage 进游戏
    4) AI 人机    tests/aitest.js       -> v2/index.html
    5) 素材库     tests/gallery_test.js -> v2/gallery.html（含人物规格页签）

原理：把 v2/ 拷进系统临时目录，测试脚本注进探针页副本，无头 Edge 跑完
从 data-diag 属性取断言结果。页面本身不因测试而改动。
"""
import html as H
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)
V2 = os.path.join(DESIGN, "v2")
EDGE = os.environ.get("QQTANG_EDGE_PATH") or \
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PROFILES = os.path.join(tempfile.gettempdir(), "qqtang-edge")
WORK = os.path.join(PROFILES, "v2")           # 探针工作目录：v2 的完整拷贝


def build_data():
    subprocess.run([sys.executable, os.path.join(HERE, "build_v2.py")], check=True, cwd=HERE)


def prepare_work():
    """把 v2/ 拷进临时目录，测试只改拷贝，不碰源文件"""
    if os.path.exists(WORK):
        shutil.rmtree(WORK)
    shutil.copytree(V2, WORK)


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


def suite(page_html, probe_name, test_js, prof, inject_head=""):
    """把测试脚本塞进探针页尾部（可选：在第一个 <script> 前插一段）"""
    html = io.open(os.path.join(WORK, page_html), encoding="utf-8").read()
    js = io.open(os.path.join(HERE, "tests", test_js), encoding="utf-8").read()
    if inject_head:
        html = html.replace("<script>", inject_head + "<script>", 1)
    html = html.replace("</body>", "<script>" + js + "</script></body>")
    probe = os.path.join(WORK, probe_name)
    io.open(probe, "w", encoding="utf-8").write(html)
    return run_edge(probe, prof)


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
    build_data()
    prepare_work()

    store = {"v": 1, "maps": [custom_map()]}
    inject = ("<script>try{localStorage.setItem('qqtang.maps.v1', %s);}catch(e){}</script>"
              % json.dumps(json.dumps(store, ensure_ascii=False)))

    suites = [
        ("游戏", "index.html", "game_test.js", "probe_game.html", "game", ""),
        ("编辑器", "index.html", "editor_test.js", "probe_editor.html", "editor", ""),
        ("集成", "index.html", "itest.js", "probe_integ.html", "integ", inject),
        ("AI", "index.html", "aitest.js", "probe_ai.html", "ai", ""),
        ("素材库", "gallery.html", "gallery_test.js", "probe_gallery.html", "gallery", ""),
    ]
    bad = 0
    for i, (title, page, js, probe, prof, inject_head) in enumerate(suites):
        print("\n=== %d/%d %s ===" % (i + 1, len(suites), title))
        bad += report(title, suite(page, probe, js, os.path.join(PROFILES, prof), inject_head))

    print("\n总计失败 %d 条" % bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
