/* =========================================================================
   QQ糖 · 夺宝对决 — 死亡
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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

