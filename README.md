# QQ糖 · 夺宝对决 v2

主页即游戏。地图编辑器是主页内的一个模式（顶栏「地图编辑」切换），
素材库与人物规格合并为独立页面（页签切换）。
纯静态多文件结构，**没有打包步骤**——双击 `v2/index.html` 就能玩；
像素素材与页面数据由 `tools/` 下的 Python 管线生成。

## 目录结构

```
v2/                        页面（双击 index.html 即玩，file:// 可用）
  index.html               主页 = 游戏 + 页内编辑器模式
  gallery.html             素材库 + 人物规格（页签）
  css/  js/                样式与脚本（js/game/ 按功能切成 22 个模块）
  data/                    生成数据（勿手改）：sprites / maps / tags / gallery-data / spec-data
  assets/                  生成资源（logo）
tools/
  build_v2.py              数据管线：生成 v2/data/*.js、v2/assets/logo.svg、assets/sucai/*.svg
  asset_db.py              素材总表（分类 / 来源 / 组合样张）
  spec_db.py               人物规格数据（糖豆 / 青羽 / 夜蔷薇 / 银霜）
  sucai_*.py               像素素材定义（人物 / 地图 / 炮弹 / 特效 / 道具）
  build_assets.py          糖豆点阵 + 调色板 + to_svg
  build_chars.py           青羽 / 夜蔷薇 / 银霜点阵
  obstacle_tags.py         障碍标签表（编辑器与素材库共用）
  sucai_logo.py            logo 生成（改 logo 后单独跑）
  maps/                    内置地图 JSON（丢一张进来重跑 build_v2 即可加图）
  tests/ + run_test.py     五套无头浏览器回归（267 条断言）
assets/sucai/              生成的 SVG 素材 —— 美术真源
sucai/                     原始参考图（仅本地，不入库）
```

## 常用命令

```
python tools/build_v2.py      改了素材定义 / 地图 / logo 后重新生成数据
python tools/run_test.py      全量回归（游戏 / 编辑器 / 集成 / AI / 素材库）
python tools/sucai_logo.py    只重新生成 logo
```

无头浏览器路径默认取 `C:\Program Files (x86)\...\msedge.exe`，
可用环境变量 `QQTANG_EDGE_PATH` 覆盖。

## 工作流约定

- **改游戏 / 编辑器代码**：直接改 `v2/js/game/*.js`、`v2/js/editor.js`、css、html，浏览器刷新即生效，无需构建。
- **别改 `v2/data/*`**：全是生成物。
- **改素材**：`assets/sucai/*.svg` 是真源，管线**不覆盖已存在的文件**（手调的满格炮弹等都以文件为准）；
  新增素材在 `tools/sucai_*.py` 里定义后跑 `build_v2.py` 生成初稿，之后直接改 SVG 文件精修。
- **加地图**：JSON 丢进 `tools/maps/`，重跑 `build_v2.py`；字段规范见 `tools/maps/README.md`。
- 游戏逻辑原本是单文件 `main.js`，现按原分段切成 `js/game/01-const.js … 22-boot.js`，
  加载顺序即原语句顺序，各文件共享全局作用域（勿包裹 IIFE）。
- 编辑器（`js/editor.js`）是 IIFE 隔离的页内模式；测试钩子 `window.__game` / `window.__editor`，
  断言在 `tools/tests/*.js`，跑法见 `tools/run_test.py`。
- 「用这张图开一局」= 编辑器存图 → `__game.addMap()` → 页内切回游戏模式（不再导出单文件网页）。
