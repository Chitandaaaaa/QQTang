/* =========================================================================
   QQ糖 · 夺宝对决 — HUD
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

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

