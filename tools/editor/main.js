/* =========================================================================
   QQ糖 · 地图编辑器
   21×12 格，每格 32px。素材全部来自 assets/sucai，和游戏用的是同一批。
   编辑完的地图存进 localStorage（游戏启动时自动接在内置地图后面），
   也可以导出 JSON，或者直接导出一份「烧好这张图」的单文件游戏。
   ========================================================================= */
(function () {
  'use strict';

  const TILE = 32, COLS = 21, ROWS = 12, W = COLS * TILE, H = ROWS * TILE;
  const STORE_KEY = 'qqtang.maps.v1';

  const SPRITES = __SPRITE_DATA__;
  const GAME_TPL = __GAME_TPL__;      // 游戏页面模板（样式 / 脚本两个插口留给导出时填）
  const GAME_JS = __GAME_JS__;        // 游戏脚本（素材插口留给导出时填）
  const GAME_CSS = __GAME_CSS__;
  /* 游戏脚本里的素材占位符。拼起来写，免得打包时被当成真占位符替换掉 */
  const SPRITE_SLOT = '__SPRITE' + '_DATA__';

  /* 地砖代号：游戏里的 FLOOR_KEYS 必须和这个一模一样 */
  const FLOOR_KEYS = [
    'tile-sand', 'tile-temple', 'tile-carpet', 'tile-carpet-emblem',
    'tile-carpet-astral', 'tile-carpet-rune', 'tile-carpet-vortex',
    'tile-ice', 'tile-ice-snow'
  ];

  const THEMES = {
    temple: { name: '夺宝神殿', floor: 0, wall: 'wall-stone', pillar: 'wall-pillar',
              crate: 'prop-crate', chest: 'prop-chest', drop: 0.34 },
    ice:    { name: '冰原', floor: 7, wall: 'wall-icebrick', pillar: 'wall-icepillar',
              crate: 'prop-iceblock', chest: 'prop-icechest', drop: 0.5 }
  };

  /* 内置地图：既能当模板打开，也能在编辑器里改 */
  const BUILTIN = {
    temple: {
      name: '夺宝神殿', theme: 'temple', drop: 0.34, pal: {},
      rows: [
        '#####################',
        '#1.c.c.c.c.c.c.c.c..#',
        '#.P.P.P.P.P.P.P.P.P.#',
        '#.c.c..o.....o..c.c.#',
        '#.P.P.P.P.P.P.P.P.P.#',
        '#.c..$..c...c..$..c.#',
        '#.P.P.P.P.P.P.P.P.P.#',
        '#.c.c..o.....o..c.c.#',
        '#.P.P.P.P.P.P.P.P.P.#',
        '#.c.c.c.c.c.c.c.c...#',
        '#..................2#',
        '#####################'
      ]
    },
    ice: {
      name: '冰原', theme: 'ice', drop: 0.5, pal: {},
      rows: [
        '#####################',
        '#1PP...........ccPP.#',
        '#.PP.$ccc$.....c.PPc#',
        '#..P...cc..c...c.P.$#',
        '#.c.c.ccc...cc......#',
        '#.c.c.ccc...ccc.c.c.#',
        '#.c.c.ccc...ccc.c.c.#',
        '#......cc...ccc.c.c.#',
        '#c.P.$...c..cc...P..#',
        '#cPP.c.....c$cc$.PP.#',
        '#.PPcc...........PP2#',
        '#####################'
      ]
    }
  };

  /* 内置图里的 'o'（陶罐）在编辑器里统一按「可炸障碍」处理 */
  const TRANS = { '#': '#', 'P': 'P', 'c': 'c', 'o': 'c', '$': '$', 'd': 'd', '.': '.', '1': '1', '2': '2' };

  /* 障碍标签：和素材页共用同一份定义（构建时由 obstacle_tags.py 注入）。
     推动玩法还没做，所以现在全是「不可推动」—— 等做出来，改那张表就行。 */
  const TAGS = __OBSTACLE_TAGS__;
  const tagHTML = ch => {
    const t = TAGS[ch];
    if (!t) return '';
    return '<div class="tags" title="' + t.name + ' · ' + t.note + '">'
      + t.tags.map(c => '<span class="chip ' + c[1] + '">' + c[0] + '</span>').join('')
      + '</div>';
  };

  /* ------------------------------------------------------------- 素材笔 */
  const GROUPS = [
    { t: '地面', items: [
      { k: 'floor', i: 0, n: '沙地' }, { k: 'floor', i: 1, n: '石砖道' },
      { k: 'floor', i: 2, n: '红毯' }, { k: 'floor', i: 3, n: '徽章毯' },
      { k: 'floor', i: 4, n: '星纹毯' }, { k: 'floor', i: 5, n: '符文毯' },
      { k: 'floor', i: 6, n: '漩涡毯' }, { k: 'floor', i: 7, n: '冰面' },
      { k: 'floor', i: 8, n: '雪花冰' }
    ] },
    { t: '硬墙', items: [
      { k: 'obj', ch: '#', s: 'wall-stone', n: '石墙' },
      { k: 'obj', ch: '#', s: 'wall-icebrick', n: '冰砖墙' }
    ] },
    { t: '石柱', items: [
      { k: 'obj', ch: 'P', s: 'wall-pillar', n: '雕纹柱' },
      { k: 'obj', ch: 'P', s: 'wall-icepillar', n: '冰柱' }
    ] },
    { t: '可炸障碍（不可推动）', items: [
      { k: 'obj', ch: 'c', s: 'prop-crate', n: '木箱' },
      { k: 'obj', ch: 'c', s: 'prop-amphora', n: '彩陶罐' },
      { k: 'obj', ch: 'c', s: 'prop-iceblock', n: '冰块' },
      { k: 'obj', ch: 'c', s: 'prop-block-red', n: '纯色方块·朱红' },
      { k: 'obj', ch: 'c', s: 'prop-block-violet', n: '纯色方块·紫晶' }
    ] },
    { t: '雪块（可推动 · 可炸）', items: [
      { k: 'obj', ch: 's', s: 'prop-snowblock', n: '雪块' }
    ] },
    { t: '宝箱（必掉道具）', items: [
      { k: 'obj', ch: '$', s: 'prop-chest', n: '金宝箱' },
      { k: 'obj', ch: '$', s: 'prop-icechest', n: '冰宝箱' }
    ] },
    { t: '实心装饰（挡路 · 炸不开）', items: [
      { k: 'obj', ch: 'd', s: 'prop-snowman', n: '小雪人' }
    ] },
    { t: '出生点', items: [
      { k: 'spawn', ch: '1', s: 'zelda-front', n: '塞尔达' },
      { k: 'spawn', ch: '2', s: 'link-front', n: '林克' }
    ] },
    { t: '工具', items: [
      { k: 'erase', n: '橡皮' }
    ] }
  ];

  /* ------------------------------------------------------------- 状态 */
  const st = {
    id: null, name: '我的地图', theme: 'temple', drop: 0.4,
    rows: [], frows: [], pal: {},
    brush: GROUPS[3].items[0],        // 默认：木箱
    tool: 'brush', grid: true,
    fTouch: false, dirty: false
  };

  const IMG = {};
  let RS = 2;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');

  /* ------------------------------------------------------------- 地图 */
  function freshRows() {
    const r = [];
    for (let y = 0; y < ROWS; y++) {
      let s = '';
      for (let x = 0; x < COLS; x++) {
        s += (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) ? '#' : '.';
      }
      r.push(s);
    }
    return r;
  }
  function freshFloors(themeId) {
    const c = String(THEMES[themeId].floor);
    const r = [];
    for (let y = 0; y < ROWS; y++) r.push(new Array(COLS).fill(c).join(''));
    return r;
  }
  function setCellChar(rows, x, y, ch) {
    rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
  }

  function newMap(themeId) {
    const rows = freshRows();
    setCellChar(rows, 1, 1, '1');
    setCellChar(rows, COLS - 2, ROWS - 2, '2');
    st.id = null; st.name = '我的地图'; st.theme = themeId || 'temple';
    st.drop = THEMES[st.theme].drop;
    st.rows = rows; st.frows = freshFloors(st.theme); st.pal = {};
    st.fTouch = false; st.dirty = false;
    clearHistory();
    syncFields();
  }

  /* 打开一张已有的地图（内置模板 / 自定义） */
  function openMap(raw) {
    const rows = raw.rows.map(r => {
      let s = String(r);
      while (s.length < COLS) s += '.';
      s = s.slice(0, COLS);
      return s.split('').map(ch => TRANS[ch] || '.').join('');
    });
    const themeId = THEMES[raw.theme] ? raw.theme : 'temple';
    let frows = null;
    if (Array.isArray(raw.frows) && raw.frows.length === ROWS) {
      frows = raw.frows.map(r => {
        let s = String(r);
        while (s.length < COLS) s += '0';
        return s.slice(0, COLS).replace(/[^0-8]/g, '0');
      });
    }
    st.id = raw.id || null;
    st.name = raw.name || '我的地图';
    st.theme = themeId;
    st.drop = typeof raw.drop === 'number' ? raw.drop : THEMES[themeId].drop;
    st.rows = rows;
    st.frows = frows || freshFloors(themeId);
    st.fTouch = !!frows;
    st.pal = {};
    if (raw.pal) for (const k in raw.pal) if (typeof raw.pal[k] === 'string') st.pal[k] = raw.pal[k];
    st.dirty = false;
    clearHistory();
    syncFields();
  }

  /* 导出前先把界面上的名字 / 掉落率读回来（用户可能刚改完还没保存） */
  function syncName() {
    const n = document.getElementById('fName');
    if (n && n.value.trim()) st.name = n.value.trim().slice(0, 18);
    const d = document.getElementById('fDrop');
    if (d) st.drop = +d.value;
  }

  function exportMap() {
    syncName();
    const pal = {};
    for (const k in st.pal) if (st.pal[k]) pal[k] = st.pal[k];
    return {
      v: 1,
      id: st.id || ('u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
      name: st.name, theme: st.theme, drop: st.drop,
      rows: st.rows.slice(), frows: st.frows.slice(), pal: pal
    };
  }

  /* ------------------------------------------------------------- 历史 */
  let undoStack = [], redoStack = [];
  function snap() {
    return JSON.stringify({ rows: st.rows, frows: st.frows, pal: st.pal, name: st.name, theme: st.theme, drop: st.drop, fTouch: st.fTouch });
  }
  function push() {
    undoStack.push(snap());
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
    st.dirty = true;
  }
  function restore(s) {
    const o = JSON.parse(s);
    st.rows = o.rows; st.frows = o.frows; st.pal = o.pal; st.name = o.name;
    st.theme = o.theme; st.drop = o.drop; st.fTouch = o.fTouch;
    syncFields(); draw(); check();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); }
  function redo() { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); }
  function clearHistory() { undoStack = []; redoStack = []; }

  /* ------------------------------------------------------------- 落笔 */
  function sprFor(ch, x, y) {
    if (st.pal[ch]) return st.pal[ch];
    const t = THEMES[st.theme];
    if (ch === '#') {
      const corner = (x === 0 || x === COLS - 1) && (y === 0 || y === ROWS - 1);
      const edge = (x % 5 === 2 || y % 5 === 2) && (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1);
      return corner || edge ? t.pillar : t.wall;
    }
    if (ch === 'P') return t.pillar;
    if (ch === 'c') return t.crate;
    if (ch === '$') return t.chest;
    if (ch === 's') return 'prop-snowblock';
    if (ch === 'd') return 'prop-snowman';
    return null;
  }
  function floorKey(x, y) { return FLOOR_KEYS[+st.frows[y][x]] || FLOOR_KEYS[THEMES[st.theme].floor]; }

  function putCell(x, y, brush) {
    const b = brush || st.brush;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (b.k === 'erase') {
      if (st.rows[y][x] === '.' && st.frows[y][x] === String(THEMES[st.theme].floor)) return false;
      setCellChar(st.rows, x, y, '.');
      setCellChar(st.frows, x, y, String(THEMES[st.theme].floor));
      return true;
    }
    if (b.k === 'floor') {
      if (st.frows[y][x] === String(b.i)) return false;
      setCellChar(st.frows, x, y, String(b.i));
      st.fTouch = true;
      return true;
    }
    if (b.k === 'spawn') {
      if (st.rows[y][x] === b.ch) return false;
      for (let j = 0; j < ROWS; j++) {
        const at = st.rows[j].indexOf(b.ch);
        if (at >= 0) setCellChar(st.rows, at, j, '.');
      }
      setCellChar(st.rows, x, y, b.ch);
      return true;
    }
    // 物件：顺手把这一类格子的贴图换成当前选的素材
    if (st.rows[y][x] === b.ch && st.pal[b.ch] === b.s) return false;
    st.pal[b.ch] = b.s;
    setCellChar(st.rows, x, y, b.ch);
    return true;
  }

  function cellVal(x, y, floorMode) { return floorMode ? st.frows[y][x] : st.rows[y][x]; }

  function fill(x, y, brush) {
    const b = brush || st.brush;
    const floorMode = b.k === 'floor';
    const from = cellVal(x, y, floorMode);
    // 橡皮：清掉与起点同类的一切
    const target = floorMode ? String(THEMES[st.theme].floor) : '.';
    const bk = { k: floorMode ? 'floor' : 'erase', i: THEMES[st.theme].floor };
    const seen = new Set(), q = [[x, y]];
    seen.add(x + ',' + y);
    let n = 0;
    while (q.length) {
      const [cx, cy] = q.pop();
      if (cellVal(cx, cy, floorMode) !== from) continue;
      if (putCell(cx, cy, b.k === 'erase' ? b : (floorMode ? b : bk))) n++;
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + d[0], ny = cy + d[1];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const key = nx + ',' + ny;
        if (seen.has(key)) continue;
        if (cellVal(nx, ny, floorMode) !== from) continue;
        seen.add(key); q.push([nx, ny]);
      }
    }
    return n;
  }

  function rect(x0, y0, x1, y1, brush) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) putCell(x, y, brush);
  }

  /* ------------------------------------------------------------- 绘制 */
  function draw(hover, sel) {
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const im = IMG[floorKey(x, y)];
        if (im) ctx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
        else { ctx.fillStyle = '#3A2E22'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE); }
      }
    }

    // 实心装饰（雪人）：贴在地上，但它是挡路的
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (st.rows[y][x] !== 'd') continue;
        const im = IMG[sprFor('d', x, y)];
        if (im) ctx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
      }
    }
    // 墙 / 柱 / 可炸物 / 雪块
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = st.rows[y][x];
        if (ch !== '#' && ch !== 'P' && ch !== 'c' && ch !== '$' && ch !== 's') continue;
        const im = IMG[sprFor(ch, x, y)];
        if (im) ctx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
      }
    }

    // 出生点：把两个角色画上去
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = st.rows[y][x];
        if (ch !== '1' && ch !== '2') continue;
        const im = IMG[ch === '1' ? 'zelda-front' : 'link-front'];
        const col = ch === '1' ? '239,201,106' : '76,166,76';
        ctx.strokeStyle = 'rgba(' + col + ',.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x * TILE + 16, y * TILE + 18, 12, 0, Math.PI * 2); ctx.stroke();
        if (im) ctx.drawImage(im, x * TILE, y * TILE, TILE, TILE);
        ctx.fillStyle = 'rgba(' + col + ',1)';
        ctx.font = 'bold 11px ' + '"Cascadia Mono",Consolas,monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ch, x * TILE + 16, y * TILE + 30);
      }
    }

    if (st.grid) {
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.lineWidth = 1 / RS;
      for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, H); ctx.stroke(); }
      for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * TILE); ctx.lineTo(W, y * TILE); ctx.stroke(); }
    }

    if (sel) {
      const x0 = Math.min(sel[0], sel[2]) * TILE, y0 = Math.min(sel[1], sel[3]) * TILE;
      const w0 = (Math.abs(sel[2] - sel[0]) + 1) * TILE, h0 = (Math.abs(sel[3] - sel[1]) + 1) * TILE;
      ctx.strokeStyle = 'rgba(239,201,106,.9)';
      ctx.lineWidth = 2 / RS;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x0 + 1, y0 + 1, w0 - 2, h0 - 2);
      ctx.setLineDash([]);
    }

    if (hover) {
      ctx.strokeStyle = 'rgba(239,201,106,.85)';
      ctx.lineWidth = 2 / RS;
      ctx.strokeRect(hover[0] * TILE + 1, hover[1] * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  /* ------------------------------------------------------------- 校验 */
  function spawnPos(ch) {
    for (let y = 0; y < ROWS; y++) {
      const x = st.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return null;
  }

  function flood(from, passBreak) {
    if (!from) return { n: 0, other: false };
    const seen = new Set(), q = [[from[0], from[1]]];
    seen.add(from[0] + ',' + from[1]);
    const s2 = spawnPos('2');
    let other = false;
    while (q.length) {
      const [x, y] = q.pop();
      if (s2 && x === s2[0] && y === s2[1]) other = true;
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + d[0], ny = y + d[1];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const key = nx + ',' + ny;
        if (seen.has(key)) continue;
        const ch = st.rows[ny][nx];
        if (ch === '#' || ch === 'P' || ch === 'd') continue;   // 雪人是实心装饰，挡路
        if (!passBreak && (ch === 'c' || ch === '$' || ch === 's')) continue;
        seen.add(key); q.push([nx, ny]);
      }
    }
    return { n: seen.size, other: other };
  }

  function analyze() {
    const c = { wall: 0, pillar: 0, crate: 0, chest: 0, push: 0, decor: 0, empty: 0 };
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = st.rows[y][x];
        if (ch === '#') c.wall++;
        else if (ch === 'P') c.pillar++;
        else if (ch === 'c') c.crate++;
        else if (ch === '$') c.chest++;
        else if (ch === 's') c.push++;
        else if (ch === 'd') c.decor++;
        else c.empty++;
      }
    }
    const s1 = spawnPos('1'), s2 = spawnPos('2');
    const loose = flood(s1, true);
    const strict = flood(s1, false);
    const issues = [];
    if (!s1 || !s2) issues.push(['bad', '缺少出生点', '两个出生点都要摆']);
    if (!loose.other) issues.push(['bad', '两人炸开也见不到面', '中间被硬墙/石柱隔死了']);
    else if (!strict.other) issues.push(['warn', '必须先炸开障碍才能相遇', '这样也能玩，节奏更慢']);
    const brk = c.crate + c.chest + c.push;
    if (brk < 10) issues.push(['warn', '可炸障碍偏少（' + brk + '）', '少于 10 个会没什么道具']);
    if (c.empty < 70) issues.push(['warn', '空地偏少', '太空旷或被塞满都不好玩']);
    return { c: c, s1: s1, s2: s2, loose: loose, strict: strict, issues: issues };
  }

  function check() {
    const a = analyze();
    const box = document.getElementById('chkList');
    if (!box) return a;
    const rows = [];
    rows.push(row(a.s1 && a.s2 ? 'ok' : 'bad', '出生点',
      a.s1 && a.s2 ? ('(' + a.s1[0] + ',' + a.s1[1] + ') / (' + a.s2[0] + ',' + a.s2[1] + ')') : '缺失'));
    rows.push(row(a.loose.other ? 'ok' : 'bad', '炸开后连通', a.loose.other ? '能碰面' : '走不到一起'));
    rows.push(row(a.strict.other ? 'ok' : 'warn', '不炸也能走通', a.strict.other ? '是' : '需要炸开'));
    rows.push(row('ok', '硬墙 / 石柱', a.c.wall + ' / ' + a.c.pillar));
    rows.push(row('ok', '可炸 / 宝箱', (a.c.crate + a.c.push) + ' / ' + a.c.chest));
    rows.push(row('ok', '雪块（可推动）', a.c.push));
    rows.push(row('ok', '空地 / 实心装饰', a.c.empty + ' / ' + a.c.decor));
    for (const it of a.issues) rows.push(row(it[0], it[1], it[2]));
    box.innerHTML = rows.join('');
    const badge = document.getElementById('chkBadge');
    if (badge) {
      const bad = a.issues.filter(i => i[0] === 'bad').length;
      badge.textContent = bad ? '有 ' + bad + ' 处必须修' : '可以开玩';
      badge.className = 'crow ' + (bad ? 'warn' : '');
    }
    return a;
  }
  function row(kind, label, val) {
    const col = kind === 'ok' ? '#7FC98A' : kind === 'warn' ? '#E8B04B' : '#D9614F';
    return '<div class="crow' + (kind === 'warn' ? ' warn' : '') + '">'
      + '<i style="background:' + col + '"></i><span>' + label + '</span>'
      + '<b>' + (val == null ? '' : val) + '</b></div>';
  }

  /* ------------------------------------------------------------- 素材栏 */
  function buildPalette() {
    const box = document.getElementById('pal');
    if (!box) return;
    let html = '';
    GROUPS.forEach((g, gi) => {
      html += '<div class="grp"><h4>' + g.t + '</h4><div class="brushes">';
      g.items.forEach((it, ii) => {
        const key = it.s || (it.k === 'floor' ? FLOOR_KEYS[it.i] : null);
        const src = key ? (SPRITES[key] || '') : '';
        const img = it.k === 'erase'
          ? '<div style="width:34px;height:34px;display:grid;place-items:center;font-size:17px;color:#9A8567">✕</div>'
          : '<img src="' + src + '" alt="">';
        html += '<button class="br' + (it.k === 'spawn' ? ' spawn' : '') + '" data-g="' + gi + '" data-i="' + ii
          + '" type="button">' + img + '<span>' + it.n + '</span>' + tagHTML(it.ch) + '</button>';
      });
      html += '</div></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.br').forEach(el => {
      el.onclick = () => {
        st.brush = GROUPS[+el.dataset.g].items[+el.dataset.i];
        paintPalette();
      };
    });
    paintPalette();
  }

  function paintPalette() {
    const box = document.getElementById('pal');
    if (!box) return;
    box.querySelectorAll('.br').forEach(el => {
      const it = GROUPS[+el.dataset.g].items[+el.dataset.i];
      el.classList.toggle('on', it === st.brush);
    });
  }

  /* ------------------------------------------------------------- 工具条 */
  function paintTools() {
    document.querySelectorAll('#tools .seg button[data-tool]').forEach(b => {
      b.classList.toggle('on', b.dataset.tool === st.tool);
    });
    const gb = document.getElementById('btnGrid');
    if (gb) gb.classList.toggle('on', st.grid);
  }

  /* ------------------------------------------------------------- 地图库 */
  function readStore() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (!s) return { v: 1, maps: [] };
      const j = JSON.parse(s);
      if (Array.isArray(j)) return { v: 1, maps: j };
      if (j && Array.isArray(j.maps)) return j;
    } catch (e) { console.warn('读取地图库失败', e); }
    return { v: 1, maps: [] };
  }
  function writeStore(o) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(o)); return true; }
    catch (e) { toast('保存失败：浏览器不让写本地存储', true); return false; }
  }

  function thumb(canvas, raw) {
    const S = 6;
    canvas.width = COLS * S; canvas.height = ROWS * S;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const col = key => {
      const im = IMG[key];
      if (!im || !im.width) return '#3A2E22';
      const c2 = document.createElement('canvas');
      c2.width = im.width; c2.height = im.height;
      const g2 = c2.getContext('2d');
      g2.drawImage(im, 0, 0);
      const d = g2.getImageData(Math.floor(im.width / 2), Math.floor(im.height / 2), 1, 1).data;
      return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
    };
    const themeId = THEMES[raw.theme] ? raw.theme : 'temple';
    const t = THEMES[themeId];
    g.fillStyle = col(FLOOR_KEYS[raw.frows ? +String(raw.frows[0] || '0')[0] : t.floor]);
    g.fillRect(0, 0, canvas.width, canvas.height);
    if (raw.frows) {
      for (let y = 0; y < ROWS; y++) {
        const line = String(raw.frows[y] || '');
        for (let x = 0; x < COLS; x++) {
          const k = FLOOR_KEYS[+line[x]];
          if (!k) continue;
          g.fillStyle = col(k); g.fillRect(x * S, y * S, S, S);
        }
      }
    }
    const pal = raw.pal || {};
    for (let y = 0; y < ROWS; y++) {
      const line = String(raw.rows[y] || '');
      for (let x = 0; x < COLS; x++) {
        const ch = line[x];
        let key = null;
        if (ch === '#') key = pal['#'] || t.wall;
        else if (ch === 'P') key = pal['P'] || t.pillar;
        else if (ch === 'c' || ch === 'o') key = pal['c'] || t.crate;
        else if (ch === '$') key = pal['$'] || t.chest;
        else if (ch === 's') key = pal['s'] || 'prop-snowblock';
        else if (ch === 'd') key = pal['d'] || 'prop-snowman';
        else if (ch === '1' || ch === '2') {
          g.fillStyle = ch === '1' ? '#EFC96A' : '#4CA64C';
          g.fillRect(x * S, y * S, S, S);
          continue;
        }
        if (!key) continue;
        g.fillStyle = col(key); g.fillRect(x * S, y * S, S, S);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x * S, y * S, S, 1);
      }
    }
  }

  function renderLib() {
    const box = document.getElementById('libList');
    if (!box) return;
    const s = readStore();
    let html = '';
    if (!s.maps.length) {
      html += '<div class="empty">还没有保存过地图。<br>画好后点顶栏「保存」，游戏里就能选到它。</div>';
    }
    s.maps.forEach(m => {
      html += '<div class="item' + (m.id === st.id ? ' on' : '') + '" data-id="' + m.id + '">'
        + '<canvas class="mini"></canvas>'
        + '<span class="nm">' + esc(m.name || '未命名') + '<em>' + (THEMES[m.theme] ? THEMES[m.theme].name : '?') + '</em></span>'
        + '<button class="mini-btn" data-act="load">载入</button>'
        + '<button class="mini-btn del" data-act="del">删</button>'
        + '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.item').forEach(el => {
      const id = el.dataset.id;
      const m = s.maps.find(x => x.id === id);
      if (m) thumb(el.querySelector('canvas'), m);
      el.querySelector('[data-act=load]').onclick = () => { openMap(m); draw(); check(); renderLib(); toast('已载入：' + m.name); };
      el.querySelector('[data-act=del]').onclick = () => {
        if (window.confirm('删除「' + (m.name || '未命名') + '」？')) {
          const cur = readStore();
          cur.maps = cur.maps.filter(x => x.id !== id);
          writeStore(cur);
          if (st.id === id) st.id = null;
          renderLib(); toast('已删除');
        }
      };
    });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ------------------------------------------------------------- 保存 */
  function save(asNew) {
    const nameEl = document.getElementById('fName');
    st.name = (nameEl && nameEl.value.trim()) || '我的地图';
    st.name = st.name.slice(0, 18);
    const dropEl = document.getElementById('fDrop');
    if (dropEl) st.drop = +dropEl.value;
    if (nameEl) nameEl.value = st.name;

    if (asNew || !st.id) {
      st.id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    }
    const s = readStore();
    const obj = exportMap();
    obj.id = st.id;
    const i = s.maps.findIndex(m => m.id === st.id);
    if (i >= 0) s.maps[i] = obj; else s.maps.push(obj);
    if (!writeStore(s)) return null;
    st.dirty = false;
    renderLib();
    toast('已保存到本机：' + st.name);
    return st.id;
  }

  /* ------------------------------------------------------------- 生成器 */
  function rnd(n) { return Math.floor(Math.random() * n); }

  function looseReach() {
    const s1 = spawnPos('1'), s2 = spawnPos('2');
    if (!s1 || !s2) return { n: 0, other: false };
    let free = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = st.rows[y][x];
      if (ch !== '#' && ch !== 'P') free++;
    }
    const r = flood(s1, true);
    return { n: r.n, other: r.other, free: free, full: r.n >= free - 1 };
  }

  /* 团块形状：先落一块，再往旁边长，长出来的是成片障碍而不是散点 */
  const BLOB = [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3], [2, 2]];

  function randomize(sym) {
    push();
    const put = (x, y, ch) => {
      if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return false;
      if (st.rows[y][x] !== '.') return false;
      setCellChar(st.rows, x, y, ch);
      return true;
    };
    // 旋转对称的那一格
    const rot = (x, y) => [COLS - 1 - x, ROWS - 1 - y];
    const putPair = (x, y, ch) => {
      if (!put(x, y, ch)) return false;
      const r = rot(x, y);
      put(r[0], r[1], ch);
      return true;
    };

    let best = null, bestN = -1;
    for (let attempt = 0; attempt < 14; attempt++) {
      st.rows = freshRows();
      setCellChar(st.rows, 1, 1, '1');                   // 先把出生点摆好，连通性才查得动
      setCellChar(st.rows, COLS - 2, ROWS - 2, '2');
      const half = (ROWS - 2) / 2;              // 上半张 y = 1..5

      if (sym) {
        /* 180° 中心对称：只生成上半张，再旋转复制，两个出生点条件完全对等 */
        for (let y = 1; y <= half; y++) {
          for (let x = 1; x < COLS - 1; x++) {
            if (x === 1 && y === 1) continue;                 // 出生点留空
            if (Math.random() < 0.28) putPair(x, y, 'c');
          }
        }
        for (let k = 0; k < 9; k++) {                          // 几根柱子做骨架
          const x = 2 + rnd(COLS - 4), y = 1 + rnd(half);
          if (x <= 2 && y <= 2) continue;
          putPair(x, y, 'P');
        }
      } else {
        /* 自由生成：团块 + 每次落子都查连通，断了就回滚 */
        const want = Math.round((COLS - 2) * (ROWS - 2) * 0.28);
        let n = 0, guard = 0;
        while (n < want && guard++ < 4000) {
          const x = 1 + rnd(COLS - 2), y = 1 + rnd(ROWS - 2);
          if (Math.abs(x - 1) + Math.abs(y - 1) <= 2) continue;                 // 出生点周围留空
          if (Math.abs(x - (COLS - 2)) + Math.abs(y - (ROWS - 2)) <= 2) continue;
          const shape = Math.random() < 0.55 ? [[0, 0]] : BLOB;
          const adds = [];
          for (const d of shape) {
            const nx = x + d[0] - 1, ny = y + d[1] - 1;
            if (nx < 1 || ny < 1 || nx >= COLS - 1 || ny >= ROWS - 1) continue;
            if (st.rows[ny][nx] !== '.') continue;
            setCellChar(st.rows, nx, ny, 'c');
            adds.push([nx, ny]);
          }
          const r = looseReach();
          if (!r.other || !r.full) {                                          // 会隔出走不到的角落 -> 撤销这一团
            for (const a of adds) setCellChar(st.rows, a[0], a[1], '.');
          } else n += adds.length;
        }
        // 四角柱丛
        const corners = [[2, 1], [3, 1], [2, 2], [3, 2], [3, 3]];
        for (const c of corners) {
          put(c[0], c[1], 'P'); put(COLS - 1 - c[0], c[1], 'P');
          put(c[0], ROWS - 1 - c[1], 'P'); put(COLS - 1 - c[0], ROWS - 1 - c[1], 'P');
        }
      }

      /* 出生点：清掉周边，对称模式下连旋转的那一格一起清 */
      for (let y = 0; y < ROWS; y++) st.rows[y] = st.rows[y].replace(/[12]/g, '.');
      setCellChar(st.rows, 1, 1, '1');
      setCellChar(st.rows, COLS - 2, ROWS - 2, '2');
      const clearAround = [];
      for (const p of [[1, 1], [COLS - 2, ROWS - 2]]) {
        for (const d of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) {
          const nx = p[0] + d[0], ny = p[1] + d[1];
          if (nx < 1 || ny < 1 || nx >= COLS - 1 || ny >= ROWS - 1) continue;
          clearAround.push([nx, ny]);
          if (sym) clearAround.push(rot(nx, ny));
        }
      }
      for (const c of clearAround) {
        if (c[0] < 1 || c[1] < 1 || c[0] >= COLS - 1 || c[1] >= ROWS - 1) continue;
        const ch = st.rows[c[1]][c[0]];
        if (ch === 'c' || ch === 'P' || ch === '$') setCellChar(st.rows, c[0], c[1], '.');
      }

      /* 挑几个障碍升级成宝箱（必掉道具）；对称模式下成对升 */
      let chest = 0;
      for (let guard = 0; guard < 500 && chest < 6; guard++) {
        const x = 1 + rnd(COLS - 2), y = 1 + rnd(ROWS - 2);
        if (st.rows[y][x] !== 'c') continue;
        if (sym) {
          const r = rot(x, y);
          if (st.rows[r[1]][r[0]] !== 'c') continue;
          setCellChar(st.rows, x, y, '$'); setCellChar(st.rows, r[0], r[1], '$');
          chest += 2;
        } else { setCellChar(st.rows, x, y, '$'); chest++; }
      }

      /* 再挑几个障碍换成雪块（可推动 · 可炸）—— 生成结果里能直接看到新方块 */
      let snow = 0;
      for (let guard = 0; guard < 500 && snow < 4; guard++) {
        const x = 1 + rnd(COLS - 2), y = 1 + rnd(ROWS - 2);
        if (st.rows[y][x] !== 'c') continue;
        if (sym) {
          const r2 = rot(x, y);
          if (st.rows[r2[1]][r2[0]] !== 'c') continue;
          setCellChar(st.rows, x, y, 's'); setCellChar(st.rows, r2[0], r2[1], 's');
          snow += 2;
        } else { setCellChar(st.rows, x, y, 's'); snow++; }
      }

      const r = looseReach();
      const score = (r.other ? 1000 : 0) + r.n;
      if (score > bestN) { bestN = score; best = st.rows.slice(); }
      if (r.other && r.full) { best = st.rows.slice(); break; }
    }

    st.rows = best || st.rows;
    draw(); check(); toast(sym ? '已按中心对称生成' : '已随机生成');
  }

  /* 镜像 = 把「源半边」复制到另一半，画完一半就能得到对称地图。
     （不是把整张图翻过来 —— 那样只是换了方向，还是不对称的） */
  function mirror(mode) {
    push();
    const src = st.rows.slice();
    const halfX = Math.floor(COLS / 2);      // 左半边 x < 10，中间列 x=10 自己跟自己
    const halfY = Math.floor(ROWS / 2);      // 上半边 y < 6
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (mode === 'x' && x >= halfX) continue;
        if ((mode === 'y' || mode === 'o') && y >= halfY) continue;
        const ch = src[y][x];
        if (ch === '1' || ch === '2') continue;                  // 出生点不参与
        const tx = (mode === 'y') ? x : COLS - 1 - x;
        const ty = (mode === 'x') ? y : ROWS - 1 - y;
        if (tx === x && ty === y) continue;
        const tch = src[ty][tx];
        if (tch === '1' || tch === '2') continue;
        setCellChar(st.rows, tx, ty, ch);
      }
    }
    draw(); check();
    toast(mode === 'x' ? '已按左右对称补全' : mode === 'y' ? '已按上下对称补全' : '已按中心对称补全');
  }

  function fillFloor(idx) {
    push();
    st.frows = freshFloors(st.theme);
    if (idx != null) {
      const c = String(idx);
      for (let y = 0; y < ROWS; y++) st.frows[y] = new Array(COLS).fill(c).join('');
    }
    st.fTouch = true;
    draw(); toast('地面已铺满');
  }

  /* ------------------------------------------------------------- 导入导出 */
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function safeName(s) {
    return String(s || 'map').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  }

  function exportJson() {
    const obj = { v: 1, maps: [exportMap()] };
    download(safeName(st.name) + '.json', JSON.stringify(obj, null, 1), 'application/json');
    toast('已导出 JSON');
  }

  function importJson(text) {
    let j = null;
    try { j = JSON.parse(text); } catch (e) { toast('不是合法的 JSON', true); return 0; }
    let arr = Array.isArray(j) ? j : (j && Array.isArray(j.maps) ? j.maps : (j && j.rows ? [j] : null));
    if (!arr) { toast('文件里没有地图', true); return 0; }
    const s = readStore();
    let n = 0;
    for (const m of arr) {
      if (!m || !Array.isArray(m.rows) || m.rows.length !== ROWS) continue;
      let id = m.id || ('u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
      while (s.maps.some(x => x.id === id)) id = 'u_' + Math.random().toString(36).slice(2, 8);
      s.maps.push({
        v: 1, id: id, name: String(m.name || '导入地图').slice(0, 18),
        theme: THEMES[m.theme] ? m.theme : 'temple',
        drop: typeof m.drop === 'number' ? m.drop : 0.4,
        rows: m.rows.map(r => { let t = String(r); while (t.length < COLS) t += '.'; return t.slice(0, COLS); }),
        frows: Array.isArray(m.frows) && m.frows.length === ROWS ? m.frows.map(r => String(r)) : null,
        pal: (m.pal && typeof m.pal === 'object') ? m.pal : {}
      });
      n++;
    }
    if (!n) { toast('没有可用的地图', true); return 0; }
    writeStore(s); renderLib(); toast('导入 ' + n + ' 张地图');
    return n;
  }

  /* 导出一份「烧好这张图」的单文件游戏 */
  function playable() {
    const js = GAME_JS.split(SPRITE_SLOT).join(JSON.stringify(SPRITES));
    let html = GAME_TPL.replace('__CSS__', () => GAME_CSS).replace('__JS__', () => js);
    const obj = exportMap();
    const tag = '<script>window.__QQTANG_MAPS__=' + JSON.stringify([obj])
      + ';window.__QQTANG_PICK__=' + JSON.stringify(obj.id) + ';</' + 'script>';
    html = html.replace('<!--MAPS-->', () => tag);
    /* 导出的单文件旁边没有编辑器，把「地图编辑」按钮摘掉，免得点了扑空 */
    html = html.replace(/[ \t]*<button class="ghost" id="btnEdit">[^<]*<\/button>\s*/, '');
    return html;
  }
  function exportHtml() {
    download('QQTang-' + safeName(st.name) + '.html', playable(), 'text/html');
    toast('已导出可玩网页（双击就能玩）');
  }

  /* ------------------------------------------------------------- 画布交互 */
  let down = null, hover = null, sel = null, lastCell = null;

  function cellAt(e) {
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * COLS);
    const y = Math.floor((e.clientY - r.top) / r.height * ROWS);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return [x, y];
  }

  cv.addEventListener('contextmenu', e => e.preventDefault());

  cv.addEventListener('pointerdown', e => {
    const c = cellAt(e); if (!c) return;
    cv.setPointerCapture(e.pointerId);
    const erase = e.button === 2;
    const brush = erase ? { k: 'erase' } : st.brush;
    if (st.tool === 'fill') {
      push(); fill(c[0], c[1], brush); draw(c); check(); return;
    }
    down = { tool: st.tool, brush: brush, from: c };
    push();
    if (st.tool === 'brush') { putCell(c[0], c[1], brush); lastCell = c; draw(c); check(); }
    else sel = [c[0], c[1], c[0], c[1]];
  });

  cv.addEventListener('pointermove', e => {
    const c = cellAt(e);
    if (!down) { if (hover && c && hover[0] === c[0] && hover[1] === c[1]) return; hover = c; draw(hover, sel); return; }
    hover = c;
    if (down.tool === 'brush') {
      if (c && (!lastCell || lastCell[0] !== c[0] || lastCell[1] !== c[1])) {
        // 拖动时补上中间漏掉的格子
        if (lastCell) {
          const dx = Math.sign(c[0] - lastCell[0]), dy = Math.sign(c[1] - lastCell[1]);
          let lx = lastCell[0], ly = lastCell[1];
          let guard = 0;
          while ((lx !== c[0] || ly !== c[1]) && guard++ < 64) {
            if (lx !== c[0]) lx += dx; else if (ly !== c[1]) ly += dy;
            putCell(lx, ly, down.brush);
          }
        } else putCell(c[0], c[1], down.brush);
        lastCell = c; draw(hover); check();
      }
    } else if (down.tool === 'rect') {
      if (c) sel = [down.from[0], down.from[1], c[0], c[1]];
      draw(hover, sel);
    }
  });

  cv.addEventListener('pointerup', e => {
    if (!down) return;
    if (down.tool === 'rect' && sel) {
      rect(sel[0], sel[1], sel[2], sel[3], down.brush);
      sel = null;
    }
    down = null; lastCell = null;
    draw(hover); check();
  });
  cv.addEventListener('pointerleave', () => { hover = null; draw(hover, sel); });

  /* ------------------------------------------------------------- 字段 */
  function syncFields() {
    const n = document.getElementById('fName');
    if (n) n.value = st.name;
    const t = document.getElementById('fTheme');
    if (t) t.value = st.theme;
    const d = document.getElementById('fDrop');
    if (d) { d.value = st.drop; }
    const dv = document.getElementById('fDropVal');
    if (dv) dv.textContent = Math.round(st.drop * 100) + '%';
  }

  /* ------------------------------------------------------------- 尺寸 */
  function fit() {
    const wrap = document.querySelector('.cwrap');
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const steps = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
    let v = 1;
    for (const s of steps) if (W * s <= r.width - 2 && H * s <= r.height - 2) v = s;
    RS = Math.max(2, Math.min(4, Math.ceil(v)));
    cv.width = Math.round(W * RS); cv.height = Math.round(H * RS);
    cv.style.width = (W * v) + 'px'; cv.style.height = (H * v) + 'px';
    draw(hover, sel);
  }

  let toastT = 0;
  function toast(msg, bad) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('bad', !!bad);
    el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('on'), 2200);
  }

  /* ------------------------------------------------------------- 绑定 */
  function bind() {
    const $ = id => document.getElementById(id);

    $('btnNew').onclick = () => { newMap(st.theme); draw(); check(); renderLib(); toast('新建空白地图'); };
    $('btnSave').onclick = () => save(false);
    $('btnSaveAs').onclick = () => save(true);
    $('btnExport').onclick = exportJson;
    $('btnHtml').onclick = exportHtml;
    $('btnImport').onclick = () => $('fileIn').click();
    $('fileIn').onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => { importJson(String(fr.result)); };
      fr.readAsText(f);
      e.target.value = '';
    };
    $('btnPlay').onclick = () => {
      const a = analyze();
      if (a.issues.some(i => i[0] === 'bad')) { toast('先修好标红的地方再开一局', true); return; }
      const id = save(false);
      if (!id) return;
      // 单文件版开旁边的 QQTang-battle-v1.html；dev 版由构建注入 QQ_GAME_URL 指向 dev/battle/
      window.open((window.QQ_GAME_URL || 'QQTang-battle-v1.html') + '?map=' + encodeURIComponent(id), '_blank');
      toast('已保存，正在打开游戏…（游戏里选地图就能看到它）');
    };

    document.querySelectorAll('#tools .seg button[data-tool]').forEach(b => {
      b.onclick = () => { st.tool = b.dataset.tool; paintTools(); };
    });
    $('btnGrid').onclick = () => { st.grid = !st.grid; paintTools(); draw(hover); };
    $('btnUndo').onclick = () => { undo(); toast('撤销'); };
    $('btnRedo').onclick = () => { redo(); toast('重做'); };

    $('btnRand').onclick = () => randomize(false);
    $('btnSym').onclick = () => randomize(true);
    $('btnMirrorX').onclick = () => mirror('x');
    $('btnMirrorY').onclick = () => mirror('y');
    $('btnMirrorO').onclick = () => mirror('o');
    $('btnClear').onclick = () => {
      push();
      st.rows = freshRows();
      setCellChar(st.rows, 1, 1, '1');
      setCellChar(st.rows, COLS - 2, ROWS - 2, '2');
      draw(); check(); toast('已清空（只剩四周围墙）');
    };
    $('btnFloor').onclick = () => fillFloor(THEMES[st.theme].floor);

    $('fName').oninput = e => { st.name = e.target.value.slice(0, 18); st.dirty = true; };
    $('fTheme').onchange = e => {
      st.theme = e.target.value;
      st.drop = THEMES[st.theme].drop;
      if (!st.fTouch) st.frows = freshFloors(st.theme);
      delete st.pal['#']; delete st.pal['P']; delete st.pal['c']; delete st.pal['$']; delete st.pal['d'];
      syncFields(); draw(); check();
      toast('主题已换成' + THEMES[st.theme].name);
    };
    $('fDrop').oninput = e => { st.drop = +e.target.value; $('fDropVal').textContent = Math.round(st.drop * 100) + '%'; };

    document.querySelectorAll('#tplList button[data-tpl]').forEach(b => {
      b.onclick = () => {
        const raw = BUILTIN[b.dataset.tpl];
        openMap(JSON.parse(JSON.stringify(raw)));
        draw(); check(); renderLib();
        toast('已把「' + raw.name + '」载入为模板，改完另存一张');
      };
    });

    window.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); save(false); return; }
      if (e.code === 'Digit1') { st.tool = 'brush'; paintTools(); }
      if (e.code === 'Digit2') { st.tool = 'rect'; paintTools(); }
      if (e.code === 'Digit3') { st.tool = 'fill'; paintTools(); }
    });

    window.addEventListener('resize', fit);
  }

  /* ------------------------------------------------------------- 启动 */
  function loadSprites() {
    return Promise.all(Object.keys(SPRITES).map(k => new Promise(res => {
      const im = new Image();
      im.onload = () => { IMG[k] = im; res(); };
      im.onerror = () => { console.warn('素材加载失败', k); res(); };
      im.src = SPRITES[k];
    })));
  }

  loadSprites().then(() => {
    buildPalette();
    bind();
    paintTools();
    newMap('temple');
    fit();
    check();
    renderLib();
    document.body.dataset.ready = '1';
  });

  /* ------------------------------------------------------------- 测试钩子 */
  window.__editor = {
    ready: () => document.body.dataset.ready === '1',
    rows: () => st.rows.slice(),
    frows: () => st.frows.slice(),
    pal: () => JSON.parse(JSON.stringify(st.pal)),
    theme: () => st.theme,
    name: () => st.name,
    id: () => st.id,
    /* 直接改一格（ch 为 rows 字符；floor 为地砖下标时只改地面） */
    set: (x, y, ch, floor) => {
      push();
      if (floor != null) setCellChar(st.frows, x, y, String(floor));
      else setCellChar(st.rows, x, y, ch);
      draw(); check();
    },
    brush: (g, i) => { st.brush = GROUPS[g].items[i]; paintPalette(); return st.brush.n; },
    tool: t => { st.tool = t; paintTools(); return st.tool; },
    paint: (x, y) => { push(); putCell(x, y, st.brush); draw(); check(); },
    fill: (x, y) => { push(); return fill(x, y, st.brush); },
    rect: (a, b, c, d) => { push(); rect(a, b, c, d, st.brush); draw(); check(); },
    undo: () => { undo(); return st.rows.slice(); },
    redo: () => { redo(); return st.rows.slice(); },
    analyze: () => analyze(),
    random: sym => { randomize(!!sym); return st.rows.slice(); },
    mirror: m => { mirror(m); return st.rows.slice(); },
    fillFloor: i => { fillFloor(i); },
    open: raw => { openMap(raw); draw(); check(); },
    openBuiltin: k => { openMap(JSON.parse(JSON.stringify(BUILTIN[k]))); draw(); check(); },
    newMap: t => { newMap(t); draw(); check(); },
    save: asNew => save(!!asNew),
    lib: () => readStore().maps.map(m => ({ id: m.id, name: m.name })),
    delAll: () => { writeStore({ v: 1, maps: [] }); renderLib(); },
    json: () => JSON.stringify(exportMap()),
    importJson: t => importJson(t),
    playable: () => playable(),
    paletteCount: () => GROUPS.reduce((n, g) => n + g.items.length, 0),
    floorKeys: () => FLOOR_KEYS.slice(),
    draw: () => draw()
  };
})();
