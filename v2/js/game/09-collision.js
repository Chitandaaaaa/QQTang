/* =========================================================================
   QQ糖 · 夺宝对决 — 碰撞
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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

