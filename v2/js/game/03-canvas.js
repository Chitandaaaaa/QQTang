/* =========================================================================
   QQ糖 · 夺宝对决 — 画布
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 画布 */
  /* 逻辑坐标永远是 W×H（672×384），内部像素按「视图倍率 × 设备像素比」放大，
     这样画布可以随窗口变大而变清晰，而不是把 672 宽的位图硬拉大。 */
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const BASE_DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const SCALE_STEPS = [1, 1.25, 1.5, 1.75, 2];
  let SCALE = 1, RS = BASE_DPR;
  cv.width = Math.round(W * RS);
  cv.height = Math.round(H * RS);
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const IMG = {};
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  const bx = bg.getContext('2d');
  bx.imageSmoothingEnabled = false;

