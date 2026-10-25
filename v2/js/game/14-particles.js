/* =========================================================================
   QQ糖 · 夺宝对决 — 粒子
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 粒子 */
  function burst(x, y, n, colors, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.9);
      state.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        life: 0.4 + Math.random() * 0.5, max: 0.9,
        size: 1 + Math.random() * 2,
        color: colors[(Math.random() * colors.length) | 0],
        g: 260
      });
    }
  }
  function puff(x, y, n, color, sp) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      state.parts.push({
        x, y, vx: Math.cos(a) * 30 * (Math.random() + .4), vy: Math.sin(a) * 30,
        life: 0.3 + Math.random() * 0.3, max: 0.6,
        size: 1 + Math.random() * 2, color, g: -20
      });
    }
  }

