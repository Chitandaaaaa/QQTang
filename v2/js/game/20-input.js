/* =========================================================================
   QQ糖 · 夺宝对决 — 输入
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 输入 */
  const BOMB_CODES = ['Space', 'KeyJ', 'Enter', 'Numpad0', 'NumpadEnter'];
  window.addEventListener('keydown', e => {
    if (window.isEditorMode && window.isEditorMode()) return;   // 编辑器模式：键盘不进游戏
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
  window.addEventListener('keyup', e => {
    if (window.isEditorMode && window.isEditorMode()) return;
    held[e.code] = false;
  });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

