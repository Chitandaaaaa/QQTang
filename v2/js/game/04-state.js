/* =========================================================================
   QQ糖 · 夺宝对决 — 全局状态
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 状态 */
  const state = {
    phase: 'ready',   // ready | play | over
    mode: 'pve',      // pve（人机对战，P2 由 AI 托管）| pvp（双人对战）
    mapIdx: 0,        // 当前地图（MAPS 下标）
    time: 0,
    tiles: [],
    bombs: [], flames: [], powerups: [], parts: [],
    pushAnims: [],    // 正在滑入新格子的雪块（纯视觉）
    players: [],
    shake: 0, flash: 0,
    overTimer: -1,
    muted: false,
    aiBombs: 0        // AI 累计放过的糖弹数（测试用）
  };

  let SPAWNS = [];

