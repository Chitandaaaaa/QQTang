/* =========================================================================
   QQ糖 · 夺宝对决 — 主循环 + 尺寸
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 循环 */
  const FIXED = 1 / 120;
  let acc = 0, last = 0, paused = false;
  function loop(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.2) dt = 0.2;
    if (paused) { acc = 0; render(); syncHUD(false); requestAnimationFrame(loop); return; }
    acc += dt;
    let guard = 0;
    while (acc >= FIXED && guard++ < 12) { step(FIXED); acc -= FIXED; }
    render();
    syncHUD(false);
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------- 尺寸 */
  /* 按整数 / 半整数档放大，避免像素宽窄不均；再大就超出素材颗粒感了 */
  function applyView(v) {
    v = Math.max(1, Math.min(2, v));
    const w = Math.round(W * v), h = Math.round(H * v);
    if (v === SCALE && cv.style.width === w + 'px') return;
    SCALE = v;
    RS = v * BASE_DPR;
    cv.width = Math.round(W * RS);
    cv.height = Math.round(H * RS);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (state.tiles.length) { bakeBg(state.tiles); render(); syncHUD(false); }
  }

  function fitCanvas() {
    const mainEl = document.querySelector('main');
    const railEl = document.getElementById('rail');
    if (!mainEl) return;
    // 窄屏交给 CSS（侧栏转为横排），内联尺寸会和媒体查询打架
    if (window.innerWidth <= 1180) {
      if (cv.style.width) {
        cv.style.width = ''; cv.style.height = '';
        ctx.setTransform(RS, 0, 0, RS, 0, 0);
      }
      return;
    }
    const mr = mainEl.getBoundingClientRect();
    const rw = railEl ? railEl.getBoundingClientRect().width : 0;
    const availW = mr.width - rw - 18 - 8;   // gap + 余量（舞台已无边框内边距）
    const availH = mr.height - 8;
    if (availW < 200 || availH < 120) return;
    const raw = Math.min(availW / W, availH / H);
    let v = 1;
    for (const s of SCALE_STEPS) if (s <= raw + 0.002) v = s;
    applyView(v);
  }

