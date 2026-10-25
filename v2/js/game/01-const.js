/* =========================================================================
   QQ糖 · 夺宝对决  —  游戏逻辑与渲染
   画面 672×384，21×12 格，每格 32px；素材全部来自 assets/sucai 的 SVG。
   两张地图同一尺寸，靠主题切换整套贴图：夺宝神殿 / 冰原。
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 常量 */
  const TILE = 32, COLS = 21, ROWS = 12, W = COLS * TILE, H = ROWS * TILE;

  /* 人物贴图 32×32 正好一格，碰撞体也是一整格（32×32），
     但位置是连续像素 —— 一格再切 4 个 8px 子格，站在格子里的任意位置。
     身体只要压到实心格就走不过去，所以「左右有墙」时一格都挪不动。 */
  const SUB = 8;                 // 子格边长（像素）
  const STEP = 0.15;             // 走一格耗时（秒）
  const SPEED = TILE / STEP;     // 每秒像素
  const ALIGN_MAX = TILE / 2 + 4; // 拐弯时最多横向修正这么多像素

  /* DECOR 是实心装饰（雪人）：挡路、挡糖弹，但炸不开也推不动。
     PUSH 是雪块：可炸，也是唯一能被人物顶着推走的障碍 ——
     对正了按住方向 0.05s 推一格，去处没有遮挡才动。 */
  const EMPTY = 0, WALL = 1, PILLAR = 2, CRATE = 3, AMPHORA = 4, CHEST = 5,
        DECOR = 6, PUSH = 7;

  /* 地砖代号（自定义地图的 frows 用这些下标） */
  const FLOOR_KEYS = [
    'tile-sand', 'tile-temple', 'tile-carpet', 'tile-carpet-emblem',
    'tile-carpet-astral', 'tile-carpet-rune', 'tile-carpet-vortex',
    'tile-ice', 'tile-ice-snow'
  ];

  const FUSE = 2.4;         // 糖弹引信（秒）
  const FLAME_LIFE = 0.28;  // 火焰存留（纯视觉，伤害只在爆炸那一瞬间结算）
  const POWER_MAX = 5, BOMB_MAX = 4, WIN_ROUND = 3;
  const DROPS = ['power', 'bomb', 'speed'];   // 木箱/宝箱掉的三样
  const PUSH_SPRITE = 'prop-snowblock';       // 雪块（可推动）的默认贴图
  const PUSH_DELAY = 0.05;  // 顶着雪块按住方向：蓄这么久推一格
  const PUSH_ANIM = 0.07;   // 雪块被推的滑动动画（纯视觉，逻辑上落格是瞬间的）

  /* 炮弹口味：key / cell 对应 assets/sucai 里的 SVG 名，glow 是主色 rgb
     （爆炸的光晕跟着口味走）。加新口味 = 素材放进 sucai + 在表里加一行，
     准备页和局内面板的选择条都会自动多一个格子。 */
  const BOMB_KINDS = [
    { key: 'candy-bomb',   cell: 'boom-cell-strawberry', name: '草莓',   glow: '255,94,134' },
    { key: 'bomb-mint',    cell: 'boom-cell-mint',       name: '薄荷',   glow: '79,209,181' },
    { key: 'bomb-choco',   cell: 'boom-cell-choco',      name: '巧克力', glow: '140,90,60' },
    { key: 'bomb-lemon',   cell: 'boom-cell-lemon',      name: '柠檬',   glow: '242,193,78' },
    { key: 'bomb-grape',   cell: 'boom-cell-grape',      name: '葡萄',   glow: '155,107,224' },
    { key: 'bomb-soda',    cell: 'boom-cell-soda',       name: '汽水',   glow: '79,168,232' },
    { key: 'bomb-melon',   cell: 'boom-cell-melon',      name: '蜜瓜',   glow: '126,217,87' },
    { key: 'bomb-gold',    cell: 'boom-cell-gold',       name: '黄金',   glow: '233,185,62' },
    { key: 'bomb-rainbow', cell: 'boom-cell-rainbow',    name: '彩虹',   glow: '255,255,255' },
  ];
  const KIND_BY_KEY = {};
  BOMB_KINDS.forEach(k => { KIND_BY_KEY[k.key] = k; });

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

  /* 地图数据不写死在这里：内置图放在 game/maps/*.json，一张图一个文件，
     文件名排序即出场顺序，构建时由 build_game.py 烧进 window.QQ_BUILTIN_MAPS。
     编辑器做的自定义图（localStorage qqtang.maps.v1 / 导出 HTML 里的
     window.__QQTANG_MAPS__）由下面的 loadUserMaps 接在内置图后面。
     rows 字符： # 硬墙  P 立柱  c 可炸障碍  o 陶罐/雪堆  $ 宝箱
                s 雪块（可炸；对正按住方向可推着走）  d 实心装饰（雪人，挡路但炸不开）
                . 空地  1/2 出生点    字段说明见 game/maps/README.md */
  const MAPS = (Array.isArray(window.QQ_BUILTIN_MAPS) ? window.QQ_BUILTIN_MAPS : []).slice();

