/* =========================================================================
   QQ糖 · 夺宝对决  —  游戏逻辑与渲染
   画面 672×384，21×12 格，每格 32px；素材全部来自 assets/sucai 的 SVG。
   两张地图同一尺寸，靠主题切换整套贴图：夺宝神殿 / 冰原。
   ========================================================================= */
(function () {
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

  /* ------------------------------------------------------------- 自定义地图
     编辑器（QQTang-mapeditor-v1.html）把地图存进 localStorage，或者烧进导出的
     单文件 HTML（window.__QQTANG_MAPS__）。这里读出来，接在内置地图后面。

     格式：{ v:1, id, name, theme, drop, rows[], frows[], pal:{'#':..,'P':..,'c':..,'$':..,'d':..} }
     rows 字符： # 硬墙  P 石柱  c 可炸  $ 宝箱  d 装饰（不挡路）  1/2 出生点  . 空地
     frows 字符： FLOOR_KEYS 的下标 '0'..'8'
     pal：给某一类格子换个贴图（比如神殿里摆冰块），不给就用主题默认。 */
  const STORE_KEY = 'qqtang.maps.v1';

  function normalizeMap(raw) {
    if (!raw || !Array.isArray(raw.rows) || raw.rows.length !== ROWS) return null;
    const rows = raw.rows.map(r => {
      let s = String(r == null ? '' : r);
      while (s.length < COLS) s += '.';
      return s.slice(0, COLS).replace(/[^#Pc$sd12.]/g, '.');
    });
    // 出生点各留一个，多余的降级成空地
    let s1 = null, s2 = null;
    for (let y = 0; y < ROWS; y++) {
      let r = rows[y];
      for (let x = 0; x < COLS; x++) {
        const ch = r[x];
        if (ch === '1') { if (s1) r = r.slice(0, x) + '.' + r.slice(x + 1); else s1 = [x, y]; }
        else if (ch === '2') { if (s2) r = r.slice(0, x) + '.' + r.slice(x + 1); else s2 = [x, y]; }
      }
      rows[y] = r;
    }
    if (!s1 || !s2) return null;                 // 没有两个出生点，这张图没法开局

    let frows = null;
    if (Array.isArray(raw.frows) && raw.frows.length === ROWS) {
      frows = raw.frows.map(r => {
        let s = String(r == null ? '' : r);
        while (s.length < COLS) s += '0';
        return s.slice(0, COLS).replace(/[^0-8]/g, '0');
      });
    }

    const base = MAPS.find(m => m.id === raw.theme) || MAPS[0];
    const pal = (raw.pal && typeof raw.pal === 'object') ? raw.pal : {};
    const drop = typeof raw.drop === 'number' ? Math.max(0, Math.min(1, raw.drop)) : base.drop;
    return {
      id: String(raw.id || ('u_' + Math.random().toString(36).slice(2, 8))),
      name: String(raw.name || '自定义地图').slice(0, 18),
      sub: 'CUSTOM', custom: true,
      wall: pal['#'] || base.wall, pillar: pal['P'] || base.pillar,
      crate: pal['c'] || base.crate, urn: base.urn, chest: pal['$'] || base.chest,
      floor: { base: base.floor.base, lane: base.floor.lane, laneX: base.floor.laneX,
               emblemAt: base.floor.emblemAt, emblem: base.floor.emblem,
               speckle: frows ? 0 : base.floor.speckle },
      frows: frows, pal: pal,
      dust: base.dust, dust2: base.dust2, debris: base.debris,
      decor: null,                                 // 自定义地图的装饰全部手摆，不再随机撒
      drop: drop, rows: rows
    };
  }

  function loadUserMaps() {
    const out = [];
    const take = raw => { const m = normalizeMap(raw); if (m) out.push(m); };
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (s) {
        const j = JSON.parse(s);
        const arr = Array.isArray(j) ? j : (j && Array.isArray(j.maps) ? j.maps : []);
        arr.forEach(take);
      }
    } catch (e) { console.warn('自定义地图读取失败', e); }
    if (Array.isArray(window.__QQTANG_MAPS__)) window.__QQTANG_MAPS__.forEach(take);

    const used = {};
    MAPS.forEach(m => { used[m.id] = 1; });
    return out.filter(m => { if (used[m.id]) return false; used[m.id] = 1; return true; });
  }
  loadUserMaps().forEach(m => MAPS.push(m));

  const SPRITES = __SPRITE_DATA__;

  /* ------------------------------------------------------------- 画布 */
  /* 逻辑坐标永远是 W×H（672×384），内部像素按「视图倍率 × 设备像素比」放大，
     这样画布可以随窗口变大而变清晰，而不是把 672 宽的位图硬拉大。 */
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const BASE_DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const SCALE_STEPS = [1, 1.25, 1.5, 1.75, 2];
  let SCALE = 1, RS = BASE_DPR;
  cv.width = Math.round(W * RS);
  cv.height = Math.round(H * RS);
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const IMG = {};
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  const bx = bg.getContext('2d');
  bx.imageSmoothingEnabled = false;

  /* ------------------------------------------------------------- 状态 */
  const state = {
    phase: 'ready',   // ready | play | over
    mode: 'pve',      // pve（人机对战，P2 由 AI 托管）| pvp（双人对战）
    mapIdx: 0,        // 当前地图（MAPS 下标）
    time: 0,
    tiles: [],
    bombs: [], flames: [], powerups: [], parts: [],
    pushAnims: [],    // 正在滑入新格子的雪块（纯视觉）
    players: [],
    shake: 0, flash: 0,
    overTimer: -1,
    muted: false,
    aiBombs: 0        // AI 累计放过的糖弹数（测试用）
  };

  let SPAWNS = [];

  /* ------------------------------------------------------------- 音效 */
  let AC = null, noiseBuf = null;
  function audio() {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      const n = AC.sampleRate * 0.5;
      noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, type, gain, slideTo) {
    const a = audio(); if (!a || state.muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.setValueAtTime(gain == null ? 0.06 : gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }
  function sfx(name) {
    if (state.muted) return;
    const a = audio(); if (!a) return;
    if (name === 'place') { tone(300, 0.09, 'square', 0.05, 160); }
    else if (name === 'boom') {
      const s = a.createBufferSource(); s.buffer = noiseBuf;
      const f = a.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(1800, a.currentTime);
      f.frequency.exponentialRampToValueAtTime(220, a.currentTime + 0.34);
      const g = a.createGain();
      g.gain.setValueAtTime(0.24, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4);
      s.connect(f); f.connect(g); g.connect(a.destination);
      s.start();
      tone(90, 0.3, 'sine', 0.16, 46);
    } else if (name === 'pick') { tone(660, 0.07, 'triangle', 0.05); setTimeout(() => tone(990, 0.1, 'triangle', 0.05), 60); }
    else if (name === 'die') { tone(420, 0.5, 'sawtooth', 0.07, 70); }
    else if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.06), i * 110)); }
    else if (name === 'draw') { tone(300, 0.4, 'sine', 0.06, 180); }
    else if (name === 'push') { tone(140, 0.1, 'square', 0.05, 84); }
    else if (name === 'step') { /* 静音脚步，避免吵闹 */ }
  }

  /* ------------------------------------------------------------- 工具 */
  const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(x, y, s) {
    let n = (x * 73856093) ^ (y * 19349663) ^ ((s | 0) * 83492791);
    n = (n ^ (n >> 13)) * 1274126177;
    return Math.abs(n ^ (n >> 16)) % 1000 / 1000;
  }

  /* ------------------------------------------------------------- 地图 */
  const theme = () => MAPS[state.mapIdx];

  /* 自定义地图可以给每一类格子指定贴图，记在 SPRITE_GRID 里；内置地图全是 null，走主题默认 */
  let SPRITE_GRID = [];

  /* 只走空地（不炸任何东西）能不能从 1 号出生点摸到 2 号 */
  function walkableOk(tiles) {
    if (SPAWNS.length < 2) return true;
    const a = SPAWNS[0], b = SPAWNS[1];
    const seen = new Set([a.x + ',' + a.y]);
    const q = [a];
    let head = 0;
    while (head < q.length) {
      const c = q[head++];
      if (c.x === b.x && c.y === b.y) return true;
      for (const k in DIRS) {
        const d = DIRS[k], nx = c.x + d[0], ny = c.y + d[1], key = nx + ',' + ny;
        if (!inside(nx, ny) || seen.has(key)) continue;
        if (tiles[ny][nx] !== EMPTY) continue;
        seen.add(key); q.push({ x: nx, y: ny });
      }
    }
    return false;
  }

  /* 主题装饰（冰原的小雪人）：只塞在冰缝角落里，而且放下去两个出生点
     必须还走得通，否则这一格就不放 —— 雪人已经是实心的了，不能堵死路。 */
  function placeDecor(tiles) {
    const solid = v => v === WALL || v === PILLAR || v === CRATE || v === AMPHORA
      || v === CHEST || v === PUSH || v === DECOR;
    const spots = [];
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (tiles[y][x] !== EMPTY) continue;
        let around = 0;                       // 四周至少两格实心，说明是冰缝不是路口
        if (solid(tiles[y][x - 1])) around++;
        if (solid(tiles[y][x + 1])) around++;
        if (solid(tiles[y - 1][x])) around++;
        if (solid(tiles[y + 1][x])) around++;
        if (around < 2) continue;
        if (SPAWNS.some(sp => Math.abs(sp.x - x) + Math.abs(sp.y - y) <= 2)) continue;
        if (hash(x, y, 13) > 0.1) continue;
        spots.push([x, y]);
      }
    }
    for (const s of spots) {
      tiles[s[1]][s[0]] = DECOR;
      if (!walkableOk(tiles)) tiles[s[1]][s[0]] = EMPTY;   // 会堵死就撤回来
    }
  }

  function parseMap() {
    SPAWNS = [];
    const th = theme();
    const rows = th.rows, pal = th.pal || null;
    const t = [], sg = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [], srow = [];
      for (let x = 0; x < COLS; x++) {
        const ch = rows[y][x];
        let v = EMPTY;
        if (ch === '#') v = WALL;
        else if (ch === 'P') v = PILLAR;
        else if (ch === 'c') v = CRATE;
        else if (ch === 'o') v = AMPHORA;
        else if (ch === '$') v = CHEST;
        else if (ch === 's') v = PUSH;
        else if (ch === 'd') v = DECOR;
        else if (ch === '1' || ch === '2') SPAWNS[+ch - 1] = { x, y };
        row.push(v);
        srow.push(pal ? (typeof pal[ch] === 'string' ? pal[ch] : null) : null);
      }
      t.push(row); sg.push(srow);
    }
    SPRITE_GRID = sg;
    if (th.decor) placeDecor(t);
    return t;
  }

  function floorAt(x, y) {
    const th = theme();
    const f = th.floor;
    /* 自定义地图手绘的地面层优先 */
    if (th.frows) {
      const k = FLOOR_KEYS[+th.frows[y][x]];
      if (k) return k;
    }
    if (f.emblemAt && x === f.emblemAt[0] && y === f.emblemAt[1]) return f.emblem;
    if (x === f.laneX) return f.lane;                    // 中央纵向大道
    if (f.speckle && hash(x, y, 7) < f.speckle) return f.lane;
    return f.base;
  }

  function bakeBg(tiles) {
    const th = theme();
    const bw = Math.round(W * RS), bh = Math.round(H * RS);
    if (bg.width !== bw) { bg.width = bw; }
    if (bg.height !== bh) { bg.height = bh; }
    bx.setTransform(RS, 0, 0, RS, 0, 0);
    bx.imageSmoothingEnabled = false;
    bx.clearRect(0, 0, W, H);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const im = IMG[floorAt(x, y)];
        if (im) bx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
        else { bx.fillStyle = th.dust; bx.fillRect(x * TILE, y * TILE, TILE, TILE); }
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = tiles[y][x];
        if (v === WALL) {
          const corner = (x === 0 || x === COLS - 1) && (y === 0 || y === ROWS - 1);
          const edge = (x % 5 === 2 || y % 5 === 2) && (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1);
          // 自定义地图指定了墙的贴图就一律用它，否则沿用「四角/边上是石柱」的老规矩
          const im = IMG[SPRITE_GRID[y][x] || (corner || edge ? th.pillar : th.wall)];
          if (im) bx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
        } else if (v === PILLAR) {
          const im = IMG[SPRITE_GRID[y][x] || th.pillar];
          if (im) bx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
        } else if (v === DECOR) {
          // 实心装饰（雪人）也是不动的，一起烘进背景
          const im = IMG[SPRITE_GRID[y][x] || th.decor];
          if (im) bx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    /* 主题装饰在 parseMap() 里已经摆进 tiles（带连通性兜底），这里不用再撒 */
    // 出生点地贴（细双环，不是光晕，人走开后也不会留残影）
    SPAWNS.forEach((sp, i) => {
      const cx = sp.x * TILE + 16, cy = sp.y * TILE + 18;
      const col = i === 0 ? '239,201,106' : '76,166,76';
      bx.strokeStyle = 'rgba(' + col + ',.34)';
      bx.lineWidth = 2;
      bx.beginPath(); bx.arc(cx, cy, 10.5, 0, Math.PI * 2); bx.stroke();
      bx.strokeStyle = 'rgba(' + col + ',.16)';
      bx.lineWidth = 1;
      bx.beginPath(); bx.arc(cx, cy, 14, 0, Math.PI * 2); bx.stroke();
    });
  }

  /* ------------------------------------------------------------- 玩家 */
  const KEYMAP = {
    '1': { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: ['Space', 'KeyJ'] },
    '2': { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: ['Enter', 'Numpad0', 'NumpadEnter'] }
  };
  const held = Object.create(null);

  /* ------------------------------------------------------------- 炮弹选择
     每人一份口味：准备页选，局内面板也能随时换 —— 只影响之后放出的弹，
     已经在倒计时的弹不追改。选过就记进 localStorage，下次打开还是自己的口味。 */
  const BOMB_STORE = 'qqtang.bombs.v1';
  const BOMB_DEFAULT = ['candy-bomb', 'bomb-soda'];
  const PICKS = BOMB_DEFAULT.slice();
  try {
    const s = JSON.parse(localStorage.getItem(BOMB_STORE) || 'null');
    if (Array.isArray(s)) for (let i = 0; i < 2; i++) if (KIND_BY_KEY[s[i]]) PICKS[i] = s[i];
  } catch (e) { /* 存档坏了当没存过 */ }

  function setPick(i, key) {
    if (!KIND_BY_KEY[key]) return false;
    PICKS[i] = key;
    const p = state.players[i];
    if (p) p.bombKind = key;
    try { localStorage.setItem(BOMB_STORE, JSON.stringify(PICKS)); } catch (e) { /* 存不了就算了 */ }
    syncBombUI();
    return true;
  }

  /* 选择条：一排糖弹小图，点谁用谁。准备页（覆盖层）和局内面板共用一套标记 */
  function bombStripHTML(pi) {
    return '<div class="bomb-strip" data-p="' + pi + '">' + BOMB_KINDS.map(k =>
      '<button class="bkind' + (PICKS[pi] === k.key ? ' on' : '') + '" data-kind="' + k.key +
      '" title="' + k.name + '糖弹" type="button"><img draggable="false" alt="' + k.name +
      '" src="' + (SPRITES[k.key] || '') + '"></button>').join('') + '</div>';
  }

  /* 选中态同步：面板的选择条是常驻 DOM，覆盖层那条每次 showStart 重建；
     选中框颜色跟着人走（P1 金 / P2 绿），CSS 按 data-p 区分 */
  function syncBombUI() {
    for (let i = 0; i < 2; i++) {
      document.querySelectorAll('#pb' + (i + 1) + ' .bkind, #ov .bomb-strip[data-p="' + i + '"] .bkind')
        .forEach(el => el.classList.toggle('on', el.dataset.kind === PICKS[i]));
    }
  }

  function bindBombStrip(box, pi) {
    if (!box) return;
    box.innerHTML = bombStripHTML(pi);
    box.querySelectorAll('.bkind').forEach(el => {
      el.onclick = () => { setPick(pi, el.dataset.kind); el.blur(); };
    });
  }

  function makePlayer(i) {
    const sp = SPAWNS[i];
    return {
      idx: i,
      sprite: i === 0 ? 'zelda' : 'link',
      name: i === 0 ? '塞尔达' : '林克',
      x: sp.x, y: sp.y,                       // 出生格（只用于开局/测试对照）
      wx: sp.x * TILE, wy: sp.y * TILE,       // 身体左上角的世界像素坐标
      dir: i === 0 ? 'down' : 'up',
      moving: false, walkT: 0, pushT: 0,       // pushT：顶着雪块按方向的累计时长
      alive: true, dying: false, dieT: 0,
      power: 1, maxBombs: 1, bombsOut: 0, spd: 1,
      bombKind: KIND_BY_KEY[PICKS[i]] ? PICKS[i] : BOMB_DEFAULT[0],
      wins: 0, lastDir: '',
      isAI: state.mode === 'pve' && i === 1,   // 人机模式：P2 交给 AI
      aiDir: '', aiTimer: 0, aiPlan: null,
      key: KEYMAP[String(i + 1)]
    };
  }

  function readDir(p) {
    if (p.isAI) return p.aiDir || '';        // AI 走自己的决策通道，不读键盘
    const k = p.key;
    if (p.lastDir && held[k[p.lastDir]]) return p.lastDir;
    if (held[k.up]) return 'up';
    if (held[k.down]) return 'down';
    if (held[k.left]) return 'left';
    if (held[k.right]) return 'right';
    return '';
  }

  function bombAt(x, y) {
    for (const b of state.bombs) if (!b.dead && b.x === x && b.y === y) return b;
    return null;
  }

  /* ------------------------------------------------------------- 碰撞
     碰撞体 = 一整格 32×32，贴在人物当前的像素位置上。
     能不能站，只看这一整格「压到」了哪些格子：压到的每一格都得是空的。
     - 贴墙站着时，身体正好跟墙那条边对齐，看起来就是「撑满一格」；
     - 在开阔地走动时身体会横跨两格，只要两格都空，就随便站。 */
  function solidCell(tx, ty) {
    if (!inside(tx, ty)) return true;
    const v = state.tiles[ty][tx];
    return v === WALL || v === PILLAR || v === CRATE || v === AMPHORA || v === CHEST
      || v === DECOR || v === PUSH;                 // 雪人 / 雪块同样挡路
  }

  // 身体放在 (x,y) 时覆盖的格子是否全空（0.02 容差：正好贴边时不蹭下一格）
  // 糖弹也算障碍：已经压在里面的可以不慌不忙走出去，但不能从外面走进去。
  function boxFree(x, y, p) {
    const x0 = Math.floor((x + 0.02) / TILE), x1 = Math.floor((x + TILE - 0.02) / TILE);
    const y0 = Math.floor((y + 0.02) / TILE), y1 = Math.floor((y + TILE - 0.02) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (solidCell(tx, ty)) return false;
        if (bombAt(tx, ty) && !(p && coversCell(p, tx, ty))) return false;
      }
    }
    return true;
  }

  // 这一格是不是已经被身体压着了（放炸弹的瞬间人就站在里面）
  function coversCell(p, tx, ty) {
    return tx >= Math.floor((p.wx + 0.02) / TILE) && tx <= Math.floor((p.wx + TILE - 0.02) / TILE) &&
           ty >= Math.floor((p.wy + 0.02) / TILE) && ty <= Math.floor((p.wy + TILE - 0.02) / TILE);
  }

  const pCX = p => p.wx + TILE / 2;
  const pCY = p => p.wy + TILE / 2;
  const pCellX = p => Math.floor(pCX(p) / TILE);
  const pCellY = p => Math.floor(pCY(p) / TILE);
  const pCell = p => ({ x: pCellX(p), y: pCellY(p) });

  /* 单轴滑行：一次最多挪 4px（子格 8px 的一半），撞住就停 */
  function slide(p, dx, dy) {
    const total = Math.abs(dx) + Math.abs(dy);
    if (total < 1e-6) return 0;
    const n = Math.max(1, Math.ceil(total / 4));
    const sx = dx / n, sy = dy / n;
    let moved = 0;
    for (let i = 0; i < n; i++) {
      if (!boxFree(p.wx + sx, p.wy + sy, p)) break;
      p.wx += sx; p.wy += sy;
      moved += Math.abs(sx) + Math.abs(sy);
    }
    return moved;
  }

  /* 拐弯修正：横向被挡住时，看看「把身体对到格子中线」之后能不能过去。
     能就慢慢贴过去（不是瞬移），不能就老实站着只转身。
     只有一格宽的横巷才会用到它；上下通畅时就按当前子格位置直接走。

     两个坑（以前就是它们让角色「明明看着对正了，却永远卡在巷口」）：
     1) 残余 0.1~0.6px 时，如果拿「偏差够小」当已经对正，碰撞体其实还压在隔壁实心格上，
        于是永远过不去 —— 所以收尾必须**精确贴合**（snap），不能留亚像素残留。
     2) 走一步刚好剩下一点点（比如 2.2 - 1.778 = 0.42）也会掉进同一个坑 —— 所以
        「一帧能贴到位就直接贴」，而不是只挪一个步长。 */
  const SNAP_PX = 1.5;            // 偏差小于这个（或一帧走得到）就直接贴合中线

  function alignToLane(p, dir, step, laneOnly) {
    const v = DIRS[dir];
    const onX = v[0] !== 0;                    // 左右走 => 要在 y 上对齐
    const cur = onX ? p.wy : p.wx;
    const base = Math.round(cur / TILE) * TILE;
    // laneOnly：只对到这一条线（推雪块专用）—— 不换道，也不做「对齐了往前
    // 探一步」的绕行检查，因为前面就是雪块，探路必然失败。
    const targets = laneOnly == null
      ? [base, base + (cur >= base ? TILE : -TILE)]
      : [laneOnly];
    for (const target of targets) {
      const delta = target - cur;
      if (Math.abs(delta) < 1e-6) continue;                    // 本来就对正
      if (Math.abs(delta) > ALIGN_MAX) continue;               // 太远，不硬拽
      const alignedX = onX ? p.wx : target;
      const alignedY = onX ? target : p.wy;
      if (!boxFree(alignedX, alignedY, p)) continue;           // 对正后自己先得站得住
      if (laneOnly == null) {
        const probeX = onX ? p.wx + v[0] * 2 : target;
        const probeY = onX ? target : p.wy + v[1] * 2;
        if (!boxFree(probeX, probeY, p)) continue;             // 对齐了也过不去，别乱挪
      }

      const snap = () => { if (onX) p.wy = alignedY; else p.wx = alignedX; };
      if (Math.abs(delta) <= Math.max(SNAP_PX, step)) {
        snap();                                                // 精确贴合，不留残留
      } else {
        const mv = Math.sign(delta) * step;
        if (onX) slide(p, 0, mv); else slide(p, mv, 0);
        // 一步都没挪（比如身体本来就压着墙边）就直接贴死，否则会一直原地打转
        if (Math.abs((onX ? p.wy : p.wx) - cur) < 1e-6) snap();
      }
      return true;
    }
    return false;
  }

  function updatePlayer(p, dt) {
    if (!p.alive) { p.dieT += dt; return; }
    const dir = readDir(p);
    if (!dir) { p.moving = false; p.pushT = 0; return; }
    p.dir = dir;                               // 撞墙也会先转向
    const v = DIRS[dir];
    const step = SPEED * (1 + (p.spd - 1) * 0.22) * dt;
    const before = p.wx + p.wy;
    slide(p, v[0] * step, v[1] * step);
    if (Math.abs(p.wx + p.wy - before) > 1e-4) {
      p.moving = true;
      p.walkT += dt;
      p.pushT = 0;
      return;
    }
    p.moving = false;
    // 被挡住了：挡路的若是雪块、且人主体就在雪块那条线上 —— 只对到雪块那条线
    // 上去推，绝不换道绕开（不然身子稍歪就被带去旁边空行：推不着、绕着雪块转圈）。
    // 其他障碍（或主体在旁边空行上）才按老规矩试着侧身溜过去。
    const lane = pushLaneOf(p, dir);
    const lined = lane == null ? alignToLane(p, dir, step)
                               : alignToLane(p, dir, step, lane);
    if (lined && slide(p, v[0] * step, v[1] * step) > 0) {
      p.moving = true;
      p.walkT += dt;
      p.pushT = 0;
      return;
    }
    updatePush(p, dir, dt);     // 真顶着障碍了：面对的是雪块就开始蓄力推
  }

  /* ------------------------------------------------------------- 推雪块
     和雪块对正、身体被它顶住、方向键一直按着：0.05s 后把它往那个方向推一格。
     人不跟着瞬移 —— 雪块挪走后下一帧自然往前走，贴上新的雪块接着蓄力，
     所以「一直按着」就是推一格、跟走一格地循环。
     优先级（防「推不动 / 绕圈」的关键）：朝雪块按方向 = 表达「我要推它」，
     所以只要人主体在雪块那条线上，被挡后就只对正、不绕行；
     主体大部分在旁边空行上时才当「想溜过去」，照旧侧身绕。
     挪不正（歪出主体线 / 四面全堵）就推不动。 */
  // 正前方挡路的雪块所在的那条格线（像素值）；人主体不在这条线上返回 null。
  // 「主体」= 垂直方向上身体压得最多的那条格 —— 对上了才谈得上「面对它推」。
  function pushLaneOf(p, dir) {
    const d = DIRS[dir], onX = d[0] !== 0;
    const mine = Math.round((onX ? p.wy : p.wx) / TILE);        // 人主体所在的格
    const fx = Math.round((p.wx + d[0] * TILE) / TILE);         // 正前方贴身的那格
    const fy = Math.round((p.wy + d[1] * TILE) / TILE);
    const x = onX ? fx : mine, y = onX ? mine : fy;
    return inside(x, y) && state.tiles[y][x] === PUSH ? mine * TILE : null;
  }

  // 身体正前方那一格：要求垂直方向贴着格线（对正），否则返回 null
  function pushFront(p, dir) {
    const d = DIRS[dir], onX = d[0] !== 0;
    const perp = onX ? p.wy : p.wx;
    if (Math.abs(perp - Math.round(perp / TILE) * TILE) > 0.5) return null;
    const gx = Math.round(p.wx / TILE), gy = Math.round(p.wy / TILE);
    const fx = onX ? gx + d[0] : gx, fy = onX ? gy : gy + d[1];
    return inside(fx, fy) && state.tiles[fy][fx] === PUSH ? { x: fx, y: fy } : null;
  }

  // 雪块的去处必须是真·空格：没墙/障碍，也没糖弹、道具和另一个人压着
  function pushClear(nx, ny, p) {
    if (!inside(nx, ny) || state.tiles[ny][nx] !== EMPTY) return false;
    if (bombAt(nx, ny)) return false;
    if (state.powerups.some(pu => pu.x === nx && pu.y === ny)) return false;
    for (const o of state.players) {
      if (o !== p && o.alive && coversCell(o, nx, ny)) return false;
    }
    return true;
  }

  function updatePush(p, dir, dt) {
    const f = pushFront(p, dir);
    if (!f) { p.pushT = 0; return; }           // 面前不是雪块：白顶，重新计时
    p.pushT += dt;
    if (p.pushT < PUSH_DELAY) return;
    p.pushT = 0;                               // 蓄力清零：推一下算一下，按住就连推
    const d = DIRS[dir], nx = f.x + d[0], ny = f.y + d[1];
    if (!pushClear(nx, ny, p)) return;         // 去处被堵：推不动，按住等机会
    // 贴图跟着格子一起搬（自定义地图给雪块换过皮时不能掉皮）
    SPRITE_GRID[ny][nx] = SPRITE_GRID[f.y][f.x];
    SPRITE_GRID[f.y][f.x] = null;
    state.tiles[f.y][f.x] = EMPTY;
    state.tiles[ny][nx] = PUSH;
    state.pushAnims.push({ x: nx, y: ny, dx: d[0], dy: d[1], t: PUSH_ANIM });
    sfx('push');
    puff(nx * TILE + 16, ny * TILE + 22, 5, '#EDF7FE', 0.6);   // 雪沫
  }

  /* 放糖弹：放在人物中心点所在的那一格 */
  function placeBomb(p) {
    if (state.phase !== 'play' || !p.alive) return false;
    if (p.bombsOut >= p.maxBombs) return false;
    const x = pCellX(p), y = pCellY(p);
    if (bombAt(x, y)) return false;
    p.bombsOut++;
    if (p.isAI) state.aiBombs++;
    state.bombs.push({
      x, y, power: p.power, fuseLeft: FUSE, owner: p, dead: false,
      birth: state.time, kind: p.bombKind
    });
    sfx('place');
    puff(x * TILE + 16, y * TILE + 26, 4, theme().dust, 0.4);
    return true;
  }

  /* ------------------------------------------------------------- AI（规则版）
     保命优先，然后看身板分档决策。身板 = 吃到的道具数（威力/弹量/速度各算一个）：
       <2（弱） 发育+防御为主；2~5（起势）敢打，顺路捡；≥6（充足）进攻优先只捡很近的；
       ≥8（溢出）进攻最高优先，道具完全无视。
       1) 脚下是危险格（糖弹火焰 / 即将被炸到的范围）→ 立刻逃向最近的绝对安全格；
          真安全格到不了（被困死）→ 退而求其次，往「最晚才被烧到」的格挪，别站着等死。
       2) 否则按 ~0.12s 节流决策：
          - 直线上有敌人（≤ 威力、中间无遮挡）或近处有箱子（≤2 格），
            且模拟放弹后逃得掉 → 放糖弹，并立刻沿逃生方向起步；
            （弱且对手贴身时，逃生终点还必须避开对手火力线 —— 防被补弹封死）
          - 否则沿「计划」游走（计划 0.5~1.2s 才换一次）：
              起势+ 有弹 + 对手够得着 → 压上去（道具按档位顺路捡）；
              够不着                  → 掘进：朝猎杀位把挡路的箱子一块块炸开；
              弱 + 对手逼近(≤5格)     → 撤出对手火力线，发育目标也避开火线；
              其余                     → 吃道具、就近开箱，攒出进攻资本再压上。
     保命铁律（漏了就会「逃」进墙角被自己的糖弹炸死）：
       - BFS 的每一步（包括第一步）都要安检：墙/箱子不是路，马上要炸的格不是路；
       - 糖弹本身是实心的，逃生路线不许从别的糖弹格上穿过去；
       - 危险图把连锁算进去：A 弹先炸到 B 弹，B 的覆盖范围就按 A 的时刻算。
     去抖三件套（以前 0.12s 一换目标，看起来在原地左右横跳）：
       - 游走目标用「计划」锁 0.5~1.2s，不每拍重选；
       - BFS 同分时优先展开/保持当前方向（opts.keep），不轻易掉头；
       - 兜底走位排除回头路。 */

  // 危险图：danger[y][x] = 这格还有多少秒会被火焰覆盖（Infinity = 永远安全）
  function aiDangerMap(extra) {
    const d = [];
    for (let y = 0; y < ROWS; y++) d.push(new Array(COLS).fill(Infinity));
    const bombs = [];
    const take = b => bombs.push({ x: b.x, y: b.y, t: b.fuseLeft, cells: blastCells(b) });
    for (const b of state.bombs) if (!b.dead) take(b);
    if (extra) take(extra);
    // 连锁传播：别的弹会提前引爆这颗，这颗就跟着那一炸提前响（炸到糖弹是同帧全响）
    for (let changed = true; changed;) {
      changed = false;
      for (const b of bombs) for (const o of bombs) {
        if (o === b || o.t >= b.t) continue;
        if (o.cells.some(cc => cc.x === b.x && cc.y === b.y)) { b.t = o.t; changed = true; }
      }
    }
    for (const b of bombs) for (const c of b.cells) if (b.t < d[c.y][c.x]) d[c.y][c.x] = b.t;
    for (const f of state.flames) d[f.y][f.x] = 0;   // 正在烧 = 立刻死
    return d;
  }

  // 这格现在能不能落脚（实心/障碍/糖弹一律不行；危险但还早、来得及走到的可以过）
  // soft：掘进模式 —— 可炸障碍算「能过」（它们马上就会被炸开），用来找该去炸哪块
  function aiPassable(d, x, y, stepT, margin, soft) {
    if (!inside(x, y)) return false;
    const v = state.tiles[y][x];
    if (v === WALL || v === PILLAR || v === DECOR) return false;
    if (v !== EMPTY && !soft) return false;
    if (bombAt(x, y)) return false;
    return d[y][x] > stepT + margin;
  }

  // 从 start BFS，返回起步方向：给 isGoal 就找第一个满足的格（已在目标返回 ''，无路 null）；
  // 给 opts.score 就不提前返回，扫完可达格后返回得分最高的一格（平分取更近的）。
  // opts.keep：去抖 —— 同分/同深度的候选里优先保持这个方向，别左右横跳。
  // opts.soft：可炸障碍当路走（掘进搜索专用）；opts.path：连带返回完整路径。
  function aiBFS(start, danger, isGoal, opts) {
    opts = opts || {};
    const margin = opts.margin == null ? 0.25 : opts.margin;
    const maxSteps = opts.maxSteps || 60;
    const score = opts.score, keep = opts.keep && DIRS[opts.keep] ? opts.keep : null;
    const soft = !!opts.soft, startKey = start.x + ',' + start.y;
    if (!score && isGoal && isGoal(start)) return { dir: '', goal: start, path: [start] };
    // 把 keep 方向排在最前展开：多个目标一样近时，优先走上「正在走的方向」
    const order = keep ? [keep].concat(Object.keys(DIRS).filter(n => n !== keep))
                       : Object.keys(DIRS);
    const q = [{ x: start.x, y: start.y, t: 0, dir: '', k: startKey }];
    const seen = new Set([startKey]);
    const prev = opts.path ? new Map() : null;
    let head = 0, best = null, bestS = -Infinity;
    if (score) bestS = score(start);
    while (head < q.length) {
      const cur = q[head++];
      if (cur.t >= maxSteps) break;
      for (const name of order) {
        const dd = DIRS[name];
        const nx = cur.x + dd[0], ny = cur.y + dd[1], key = nx + ',' + ny;
        if (seen.has(key)) continue;
        // 第一步也照查：墙/箱子/糖弹/来不及的火格都不是路 —— 不查就会「逃」进墙角等死
        if (!aiPassable(danger, nx, ny, cur.t + STEP, margin, soft)) continue;
        seen.add(key);
        if (prev) prev.set(key, cur.k);
        const nt = cur.t + STEP, first = cur.dir || name, cell = { x: nx, y: ny };
        if (score) {
          const s = score(cell);
          if (s > bestS) { bestS = s; best = { dir: first, goal: cell }; }
        } else if (isGoal(cell)) {
          let path = null;
          if (prev) {
            path = [];
            for (let k = key; k !== startKey; k = prev.get(k)) {
              const [px, py] = k.split(',').map(Number);
              path.push({ x: px, y: py });
            }
            path.push({ x: start.x, y: start.y });
            path.reverse();
          }
          return { dir: first, goal: cell, path };
        }
        q.push({ x: nx, y: ny, t: nt, dir: first, k: key });
      }
    }
    return score ? best : null;
  }

  // 进攻：直线上有敌人（距离 ≤ 威力、中间无实心遮挡）→ 放弹；近处（≤2 格）有
  // 可炸障碍也顺手开花。远处的箱子不炸 —— 跑过去炸再折返，看起来就是在原地打转。
  function aiTryAttack(p, danger) {
    if (p.bombsOut >= p.maxBombs) return false;
    const c = pCell(p);
    if (bombAt(c.x, c.y)) return false;
    let hits = false;
    for (const name in DIRS) {
      const dd = DIRS[name];
      for (let i = 1; i <= p.power; i++) {
        const x = c.x + dd[0] * i, y = c.y + dd[1] * i;
        if (!inside(x, y)) break;
        const v = state.tiles[y][x];
        if (v === WALL || v === PILLAR || v === DECOR) break;
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) {
          if (i <= 2) hits = true;
          break;
        }
        // 这条直线上的敌人（没被实心格挡住）是头号目标，多远都值得炸
        for (const o of state.players) {
          if (o !== p && o.alive && pCellX(o) === x && pCellY(o) === y) { hits = true; break; }
        }
        if (hits) break;
      }
      if (hits) break;
    }
    if (!hits) return false;
    // 模拟放弹：脚下变危险（含被别的弹连锁提前引爆）后，是否还能走到真正安全的格。
    // 弱且对手贴身时，逃生终点还得避开对手的火力线 —— 不然弹刚放下，
    // 对手再补一颗就把自己封死在逃生路上（被炮弹堵死）。
    const foe = state.players.find(o => o !== p && o.alive);
    const defensive = !!foe && grownOf(p) < GROWN_ATTACK && nearFoe(c, foe);
    const threat = defensive ? aiThreatMap(p) : null;
    const sim = { x: c.x, y: c.y, power: p.power, fuseLeft: FUSE, owner: p, dead: false };
    const d2 = aiDangerMap(sim);
    const r = aiBFS(c, d2,
      cell => d2[cell.y][cell.x] === Infinity && (!threat || !threat[cell.y][cell.x]),
      { maxSteps: p.power + 3, keep: p.aiDir });
    if (!r) return false;            // 逃不掉就不炸，保命优先
    if (placeBomb(p)) p.aiDir = r.dir;   // 立刻按逃生路线起步，下一帧危险图接管接着逃
    return true;
  }

  // (x1,y1)→(x2,y2) 同行/列时，中间有没有实心格挡着（不含两端）
  function aiLineClear(x1, y1, x2, y2) {
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
    let x = x1 + dx, y = y1 + dy;
    while (x !== x2 || y !== y2) {
      if (state.tiles[y][x] !== EMPTY) return false;
      x += dx; y += dy;
    }
    return true;
  }

  // 身板：吃到的道具数，分三档（威力/弹量/速度各算一个）：
  //   < GROWN_ATTACK(2)   弱   —— 发育和防御优先，不主动找打；
  //   ≥ GROWN_FULL(6)     充足 —— 进攻优先，只顺路捡很近（≤2 步）的道具；
  //   ≥ GROWN_OVERFLOW(8) 溢出 —— 进攻最高优先，道具直接无视。
  //   中间档（2~5）       起势 —— 敢打，顺路 ≤3 步的道具顺手捡。
  const GROWN_ATTACK = 2;
  const GROWN_FULL = 6;
  const GROWN_OVERFLOW = 8;
  const grownOf = p => (p.power - 1) + (p.maxBombs - 1) + (p.spd - 1);
  const nearFoe = (c, foe) =>
    Math.max(Math.abs(c.x - pCellX(foe)), Math.abs(c.y - pCellY(foe))) <= 5;

  // 对手威胁图：对手现在就能炸到的格 —— 同行/列 ≤ 对手威力且中间无遮挡的火线，
  // 加上对手脚下和贴身格（贴脸放弹首当其冲）。威胁是「随时可能成真」的：
  // 弱的时候别站在线上，不然对手补一颗糖弹就把你堵死在原地。
  function aiThreatMap(p) {
    const t = [];
    for (let y = 0; y < ROWS; y++) t.push(new Array(COLS).fill(0));
    for (const o of state.players) {
      if (o === p || !o.alive) continue;
      const fx = pCellX(o), fy = pCellY(o);
      t[fy][fx] = 1;
      for (const name in DIRS) {
        const dd = DIRS[name];
        const nx = fx + dd[0], ny = fy + dd[1];      // 贴身格
        if (inside(nx, ny)) t[ny][nx] = 1;
        for (let i = 1; i <= o.power; i++) {         // 火线
          const x = fx + dd[0] * i, y = fy + dd[1] * i;
          if (!inside(x, y)) break;
          const v = state.tiles[y][x];
          if (v === WALL || v === PILLAR || v === DECOR) break;
          t[y][x] = 1;
          if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) break;
        }
      }
    }
    return t;
  }

  // 猎杀位：和敌人同行/列、距离 1..power、中间无遮挡 —— 站上去就能炸到人
  function aiKillCellFn(p, foe) {
    const fc = pCell(foe);
    return cell => {
      const dx = Math.abs(cell.x - fc.x), dy = Math.abs(cell.y - fc.y);
      if (dx > 0 && dy > 0) return false;               // 必须同行或同列
      const dist = dx + dy;
      return dist >= 1 && dist <= p.power && aiLineClear(cell.x, cell.y, fc.x, fc.y);
    };
  }

  // 计划还有效吗：过期 / 目标没了（道具被吃、箱子被开、敌人死了）都算失效
  function aiPlanValid(p, plan) {
    if (!plan || state.time > plan.until) return false;
    if (plan.kind === 'evade') return true;     // 撤离目标随对手移动，短时限内认了
    if (plan.kind === 'item') return state.powerups.some(pu => pu.x === plan.x && pu.y === plan.y);
    if (plan.kind === 'hunt') return state.players.some(o => o !== p && o.alive);
    if (plan.kind === 'tunnel') {
      const row = state.tiles[plan.ty];
      const v = row ? row[plan.tx] : WALL;
      return v === CRATE || v === AMPHORA || v === CHEST || v === PUSH;
    }
    if (plan.kind === 'crate') {
      for (const name in DIRS) {
        const dd = DIRS[name], x = plan.x + dd[0], y = plan.y + dd[1];
        if (!inside(x, y)) continue;
        const v = state.tiles[y][x];
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) return true;
      }
      return false;
    }
    return false;
  }

  // 定个新计划。先看身板分档：「溢出只管打，充足少捡点，起势顺手捡，没吃够别找打」——
  //   弱（道具 < GROWN_ATTACK）+ 对手近：
  //     站在对手火线/贴身区 → 先撤离（evade）；没在线上 → 发育但目标避开火线。
  //   起势及以上（≥ GROWN_ATTACK）+ 有弹：
  //     对手够得着（走得到猎杀位）→ 压上去开火；道具按档位顺路捡；
  //     够不着 → 掘进：把可炸障碍当软路，朝猎杀位一段一段炸过去；
  //     掘进也无路 → 充足及以下捡道具发育，溢出无视道具去开箱开路。
  //   其余（弱且对手远 / 手里没弹）→ 发育：吃道具 → 就近开箱。
  function aiPickPlan(p, danger) {
    const c = pCell(p);
    const onItem = cell => state.powerups.some(pu => pu.x === cell.x && pu.y === cell.y);
    const nearCrate = cell => {
      for (const name in DIRS) {
        const dd = DIRS[name], x = cell.x + dd[0], y = cell.y + dd[1];
        if (!inside(x, y)) continue;
        const v = state.tiles[y][x];
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) return true;
      }
      return false;
    };
    const foe = state.players.find(o => o !== p && o.alive);
    const stamp = kind =>
      ({ kind, until: state.time + (kind === 'hunt' || kind === 'evade' ? 0.5 : 1.2) });

    // —— 弱且被逼近：防御 + 躲着发育 ——
    if (foe && grownOf(p) < GROWN_ATTACK && nearFoe(c, foe)) {
      const threat = aiThreatMap(p);
      if (threat[c.y][c.x]) {
        const re = aiBFS(c, danger, cell => !threat[cell.y][cell.x], { maxSteps: 20 });
        if (re && re.goal) return Object.assign(stamp('evade'), { x: re.goal.x, y: re.goal.y });
      }
      const safeItem = cell => onItem(cell) && !threat[cell.y][cell.x];
      let r = aiBFS(c, danger, safeItem, { maxSteps: 30 });
      if (!r) r = aiBFS(c, danger, onItem, { maxSteps: 30 });     // 实在没有安全的，饿着不如冒险
      if (r && r.goal) return Object.assign(stamp('item'), { x: r.goal.x, y: r.goal.y });
      const safeCrate = cell => nearCrate(cell) && !threat[cell.y][cell.x];
      r = aiBFS(c, danger, safeCrate, { maxSteps: 30 });
      if (!r) r = aiBFS(c, danger, nearCrate, { maxSteps: 30 });
      if (r && r.goal) return Object.assign(stamp('crate'), { x: r.goal.x, y: r.goal.y });
      return null;
    }

    // —— 强：找打。身板越厚越不管道具：
    //     2~5 顺路 ≤3 步捡；6~7（充足）只捡 ≤2 步的；≥8（溢出）完全无视 ——
    //     对手够得着就压上，够不着就朝它掘进；掘进也无路时：
    //     充足及以下去捡道具发育，溢出去开箱开路（照样不捡道具）。 ——
    if (foe && p.bombsOut < p.maxBombs && grownOf(p) >= GROWN_ATTACK) {
      const grown = grownOf(p);
      const detour = grown >= GROWN_OVERFLOW ? 0 : grown >= GROWN_FULL ? 2 : 3;
      const r = aiBFS(c, danger, aiKillCellFn(p, foe), { maxSteps: 60 });
      if (r && r.goal) {
        if (detour) {
          const ri = aiBFS(c, danger, onItem, { maxSteps: detour });
          if (ri && ri.goal) return Object.assign(stamp('item'), { x: ri.goal.x, y: ri.goal.y });
        }
        return Object.assign(stamp('hunt'), { x: r.goal.x, y: r.goal.y });
      }
      // 掘进：软搜索（箱子当路）找到通往猎杀位的方向，炸开第一块挡路的
      const rt = aiBFS(c, danger, aiKillCellFn(p, foe), { maxSteps: 60, soft: true, path: true });
      if (rt && rt.path) {
        for (let i = 1; i < rt.path.length; i++) {
          const cell = rt.path[i];
          const v = state.tiles[cell.y][cell.x];
          if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) {
            const spot = rt.path[i - 1];   // 箱子在路径上的前一格：站上去就炸得到它
            return { kind: 'tunnel', x: spot.x, y: spot.y, tx: cell.x, ty: cell.y,
                     until: state.time + 0.6 };
          }
        }
      }
      // 掘进也无路（对手被硬墙彻底封死）
      if (grown >= GROWN_OVERFLOW) {
        const rc = aiBFS(c, danger, nearCrate, { maxSteps: 30 });
        if (rc && rc.goal) return Object.assign(stamp('crate'), { x: rc.goal.x, y: rc.goal.y });
        return null;
      }
    }

    // —— 发育 ——
    let r = aiBFS(c, danger, onItem, { maxSteps: 30 });
    if (r && r.goal) return Object.assign(stamp('item'), { x: r.goal.x, y: r.goal.y });
    r = aiBFS(c, danger, nearCrate, { maxSteps: 30 });
    if (r && r.goal) return Object.assign(stamp('crate'), { x: r.goal.x, y: r.goal.y });
    return null;
  }

  // 游走：沿当前计划走。计划 ~0.5~1.2s 才换一次（目标不抖，路线才不抖），
  // 路被堵死就丢弃计划，下一拍重新定。真没目标就挑个不掉头的安全邻居走走。
  function aiWander(p, danger) {
    const c = pCell(p);
    if (!aiPlanValid(p, p.aiPlan)) p.aiPlan = aiPickPlan(p, danger);
    const plan = p.aiPlan;
    if (plan) {
      // maxSteps 60：掘进/压上可能要横穿整张地图，别半路把计划饿死
      const r = aiBFS(c, danger, cell => cell.x === plan.x && cell.y === plan.y,
        { maxSteps: 60, keep: p.aiDir });
      if (r) return r.dir;                // 到位时 r.dir 是 ''：站住，等进攻节拍开火
      p.aiPlan = null;                    // 路被堵/目标没了，下一拍重定
    }
    // 兜底：随便挑个安全邻居走走，但别掉头 —— 掉头就是在原地画龙
    const back = OPP[p.aiDir];
    let pick = '';
    for (const name in DIRS) {
      if (name === back) continue;
      const dd = DIRS[name];
      if (aiPassable(danger, c.x + dd[0], c.y + dd[1], STEP, 0.25)) { pick = name; break; }
    }
    if (!pick && back) {
      const dd = DIRS[back];
      if (aiPassable(danger, c.x + dd[0], c.y + dd[1], STEP, 0.25)) pick = back;
    }
    return pick;
  }

  // 每帧给 AI 玩家算一次方向（逃命每帧都算，进攻/游走按节流）
  function aiUpdate(p, dt) {
    if (!p.alive) { p.aiDir = ''; return; }
    const c = pCell(p);
    const danger = aiDangerMap();
    // 1) 脚下危险 → 逃：优先去绝对安全的格；到不了就往「最晚被烧到」的格挪
    if (danger[c.y][c.x] !== Infinity) {
      const r = aiBFS(c, danger, null,
        { maxSteps: 40, score: cell => danger[cell.y][cell.x], keep: p.aiDir });
      p.aiDir = r ? r.dir : '';
      p.aiTimer = 0;
      p.aiPlan = null;                    // 局势变了，脱险后重新规划
      return;
    }
    // 2) 节流决策
    p.aiTimer -= dt;
    if (p.aiTimer > 0) return;
    p.aiTimer = 0.12;
    if (aiTryAttack(p, danger)) return;   // 有把握（敌人在直线火力上）就开火
    p.aiDir = aiWander(p, danger) || '';
  }

  /* ------------------------------------------------------------- 爆炸
     连锁是「同一帧全部开花」：炸到别的糖弹就立刻把它拉进队列一起爆，
     没有传导延迟，两颗糖弹是同时炸的。 */
  function blastCells(b) {
    const cells = [{ x: b.x, y: b.y }];
    for (const dir in DIRS) {
      const d = DIRS[dir];
      for (let i = 1; i <= b.power; i++) {
        const x = b.x + d[0] * i, y = b.y + d[1] * i;
        if (!inside(x, y)) break;
        const v = state.tiles[y][x];
        if (v === WALL || v === PILLAR || v === DECOR) break;   // 雪人挡糖弹
        cells.push({ x, y });
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) break;
      }
    }
    return cells;
  }

  function detonate(first) {
    const queue = [first];
    const hit = new Set();          // 这一次爆炸（含连锁）烧到的格子
    let count = 0;

    while (queue.length) {
      const b = queue.shift();
      if (b.dead) continue;
      b.dead = true;
      b.owner.bombsOut = Math.max(0, b.owner.bombsOut - 1);
      count++;

      const cells = blastCells(b);

      // 烧毁障碍 + 掉落
      for (const c of cells) {
        const v = state.tiles[c.y][c.x];
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) {
          state.tiles[c.y][c.x] = EMPTY;
          burst(c.x * TILE + 16, c.y * TILE + 16, 12, theme().debris, 110);
          if (v === CHEST || Math.random() < theme().drop) {
            addPowerup(c.x, c.y, DROPS[(Math.random() * DROPS.length) | 0]);
          }
        }
      }

      for (const c of cells) { pushFlame(c.x, c.y, b.kind); hit.add(c.x + ',' + c.y); }

      // 同时引爆：范围内其它糖弹立刻入队，同一帧一起炸
      for (const c of cells) {
        for (const o of state.bombs) {
          if (!o.dead && o.x === c.x && o.y === c.y) queue.push(o);
        }
      }

      burst(b.x * TILE + 16, b.y * TILE + 16, 10, ['#FFE9A8', '#FF9E3D', '#E8562A'], 150);
    }

    if (!count) return;

    /* 伤害只在「炸开的那一瞬间」结算：中心点正好落在火格里的立刻死。
       火焰会继续亮 FLAME_LIFE 秒，但那只是动画 —— 之后走进火里不掉血。 */
    for (const p of state.players) {
      if (!p.alive) continue;
      if (hit.has(pCellX(p) + ',' + pCellY(p))) kill(p);
    }

    state.shake = Math.max(state.shake, 4.5 + Math.min(3, count - 1));
    state.flash = Math.min(0.4, state.flash + 0.16);
    sfx('boom');
  }

  /* 火焰带口味：哪颗弹炸开的就铺谁的爆炸格。同一格被两朵火同时抢时先到先得 */
  function pushFlame(x, y, kind) {
    for (const f of state.flames) {
      if (f.x === x && f.y === y) { f.life = Math.max(f.life, FLAME_LIFE); return; }
    }
    const k = KIND_BY_KEY[kind];
    state.flames.push({ x, y, life: FLAME_LIFE,
      cell: k ? k.cell : 'boom-cell', glow: k ? k.glow : '40,120,240' });
  }

  function addPowerup(x, y, kind) {
    for (const pu of state.powerups) if (pu.x === x && pu.y === y) return;
    state.powerups.push({ x, y, kind, born: state.time });
  }

  /* 拾取：人物中心点落在道具格上就算吃到 */
  function pickup(p) {
    const cx = pCellX(p), cy = pCellY(p);
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const pu = state.powerups[i];
      if (pu.x !== cx || pu.y !== cy) continue;
      if (pu.kind === 'power') p.power = Math.min(POWER_MAX, p.power + 1);
      else if (pu.kind === 'speed') p.spd = Math.min(3, p.spd + 1);
      else p.maxBombs = Math.min(BOMB_MAX, p.maxBombs + 1);
      state.powerups.splice(i, 1);
      sfx('pick');
      burst(pu.x * TILE + 16, pu.y * TILE + 16, 8, ['#FFE9A8', '#EFC96A'], 90);
    }
  }

  /* ------------------------------------------------------------- 死亡 */
  function kill(p) {
    if (!p.alive) return;
    p.alive = false;
    p.dying = true;
    p.dieT = 0;
    p.bombsOut = 0;
    sfx('die');
    burst(pCX(p), pCY(p) - 2, 18, ['#FFF3D2', '#EFC96A', '#FF9E3D'], 130);
    if (state.overTimer < 0) state.overTimer = 1.15;
  }

  function finishRound() {
    state.phase = 'over';
    const alive = state.players.filter(p => p.alive);
    const winner = alive.length === 1 ? alive[0] : null;
    if (winner) { winner.wins++; sfx('win'); }
    else sfx('draw');
    showResult(winner);
    syncHUD(true);
  }

  /* ------------------------------------------------------------- 粒子 */
  function burst(x, y, n, colors, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.9);
      state.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        life: 0.4 + Math.random() * 0.5, max: 0.9,
        size: 1 + Math.random() * 2,
        color: colors[(Math.random() * colors.length) | 0],
        g: 260
      });
    }
  }
  function puff(x, y, n, color, sp) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      state.parts.push({
        x, y, vx: Math.cos(a) * 30 * (Math.random() + .4), vy: Math.sin(a) * 30,
        life: 0.3 + Math.random() * 0.3, max: 0.6,
        size: 1 + Math.random() * 2, color, g: -20
      });
    }
  }

  /* ------------------------------------------------------------- 更新 */
  function step(dt) {
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.4);

    // 粒子永远在跑
    for (let i = state.parts.length - 1; i >= 0; i--) {
      const q = state.parts[i];
      q.life -= dt;
      if (q.life <= 0) { state.parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.98;
    }

    // 雪块滑入新格子的动画也是（纯视觉，跟着粒子一起永远在跑）
    if (state.pushAnims.length) {
      for (const a of state.pushAnims) a.t -= dt;
      state.pushAnims = state.pushAnims.filter(a => a.t > 0);
    }

    if (state.phase !== 'play') {
      if (state.overTimer > 0) {
        state.overTimer -= dt;
        if (state.overTimer <= 0) { state.overTimer = -1; if (state.phase !== 'over') finishRound(); }
      }
      // 结束态仍让死亡动画播完
      for (const p of state.players) if (!p.alive) p.dieT += dt;
      return;
    }

    for (const p of state.players) {
      if (p.isAI) aiUpdate(p, dt);
      updatePlayer(p, dt);
      if (p.alive) pickup(p);
    }

    // 糖弹
    for (const b of state.bombs) {
      if (b.dead) continue;
      b.fuseLeft -= dt;
      if (b.fuseLeft <= 0) detonate(b);
    }
    if (state.bombs.some(b => b.dead)) state.bombs = state.bombs.filter(b => !b.dead);

    // 火焰衰减（只是动画；伤害已经在炸开那一帧结算完了）
    if (state.flames.length) {
      for (const f of state.flames) f.life -= dt;
      state.flames = state.flames.filter(f => f.life > 0);
    }

    if (state.overTimer > 0) {
      state.overTimer -= dt;
      if (state.overTimer <= 0) { state.overTimer = -1; finishRound(); }
    }
  }

  /* ------------------------------------------------------------- 渲染 */
  const VIEW = { up: 'back', down: 'front', left: 'side', right: 'side' };

  function drawShadow(cx, cy, rx, ry, a) {
    ctx.globalAlpha = a == null ? 0.26 : a;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* 人物规格：素材 32×48 —— 整格宽、一格半高。
     碰撞体仍是一整格 32×32（能不能过、会不会被炸到都只看这一格），
     多出来的半格全在头顶：精灵底边对齐脚底，头就自然探进上面那一格。
     于是头顶可以压在上面的围墙上，看着是站在墙前面，而不是贴在墙上的贴纸。 */
  const CHAR_W = 32, CHAR_H = 48;
  const HEAD_OVER = CHAR_H - TILE;      // 16：露在自己碰撞格之外的那半格

  function drawChar(p) {
    const key = p.sprite + '-' + (VIEW[p.dir] || 'front');
    const im = IMG[key];
    if (!im) return;
    const x = Math.round(p.wx);
    const y = Math.round(p.wy);
    const footY = y + TILE;             // 脚底 = 碰撞格下沿
    const topY = footY - CHAR_H;        // 头顶伸到上一格去了（y - 16）
    // 步态：以脚底为轴压扁一点点，绝不顶出格子
    const bounce = p.moving ? Math.abs(Math.sin(p.walkT * 13)) * 0.045 : 0;

    drawShadow(x + TILE / 2, footY - 1.5, p.alive ? 10 : 8, 3.4, p.alive ? 0.28 : 0.12);

    ctx.save();
    if (bounce > 0) {
      ctx.translate(x + TILE / 2, footY);
      ctx.scale(1, 1 - bounce);
      ctx.translate(-(x + TILE / 2), -footY);
    }
    if (p.dir === 'left') { ctx.translate(x + TILE, topY); ctx.scale(-1, 1); }
    else ctx.translate(x, topY);

    if (!p.alive) {
      const k = clamp(p.dieT / 0.9, 0, 1);
      ctx.globalAlpha = Math.max(0, 1 - k * 1.15) * (k > 0.4 ? (Math.sin(p.dieT * 40) > 0 ? 1 : .4) : 1);
      ctx.translate(16, CHAR_H);
      ctx.scale(1 - k * 0.18, 1 - k * 0.62);
      ctx.rotate(k * 0.12);
      ctx.translate(-16, -CHAR_H);
    }
    ctx.drawImage(im, 0, 0, CHAR_W, CHAR_H);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBomb(b) {
    const im = IMG[b.kind] || IMG['bomb'];
    if (!im) return;
    const cx = b.x * TILE + 16, cy = b.y * TILE + 16;
    const t = 1 - b.fuseLeft / FUSE;
    const urgent = t > 0.68;
    /* 素材本身就是整格 32×32，外接圆正好和格子四边相切。
       所以呼吸只允许「缩」，绝不放出去 —— 一放大就压到隔壁格了。 */
    const k = 0.5 + 0.5 * Math.sin(state.time * (urgent ? 34 : 14));
    const s = TILE * (1 - k * (urgent ? 0.05 : 0.025));

    drawShadow(cx, b.y * TILE + TILE - 2, 12, 3.4, 0.3);

    if (urgent) {
      const r = 16 + Math.sin(state.time * 30) * 1.5;
      ctx.globalAlpha = 0.42 + Math.sin(state.time * 30) * 0.16;
      ctx.strokeStyle = '#FF5A3C';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(im, cx - s / 2, cy - s / 2, s, s);

    // 引线火星（贴在球的右上边缘）
    const f = Math.floor(state.time * 18) % 3;
    ctx.fillStyle = f === 0 ? '#FFF3C4' : (f === 1 ? '#FFB347' : '#E8562A');
    const ang = -Math.PI / 4 + (f - 1) * 0.12;
    ctx.fillRect(cx + Math.cos(ang) * 13 - 1, cy + Math.sin(ang) * 13 - 1, 2, 2);
  }

  /* 道具：直接画素材（32×32），底下垫一圈同色光晕 */
  const ITEM_IMG = { power: 'prop-power', bomb: 'prop-bombs', speed: 'prop-speed' };
  const ITEM_GLOW = { power: '255,166,206', bomb: '143,216,245', speed: '186,205,255' };

  function drawPowerup(pu) {
    const cx = pu.x * TILE + TILE / 2;
    const cy = pu.y * TILE + TILE / 2 + Math.sin(state.time * 3 + pu.x) * 1.6;
    const glow = ITEM_GLOW[pu.kind] || '255,222,150';

    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 17);
    g.addColorStop(0, 'rgba(' + glow + ',.42)');
    g.addColorStop(1, 'rgba(' + glow + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 17, cy - 17, 34, 34);

    const im = IMG[ITEM_IMG[pu.kind] || 'prop-power'];
    if (im) {
      ctx.drawImage(im, Math.round(cx) - 16, Math.round(cy) - 16, TILE, TILE);
    } else {
      ctx.fillStyle = '#EFC96A';
      ctx.fillRect(cx - 8, cy - 8, 16, 16);
    }
  }

  /* 障碍物贴图就是 32×32，直接整格铺（按当前主题选图）。
     slideAnim：这块刚被推过 —— 从原来的格子滑过来（纯视觉偏移）。 */
  function drawObstacle(x, y, v, slideAnim) {
    const th = theme();
    let key = null;
    if (v === CRATE) key = th.crate;
    else if (v === AMPHORA) key = th.urn;
    else if (v === CHEST) key = th.chest;
    else if (v === PUSH) key = PUSH_SPRITE;        // 雪块：自定义地图可以换贴图
    if (!key) return;
    const own = SPRITE_GRID[y] && SPRITE_GRID[y][x];
    if (own && IMG[own]) key = own;
    const im = IMG[key];
    if (!im) return;
    let px = x * TILE, py = y * TILE;
    if (slideAnim) {
      const k = 1 - slideAnim.t / PUSH_ANIM;       // 0 -> 1
      const ease = 1 - (1 - k) * (1 - k);          // easeOut：出手快，收尾稳
      px -= slideAnim.dx * (1 - ease) * TILE;
      py -= slideAnim.dy * (1 - ease) * TILE;
    }
    ctx.drawImage(im, Math.round(px), Math.round(py), TILE, TILE);
  }

  /* 火焰：直接用「爆炸格」素材铺格。
     相邻格有火就往那侧多顶 1px，几格连起来就是一片，不会露出格缝。 */
  function drawFlames() {
    if (!state.flames.length) return;
    const map = new Map();
    for (const f of state.flames) map.set(f.x + ',' + f.y, f);

    for (const f of state.flames) {
      const im = IMG[f.cell || 'boom-cell'];
      const life = clamp(f.life / FLAME_LIFE, 0, 1);
      const fade = Math.min(1, life * 2.4);
      const x0 = f.x * TILE, y0 = f.y * TILE;
      const up = map.has(f.x + ',' + (f.y - 1)), dn = map.has(f.x + ',' + (f.y + 1));
      const lf = map.has((f.x - 1) + ',' + f.y), rt = map.has((f.x + 1) + ',' + f.y);
      const ax = x0 - (lf ? 1 : 0), ay = y0 - (up ? 1 : 0);
      const bx = x0 + TILE + (rt ? 1 : 0), by = y0 + TILE + (dn ? 1 : 0);
      const w = bx - ax, h = by - ay;

      // 外扩的光晕（压住地砖，火才有存在感；颜色跟炮弹口味走）
      ctx.globalAlpha = fade * 0.5;
      ctx.fillStyle = 'rgba(' + (f.glow || '40,120,240') + ',.55)';
      ctx.fillRect(ax - 1, ay - 1, w + 2, h + 2);

      ctx.globalAlpha = fade;
      if (im) ctx.drawImage(im, ax, ay, w, h);
      else { ctx.fillStyle = '#1E7CF0'; ctx.fillRect(ax, ay, w, h); }

      // 刚炸开那一下的白闪
      if (life > 0.78) {
        ctx.globalAlpha = (life - 0.78) / 0.22 * 0.8;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x0 + 5, y0 + 5, TILE - 10, TILE - 10);
      }
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (state.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    ctx.drawImage(bg, 0, 0, W, H);

    // 道具
    for (const pu of state.powerups) drawPowerup(pu);

    /* 障碍 + 糖弹按 y 排序做前后遮挡；角色不参与排序，一律画在最上层 ——
       头要比围墙高半格，若还按 y 排序就会被上面的墙茬切掉。 */
    const list = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = state.tiles[y][x];
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH)
          list.push({ y: y * TILE + TILE, kind: 'o', x, yy: y, v });
      }
    }
    for (const b of state.bombs) list.push({ y: b.y * TILE + 22, kind: 'b', b });
    list.sort((a, b) => a.y - b.y);

    const pushing = new Map();                     // 正在被推的雪块按格查偏移
    for (const a of state.pushAnims) pushing.set(a.x + ',' + a.y, a);
    for (const it of list) {
      if (it.kind === 'o') drawObstacle(it.x, it.yy, it.v, pushing.get(it.x + ',' + it.yy));
      else drawBomb(it.b);
    }

    // 最上层：两个角色之间仍按下沿排序，谁在下谁在前
    state.players.slice().sort((a, b) => a.wy - b.wy).forEach(drawChar);

    drawFlames();

    // 粒子
    for (const q of state.parts) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x | 0, q.y | 0, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (state.flash > 0.005) {
      ctx.fillStyle = 'rgba(255,240,200,' + state.flash.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ------------------------------------------------------------- HUD */
  const $ = id => document.getElementById(id);
  const hud = {};

  function syncHUD(force) {
    state.players.forEach((p, i) => {
      const n = i + 1;
      const b = $('b' + n), pw = $('ps' + n), sp = $('sp' + n), card = $('pc' + n);
      if (!b) return;
      const bs = p.bombsOut + ' / ' + p.maxBombs;
      const ps = String(p.power);
      const ss = String(p.spd);
      if (force || hud['b' + n] !== bs) { b.innerHTML = bs.replace('/', '<em>/</em>'); hud['b' + n] = bs; }
      if (force || hud['p' + n] !== ps) { pw.textContent = ps; hud['p' + n] = ps; }
      if (sp && (force || hud['s' + n] !== ss)) { sp.textContent = ss; hud['s' + n] = ss; }
      const dead = !p.alive;
      if (card && card.classList.contains('dead') !== dead) card.classList.toggle('dead', dead);
    });
    const s1 = String(state.players[0].wins), s2 = String(state.players[1].wins);
    if ($('sc1').textContent !== s1) $('sc1').textContent = s1;
    if ($('sc2').textContent !== s2) $('sc2').textContent = s2;
  }

  /* ------------------------------------------------------------- 模式 UI
     人机模式（pve）下，把 P2 那张卡标成「AI 托管」，藏掉人类按键提示。 */
  function applyModeUI() {
    const card = $('pc2'), badge = $('ai2'), keys = $('keys2');
    if (!card) return;
    const ai = state.mode === 'pve';
    card.classList.toggle('ai', ai);
    if (badge) badge.hidden = !ai;
    if (keys) keys.style.display = ai ? 'none' : '';
  }

  /* ------------------------------------------------------------- 覆盖层 */
  const ov = $('ov');
  let mapsScroll = 0;   // 选图条的滚动位置，showStart 重绘时恢复
  let mapsTimer = 0;    // 选图条状态轮询（rAF 在后台内嵌页里会被挂起，不能靠它）

  /* 选图条箭头状态 + 滚动位置记忆：showStart 起一个轻量轮询，
     离开准备页自动停；不依赖 scroll 事件（内嵌浏览器里可能不触发） */
  function syncMapsNav() {
    const wrap = ov.querySelector('.ov-maps-wrap');
    if (!wrap) return;
    const strip = wrap.querySelector('.ov-maps');
    const prev = wrap.querySelector('.maps-nav.prev');
    const next = wrap.querySelector('.maps-nav.next');
    mapsScroll = strip.scrollLeft;
    const max = strip.scrollWidth - strip.clientWidth;
    wrap.classList.toggle('paged', strip.scrollWidth > strip.clientWidth + 4);
    prev.disabled = mapsScroll <= 2;
    next.disabled = mapsScroll >= max - 2;
  }

  function startMapsSync() {
    clearInterval(mapsTimer);
    mapsTimer = setInterval(() => {
      if (state.phase !== 'ready' || !ov.querySelector('.ov-maps-wrap')) {
        clearInterval(mapsTimer);
        return;
      }
      syncMapsNav();
    }, 200);
  }

  /* 地图缩略图：色值直接从贴图中心采样，换主题不会脱节 */
  const MINI_COL = {};
  function spriteCol(key, dx, dy) {
    const k = key + ':' + dx + ',' + dy;
    if (MINI_COL[k]) return MINI_COL[k];
    let col = '#3A2A1C';
    const im = IMG[key];
    if (im) {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const g2 = c.getContext('2d');
      g2.drawImage(im, 0, 0, 32, 32);
      const d = g2.getImageData(dx, dy, 1, 1).data;
      if (d[3] > 40) col = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
    }
    MINI_COL[k] = col;
    return col;
  }

  function parseRows(map) {
    const rows = map.rows, t = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const ch = rows[y][x];
        row.push(ch === '#' ? WALL : ch === 'P' ? PILLAR : ch === 'c' ? CRATE
          : ch === 'o' ? AMPHORA : ch === '$' ? CHEST : ch === 's' ? PUSH
            : ch === 'd' ? DECOR : EMPTY);
      }
      t.push(row);
    }
    return t;
  }

  function drawMini(canvas, map) {
    const t = parseRows(map);
    const S = 6;                       // 每格 6px -> 126×72
    canvas.width = COLS * S;
    canvas.height = ROWS * S;
    const g2 = canvas.getContext('2d');
    g2.imageSmoothingEnabled = false;
    g2.fillStyle = spriteCol(map.floor.base, 16, 16);
    g2.fillRect(0, 0, canvas.width, canvas.height);

    // 自定义地图手绘的地面层
    if (map.frows) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const k = FLOOR_KEYS[+map.frows[y][x]];
          if (!k) continue;
          g2.fillStyle = spriteCol(k, 16, 16);
          g2.fillRect(x * S, y * S, S, S);
        }
      }
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = t[y][x];
        const ch = map.rows[y][x];
        const own = map.pal && typeof map.pal[ch] === 'string' ? map.pal[ch] : null;
        let col = null;
        if (v === WALL) col = spriteCol(own || map.wall, 16, 16);
        else if (v === PILLAR) col = spriteCol(own || map.pillar, 16, 16);
        else if (v === CRATE) col = spriteCol(own || map.crate, 16, 16);
        else if (v === AMPHORA) col = spriteCol(own || map.urn, 16, 16);
        else if (v === CHEST) col = spriteCol(own || map.chest, 16, 16);
        else if (v === PUSH) col = spriteCol(own || PUSH_SPRITE, 16, 16);
        else if (v === DECOR) col = spriteCol(own || map.decor || 'prop-snowman', 16, 16);
        if (!col) continue;
        g2.fillStyle = col;
        g2.fillRect(x * S, y * S, S, S);
        if (v !== CHEST) {             // 顶面提亮一线，缩略图才不糊成色块
          g2.fillStyle = 'rgba(255,255,255,.18)';
          g2.fillRect(x * S, y * S, S, 1);
        }
      }
    }
    // 出生点
    map.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch !== '1' && ch !== '2') continue;
        g2.fillStyle = ch === '1' ? '#EFC96A' : '#4CA64C';
        g2.fillRect(x * S, y * S, S, S);
      }
    });
  }

  /* 在准备页里换图：不离开准备页，只把画布和文案一起换掉 */
  function pickMap(i) {
    if (i === state.mapIdx) return;
    state.mapIdx = i;
    state.tiles = parseMap();
    state.players = [makePlayer(0), makePlayer(1)];
    state.bombs = []; state.flames = []; state.powerups = []; state.parts = [];
    state.pushAnims = [];
    state.time = 0; state.overTimer = -1; state.shake = 0; state.flash = 0;
    bakeBg(state.tiles);
    syncHUD(true);
    updateMapBtn();
    showStart();
    render();
  }

  function showStart() {
    state.phase = 'ready';
    ov.innerHTML = `
      <div class="ov-box">
        <div class="ov-modes">
          <button class="mode-btn${state.mode === 'pve' ? ' on' : ''}" data-mode="pve" type="button">人机对战</button>
          <button class="mode-btn${state.mode === 'pvp' ? ' on' : ''}" data-mode="pvp" type="button">双人对战</button>
        </div>
        <div class="ov-labelrow">
          <span class="ov-label">选择地图</span>
          <span class="ov-count">${MAPS.length} 张</span>
        </div>
        <div class="ov-maps-wrap">
          <button class="maps-nav prev" type="button" aria-label="上一页">‹</button>
          <div class="ov-maps">
            ${MAPS.map((m, i) => `
            <button class="map-card${i === state.mapIdx ? ' on' : ''}" data-map="${i}" type="button">
              <span class="tick">已选</span>
              ${m.custom ? '<span class="flag">自定义</span>' : ''}
              <span class="thumb"><canvas></canvas></span>
              <span class="nm"><b>${m.name}</b><i>${m.sub}</i></span>
            </button>`).join('')}
          </div>
          <button class="maps-nav next" type="button" aria-label="下一页">›</button>
        </div>
        <div class="ov-grid">
          <div class="ov-cell p1">
            <h4><span class="dot" style="color:#EFC96A"></span>玩家 1 · 塞尔达</h4>
            ${bombStripHTML(0)}
            <div class="kline"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><i>移动</i></div>
            <div class="kline"><kbd class="space">空格</kbd><i>放糖弹</i></div>
          </div>
          <div class="ov-cell p2">
            <h4><span class="dot" style="color:#4CA64C"></span>${state.mode === 'pve' ? '玩家 2 · 林克（AI）' : '玩家 2 · 林克'}</h4>
            ${bombStripHTML(1)}
            ${state.mode === 'pve'
              ? '<div class="kline"><i>由 AI 托管 · 自动走位与放弹</i></div>'
              : '<div class="kline"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><i>移动</i></div><div class="kline"><kbd class="wide">回车</kbd><i>放糖弹</i></div>'}
          </div>
        </div>
        <button class="btn" id="btnStart">开始对战</button>
      </div>`;
    ov.classList.add('on');

    ov.querySelectorAll('.map-card').forEach(el => {
      const i = +el.dataset.map;
      drawMini(el.querySelector('canvas'), MAPS[i]);
      el.onclick = () => pickMap(i);
    });

    /* 选图条翻页：图多到放不下才出现箭头。箭头状态与滚动位置的记忆
       交给 startMapsSync 的轮询（scroll 事件 / rAF 在内嵌浏览器里都不可靠）；
       翻页用瞬时滚动 + scroll-snap 落格，平滑滚动会被吸附打断 */
    const wrap = ov.querySelector('.ov-maps-wrap');
    if (wrap) {
      const strip = wrap.querySelector('.ov-maps');
      wrap.querySelector('.maps-nav.prev').onclick =
        () => strip.scrollBy({ left: -(strip.clientWidth - 30) });
      wrap.querySelector('.maps-nav.next').onclick =
        () => strip.scrollBy({ left: strip.clientWidth - 30 });
      strip.scrollLeft = mapsScroll;
      syncMapsNav();
      startMapsSync();
    }

    ov.querySelectorAll('.mode-btn').forEach(el => {
      el.onclick = () => { state.mode = el.dataset.mode; applyModeUI(); showStart(); };
    });

    /* 炮弹选择条：点谁用谁，选中框当场挪过去（不整页重绘，选图条不闪） */
    ov.querySelectorAll('.bomb-strip').forEach(strip => {
      const pi = +strip.dataset.p;
      strip.querySelectorAll('.bkind').forEach(el => {
        el.onclick = () => { setPick(pi, el.dataset.kind); el.blur(); };
      });
    });

    applyModeUI();
    const btn = $('btnStart');
    if (btn) btn.onclick = () => { audio(); startRound(); };
  }

  function showResult(winner) {
    const isChamp = winner && winner.wins >= WIN_ROUND;
    const face = winner ? SPRITES[winner.sprite + '-front'] : '';
    const title = !winner ? '同归于尽' : (isChamp ? winner.name + ' 夺冠！' : winner.name + ' 获胜');
    const sub = !winner
      ? '两颗糖弹同时开花，谁都别想活着走出去。'
      : (isChamp ? `连下 ${WIN_ROUND} 城，遗迹归 ${winner.name} 所有。`
        : `第 ${state.players[0].wins + state.players[1].wins} 局结束 · 再赢 ${WIN_ROUND - winner.wins} 局夺冠`);
    ov.innerHTML = `
      <div class="ov-box">
        <div class="ov-kicker">ROUND OVER</div>
        ${face ? `<img class="result-face" src="${face}" alt="">` : ''}
        <div class="ov-title" style="color:${winner && winner.idx === 1 ? '#9BE08F' : '#FFF3D2'}">${title}</div>
        <div class="ov-sub">${sub}</div>
        <button class="btn" id="btnNext">${isChamp ? '重新开始' : '下一局'}</button>
        <div style="margin-top:12px; font-size:10.5px; color:#6E5B44; letter-spacing:.1em">按 空格 / 回车 也可以继续</div>
      </div>`;
    ov.classList.add('on');
    const btn = $('btnNext');
    if (btn) btn.onclick = () => {
      if (isChamp) state.players.forEach(p => p.wins = 0);
      startRound();
    };
  }

  function hideOverlay() { ov.classList.remove('on'); }

  /* ------------------------------------------------------------- 换图 */
  function updateMapBtn() {
    const b = $('btnMap');
    if (b) b.textContent = '地图 · ' + theme().name;
  }

  function switchMap(dir) {
    const wasReady = state.phase !== 'play';   // 开局前换图，换完还留在准备页
    state.mapIdx = (state.mapIdx + (dir || 1) + MAPS.length) % MAPS.length;
    state.players.forEach(p => p.wins = 0);    // 换图=换关卡，比分重算
    startRound();
    updateMapBtn();
    if (wasReady) showStart();
  }

  /* ------------------------------------------------------------- 开局 */
  function startRound() {
    state.tiles = parseMap();
    state.bombs = [];
    state.flames = [];
    state.powerups = [];
    state.parts = [];
    state.pushAnims = [];
    state.overTimer = -1;
    state.shake = 0;
    state.flash = 0;
    state.time = 0;

    const wins = state.players.length ? state.players.map(p => p.wins) : [0, 0];
    state.players = [makePlayer(0), makePlayer(1)];
    state.players[0].wins = wins[0] || 0;
    state.players[1].wins = wins[1] || 0;

    bakeBg(state.tiles);
    syncHUD(true);
    state.players.forEach(p => { const c = $('pc' + (p.idx + 1)); if (c) c.classList.remove('dead', 'win'); });
    hideOverlay();
    applyModeUI();
    state.phase = 'play';
    state.flash = 0.35;
  }

  /* ------------------------------------------------------------- 输入 */
  const BOMB_CODES = ['Space', 'KeyJ', 'Enter', 'Numpad0', 'NumpadEnter'];
  window.addEventListener('keydown', e => {
    if (BOMB_CODES.indexOf(e.code) >= 0 || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (held[e.code]) return;          // 忽略长按重复
    held[e.code] = true;

    if (e.code === 'KeyM') { switchMap(1); return; }

    if (state.phase === 'ready' || state.phase === 'over') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        const btn = $('btnStart') || $('btnNext');
        if (btn) btn.click();
      }
      if (e.code === 'KeyR') { state.players.forEach(p => p.wins = 0); startRound(); }
      return;
    }

    for (const p of state.players) {
      if (!p.alive || p.isAI) continue;     // AI 不接键盘
      const k = p.key;
      if (e.code === k.up) p.lastDir = 'up';
      else if (e.code === k.down) p.lastDir = 'down';
      else if (e.code === k.left) p.lastDir = 'left';
      else if (e.code === k.right) p.lastDir = 'right';
      else if (k.bomb.indexOf(e.code) >= 0) placeBomb(p);
    }
  });
  window.addEventListener('keyup', e => { held[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

  /* ------------------------------------------------------------- 循环 */
  const FIXED = 1 / 120;
  let acc = 0, last = 0, paused = false;
  function loop(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.2) dt = 0.2;
    if (paused) { acc = 0; render(); syncHUD(false); requestAnimationFrame(loop); return; }
    acc += dt;
    let guard = 0;
    while (acc >= FIXED && guard++ < 12) { step(FIXED); acc -= FIXED; }
    render();
    syncHUD(false);
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------- 尺寸 */
  /* 按整数 / 半整数档放大，避免像素宽窄不均；再大就超出素材颗粒感了 */
  function applyView(v) {
    v = Math.max(1, Math.min(2, v));
    const w = Math.round(W * v), h = Math.round(H * v);
    if (v === SCALE && cv.style.width === w + 'px') return;
    SCALE = v;
    RS = v * BASE_DPR;
    cv.width = Math.round(W * RS);
    cv.height = Math.round(H * RS);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (state.tiles.length) { bakeBg(state.tiles); render(); syncHUD(false); }
  }

  function fitCanvas() {
    const mainEl = document.querySelector('main');
    const railEl = document.getElementById('rail');
    if (!mainEl) return;
    // 窄屏交给 CSS（侧栏转为横排），内联尺寸会和媒体查询打架
    if (window.innerWidth <= 1180) {
      if (cv.style.width) {
        cv.style.width = ''; cv.style.height = '';
        ctx.setTransform(RS, 0, 0, RS, 0, 0);
      }
      return;
    }
    const mr = mainEl.getBoundingClientRect();
    const rw = railEl ? railEl.getBoundingClientRect().width : 0;
    const availW = mr.width - rw - 18 - 8;   // gap + 余量（舞台已无边框内边距）
    const availH = mr.height - 8;
    if (availW < 200 || availH < 120) return;
    const raw = Math.min(availW / W, availH / H);
    let v = 1;
    for (const s of SCALE_STEPS) if (s <= raw + 0.002) v = s;
    applyView(v);
  }

  /* ------------------------------------------------------------- 启动 */
  function loadSprites() {
    const jobs = Object.keys(SPRITES).map(k => new Promise(res => {
      const im = new Image();
      im.onload = () => { IMG[k] = im; res(); };
      im.onerror = () => { console.warn('load fail', k); res(); };
      im.src = SPRITES[k];
    }));
    return Promise.all(jobs);
  }

  function bindChrome() {
    const sp = document.querySelector('.sp');
    if (sp) sp.textContent = COLS + ' × ' + ROWS + ' TILES · ' + TILE + 'PX';
    const f1 = $('face1'), f2 = $('face2');
    if (f1) f1.src = SPRITES['zelda-front'];
    if (f2) f2.src = SPRITES['link-front'];
    bindBombStrip($('pb1'), 0);                  // 局内面板：随时换炮弹
    bindBombStrip($('pb2'), 1);
    updateMapBtn();
    applyModeUI();
    const mb = $('btnMap');
    if (mb) mb.onclick = () => switchMap(1);
    const rb = $('btnRestart');
    if (rb) rb.onclick = () => {
      state.players.forEach(p => p.wins = 0);
      startRound();
    };
    const eb = $('btnEdit');
    if (eb) eb.onclick = () => { window.open('QQTang-mapeditor-v1.html', '_blank'); };
    const snd = $('btnSound');
    if (snd) snd.onclick = () => {
      state.muted = !state.muted;
      snd.textContent = state.muted ? '音效 关' : '音效 开';
      if (!state.muted) { audio(); tone(880, .08, 'triangle', .05); }
    };
  }

  loadSprites().then(() => {
    /* 编辑器「用这张图开一局」会带 ?map=<id> 过来；
       导出的单文件 HTML 则是把 id 写在 window.__QQTANG_PICK__ 里。都直接选中。 */
    const want = (location.search || '').match(/[?&]map=([^&]+)/);
    let wantId = window.__QQTANG_PICK__ || null;
    if (want) wantId = decodeURIComponent(want[1]);
    if (wantId) {
      const i = MAPS.findIndex(m => m.id === wantId);
      if (i >= 0) state.mapIdx = i;
    }
    state.tiles = parseMap();
    bakeBg(state.tiles);
    state.players = [makePlayer(0), makePlayer(1)];
    bindChrome();
    syncHUD(true);
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    if (window.ResizeObserver) {
      new ResizeObserver(fitCanvas).observe(document.querySelector('main'));
    }
    showStart();
    requestAnimationFrame(loop);
  });

  /* 测试钩子 */
  window.__game = {
    start: () => { startRound(); },
    pause: v => { paused = !!v; },
    step: n => { for (let i = 0; i < (n || 1); i++) step(FIXED); },
    consts: { TILE, COLS, ROWS, SUB, STEP, SPEED, FUSE, FLAME_LIFE, FIXED, WIN_ROUND, ALIGN_MAX, POWER_MAX, BOMB_MAX },
    snap: () => ({
      phase: state.phase,
      time: +state.time.toFixed(2),
      bombs: state.bombs.map(b => ({ x: b.x, y: b.y, fuse: +b.fuseLeft.toFixed(2), power: b.power, kind: b.kind })),
      flames: state.flames.map(f => ({ x: f.x, y: f.y, cell: f.cell })),
      powerups: state.powerups.map(p => ({ x: p.x, y: p.y, kind: p.kind })),
      players: state.players.map(p => ({
        cell: [pCellX(p), pCellY(p)],
        wx: +p.wx.toFixed(2), wy: +p.wy.toFixed(2),
        cx: Math.round(pCX(p)), cy: Math.round(pCY(p)),
        subX: +(((p.wx % TILE) + TILE) % TILE).toFixed(2),
        subY: +(((p.wy % TILE) + TILE) % TILE).toFixed(2),
        alive: p.alive, isAI: !!p.isAI, power: p.power, bombs: p.maxBombs, spd: p.spd,
        out: p.bombsOut, wins: p.wins, bomb: p.bombKind
      })),
      crates: state.tiles.reduce((n, r) => n + r.filter(v => v === CRATE || v === AMPHORA || v === CHEST || v === PUSH).length, 0),
      decors: state.tiles.reduce((n, r) => n + r.filter(v => v === DECOR).length, 0)
    }),
    /* 切到某张地图（测试用）：按 id 找，换完贴图与出生点一起刷新 */
    map: id => {
      const i = MAPS.findIndex(m => m.id === id);
      if (i >= 0) state.mapIdx = i;
      state.tiles = parseMap();
      bakeBg(state.tiles);
      state.players = [makePlayer(0), makePlayer(1)];
      state.bombs = []; state.flames = []; state.powerups = []; state.parts = [];
      state.pushAnims = [];
      state.overTimer = -1; state.shake = 0; state.flash = 0;
      updateMapBtn();
      return theme().id;
    },
    mapId: () => theme().id,
    /* 从 1 号出生点泛洪（墙/柱子不可过，可炸障碍算通），看另一侧能不能到 */
    reach: strict => {
      const seen = new Set(), key = (x, y) => x + ',' + y;
      const q = [[SPAWNS[0].x, SPAWNS[0].y]];
      seen.add(key(SPAWNS[0].x, SPAWNS[0].y));
      while (q.length) {
        const [x, y] = q.shift();
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + d[0], ny = y + d[1];
          if (!inside(nx, ny) || seen.has(key(nx, ny))) continue;
          const v = state.tiles[ny][nx];
          // 雪人是实心装饰，炸不开也走不过去
          if (v === WALL || v === PILLAR || v === DECOR) continue;
          // 严格模式：可炸的东西也还没炸开，人过不去
          if (strict && v !== EMPTY) continue;
          seen.add(key(nx, ny)); q.push([nx, ny]);
        }
      }
      return { n: seen.size, other: seen.has(key(SPAWNS[1].x, SPAWNS[1].y)) };
    },
    maps: () => MAPS.map(m => m.id),
    /* 注入一张自定义地图（编辑器存的那种原始对象） */
    addMap: raw => {
      const m = normalizeMap(raw);
      if (!m || MAPS.some(x => x.id === m.id)) return null;
      MAPS.push(m);
      return m.id;
    },
    userMaps: () => MAPS.filter(m => m.custom).map(m => m.id),
    mapById: id => {
      const m = MAPS.find(x => x.id === id);
      if (!m) return null;
      return { id: m.id, name: m.name, custom: !!m.custom, drop: m.drop,
               frows: !!m.frows, pal: m.pal || null, wall: m.wall, crate: m.crate };
    },
    /* 某张地图的可炸障碍数（不用切图，直接数 rows） */
    cratesOf: id => {
      const m = MAPS.find(x => x.id === id);
      if (!m) return 0;
      let n = 0;
      for (const row of m.rows) for (const ch of row) if (ch === 'c' || ch === '$' || ch === 'o' || ch === 's') n++;
      return n;
    },
    /* 当前地图的障碍掉落率 */
    dropRate: () => theme().drop,
    /* 当前地图所有石柱坐标，用来断言冰柱只在四角 */
    pillarCells: () => {
      const out = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) if (state.tiles[y][x] === PILLAR) out.push([x, y]);
      }
      return out;
    },
    /* 某一格现在是什么（0 空地 / 1 墙 / 2 柱 / 3 可炸 / 5 宝箱 / 6 实心装饰 / 7 雪块） */
    tileAt: (x, y) => (inside(x, y) ? state.tiles[y][x] : -1),
    decorCells: () => {
      const out = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) if (state.tiles[y][x] === DECOR) out.push([x, y]);
      }
      return out;
    },
    place: i => placeBomb(state.players[i]),
    placeAt: (x, y, power, idx, kind) => {
      const owner = state.players[idx || 0];
      state.bombs.push({ x, y, power: power || 1, fuseLeft: FUSE, owner, dead: false, birth: state.time,
        kind: kind && KIND_BY_KEY[kind] ? kind : owner.bombKind });
      owner.bombsOut++;
      return state.bombs.length;
    },
    /* 炮弹口味：换某人的口味 / 回到默认（回归测试开局先归零，防止上一次的
       选择存进 localStorage 干扰断言）/ 列出全部口味 key */
    bomb: (i, kind) => setPick(i, kind) ? PICKS[i] : null,
    bombReset: () => {
      try { localStorage.removeItem(BOMB_STORE); } catch (e) { /* 无所谓 */ }
      BOMB_DEFAULT.forEach((k, i) => {
        PICKS[i] = k;
        const p = state.players[i];
        if (p) p.bombKind = k;
      });
      syncBombUI();
      return PICKS.slice();
    },
    kinds: () => BOMB_KINDS.map(k => k.key),
    /* 放到某格（格坐标，左上角对齐） */
    setPos: (i, cx, cy) => {
      const p = state.players[i];
      p.wx = cx * TILE; p.wy = cy * TILE;
      p.moving = false; p.walkT = 0;
    },
    /* 放到任意像素（子格级别，测拐弯修正用） */
    put: (i, wx, wy) => {
      const p = state.players[i];
      p.wx = wx; p.wy = wy;
      p.moving = false; p.walkT = 0;
    },
    /* 沿方向直接走 N 格（返回实际走了几格） */
    walk: (i, dir, cells) => {
      const p = state.players[i], d = DIRS[dir];
      let n = 0;
      for (let k = 0; k < (cells || 1); k++) {
        if (!boxFree(p.wx + d[0] * TILE, p.wy + d[1] * TILE, p)) break;
        p.wx += d[0] * TILE; p.wy += d[1] * TILE; n++;
      }
      p.moving = false;
      return n;
    },
    /* 身体某个位置是否可站（测碰撞体用，i 给了就按那个人当前的站位放行自己身上的糖弹） */
    free: (wx, wy, i) => boxFree(wx, wy, i == null ? null : state.players[i]),
    /* 直接放一个道具（测拾取，免掉随机数） */
    powerup: (x, y, kind) => { addPowerup(x, y, kind); return state.powerups.length; },
    /* 贴图里不透明像素的包围盒（验证「撑满一格」用） */
    spriteBox: key => {
      const im = IMG[key];
      if (!im) return null;
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g2 = c.getContext('2d');
      g2.drawImage(im, 0, 0);
      const d = g2.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      return x1 < 0 ? null : [x0, y0, x1, y1];
    },
    /* 贴图像素尺寸（验证人物正好一格） */
    sprite: key => {
      const im = IMG[key];
      return im ? [im.width, im.height] : null;
    },
    /* 当前朝向 + 位置 + 是否在动（测「只转身不挪步」用） */
    facing: i => {
      const p = state.players[i];
      return { dir: p.dir, wx: +p.wx.toFixed(2), wy: +p.wy.toFixed(2), moving: p.moving,
               pushT: +p.pushT.toFixed(3) };
    },
    /* 直接改一格地形（测试用：把随机雪人拿掉、摆障碍等；只动逻辑层，背景不重烘） */
    setTile: (x, y, v) => { if (inside(x, y)) state.tiles[y][x] = v; },
    key: (code, down) => {
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    },
    /* 立刻重画一帧（无头环境下 rAF 不保证跟在状态变化后面，取样前先手动刷一次） */
    paint: () => { render(); syncHUD(false); },
    overlay: () => ({ on: ov.classList.contains('on'), text: ov.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) }),
    /* 回到准备页（选地图那页） */
    home: () => { showStart(); render(); },
    /* AI 相关：切换人机/双人模式、查看 AI 状态、读危险图 */
    setMode: m => { state.mode = (m === 'pvp') ? 'pvp' : 'pve'; applyModeUI(); return state.mode; },
    getMode: () => state.mode,
    aiInfo: () => state.players.map(p => ({ idx: p.idx, isAI: !!p.isAI, dir: p.aiDir, alive: p.alive,
      timer: +p.aiTimer.toFixed(3), grown: grownOf(p),
      plan: p.aiPlan ? { kind: p.aiPlan.kind, x: p.aiPlan.x, y: p.aiPlan.y } : null })),
    aiBombs: () => state.aiBombs,
    danger: () => aiDangerMap()
  };
})();
