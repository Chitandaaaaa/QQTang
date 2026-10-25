/* =========================================================================
   QQ糖 · 夺宝对决 — 爆炸
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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

