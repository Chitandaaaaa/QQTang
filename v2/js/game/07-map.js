/* =========================================================================
   QQ糖 · 夺宝对决 — 地图数据与解析
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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

