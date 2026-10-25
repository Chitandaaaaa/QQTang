/* =========================================================================
   QQ糖 · 夺宝对决 — 推雪块
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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

