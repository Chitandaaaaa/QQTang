# QQTang 重构方案：单文件 HTML → 多文件 dev 产物 + 源码模块化

## 现状诊断（重构前）

4 个大 HTML 全是**构建产物**（纯 Python 工具链，无 npm），体积大头是内联数据，不是手写代码：

| 文件 | 体积 | 构成 |
|---|---|---|
| QQTang-sucai-v1.html | 1.39 MB | 74% 是素材 JSON（SVG 字符串内联），977 行超长行 |
| QQTang-mapeditor-v1.html | 1.35 MB | 把**整个游戏**以 JSON 转义字符串内嵌 |
| QQTang-battle-v1.html | 1.26 MB | 素材 base64 占大头 + game/main.js 94KB |
| QQTang-kit-v1.html | 244 KB | 规格页，模板硬编码在 Python 里 |

手写源码现状：`tools/game/main.js` 2151 行单文件（按 banner 注释分段）、`tools/editor/main.js` 1152 行；sucai/kit 两页的 HTML/CSS/JS 全部以 **Python 字符串**形式困在 `build_sucai.py`（935 行）和 `build_sheet_all.py` 里。**项目无 git**（仅 .gitignore）。

脚本核实结论：4 个测试 JS（_test/_itest/_aitest/editor_test）全部活跃，保留；死代码仅 `build_tiles.py` + `check_tiles.py`；`build_sheet_chars.py` 被 `build_sheet_all.py` import 当共享库，**不能删**。

## 重构后（对比）

| 维度 | 重构前 | 重构后 |
|---|---|---|
| 日常调试打开 | 1.3MB 单文件 | `dev/*/index.html`（几 KB 壳，双击即玩，可断点） |
| 游戏页产物 | 1.26MB 单文件 | dev/battle/：index.html ~3KB + style.css 16KB + game.js 94KB + sprites.js ~1.1MB + maps.js |
| 编辑器产物 | 1.35MB（内嵌游戏） | dev/editor/ 不再内嵌，通过 `QQ_GAME_URL` 引用 ../battle/ |
| sucai/kit 源码 | Python 字符串 | tools/sucai/、tools/kit/ 真实 .html/.css/.js，数据隔离在 data.js |
| 游戏主源码 | main.js 2151 行 | src/ 按现有分段拆 ~12 个模块（构建按序拼接） |
| 分享产物 | 4 个单文件 | **原样保留在根目录**，由同一套源码产出 |
| 脚本 | 25 个 py（2 个死） | 删 2 个死脚本，run_test.py 去 Edge 硬编码 |
| 版本管理 | 无 | git init，每阶段一次提交 |

## 实施步骤

**P0 安全网**：`git init` + 首次全量提交；跑 `python tools/run_test.py` 记录基线（注意 AI 测试偶发抖动，失败先重跑再判断）。

**P1 游戏页 dev 产物**：`build_game.py` 增加 dev 输出 → `dev/battle/`。dev 的 game.js 把 `__SPRITE_DATA__` 替换为 `window.QQ_SPRITES`，sprites.js/maps.js/style.css 独立成文件（经典 `<script src>`，不用 fetch/ES module，**file:// 双击仍可用**）。验证：根目录单文件产物字节级不变 + run_test 全绿 + 浏览器打开 dev 页冒烟。

**P2 编辑器页 dev 产物**：`build_editor.py` 同样输出 `dev/editor/`；编辑器 JS 加一个入口分支——存在 `window.QQ_GAME_URL` 时用 iframe 加载 `../battle/index.html`（dev 注入），否则维持现有内嵌物化逻辑（单文件分享版行为零变化）。验证：_itest.js 集成测试 + dist 一致。若 file:// iframe 有兼容问题，回退为「仅分离编辑器自身代码」。

**P3 sucai/kit 页面源码外置**：把 `build_sucai.py` 的 HTML_HEAD/页面 JS/CSS、`build_sheet_all.py` 的 TEMPLATE 抽成 `tools/sucai/`、`tools/kit/` 下的真实源文件（Python 只做数据生成 + 占位符注入，与 game/editor 同构），并输出 dev 版（素材数据落 data/sucai-data.js）。验证：dist 产物字节级一致 + 手动冒烟（这两页无自动化测试）。

**P4 游戏与编辑器主源码模块化**：`game/main.js` 按现有 banner 分段切成 `tools/game/src/01-const.js … 90-boot.js`，editor 同理；构建脚本按文件名排序拼接进 IIFE。验证铁律：**src 顺序拼接结果与原文件字节级一致**（不含任何代码改动），dist 必然不变 + run_test 全绿。

**P5 脚本清理与收尾**：删除 `build_tiles.py`、`check_tiles.py`；`run_test.py` Edge 路径改为 `QQTANG_EDGE_PATH` 环境变量 + 常见路径自动探测；修正 build_sucai.py 里指向已删页面的过时文案（此时 sucai 输出会出现预期内的小 diff）；写根 README.md 说明构建/开发/测试流程。

每阶段独立提交；动手前重读文件（你常多窗口并行改 main.js）。完成后我会同步更新记忆里的构建管线说明（main.js → src/ 布局）。

## 测试命令不变

`python tools/run_test.py` —— 4 个测试 JS、回归锚点全部保留不动。