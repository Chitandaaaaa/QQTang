/* =========================================================================
   QQ糖 · 夺宝对决 — 更新
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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

