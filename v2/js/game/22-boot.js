/* =========================================================================
   QQ糖 · 夺宝对决 — 启动 + 测试钩子
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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
    if (eb) eb.onclick = () => {
      window.pageMode(document.body.dataset.mode === 'editor' ? 'game' : 'editor');
    };
    const snd = $('btnSound');
    if (snd) snd.onclick = () => {
      state.muted = !state.muted;
      snd.textContent = state.muted ? '音效 关' : '音效 开';
      if (!state.muted) { audio(); tone(880, .08, 'triangle', .05); }
    };
    const gal = $('btnGallery');
    if (gal) gal.onclick = () => { window.open('gallery.html', '_blank'); };   // 新标签页，不打断对局
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
