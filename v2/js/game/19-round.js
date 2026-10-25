/* =========================================================================
   QQ糖 · 夺宝对决 — 换图 + 开局
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 换图 */
  function updateMapBtn() {
    const b = $('btnMap');
    if (b) b.textContent = '地图 · ' + theme().name;
  }

  function switchMap(dir) {
    const wasReady = state.phase !== 'play';   // 开局前换图，换完还留在准备页
    state.mapIdx = (state.mapIdx + (dir || 1) + MAPS.length) % MAPS.length;
    state.players.forEach(p => p.wins = 0);    // 换图=换关卡，比分重算
    startRound();
    updateMapBtn();
    if (wasReady) showStart();
  }

  /* ------------------------------------------------------------- 开局 */
  function startRound() {
    state.tiles = parseMap();
    state.bombs = [];
    state.flames = [];
    state.powerups = [];
    state.parts = [];
    state.pushAnims = [];
    state.overTimer = -1;
    state.shake = 0;
    state.flash = 0;
    state.time = 0;

    const wins = state.players.length ? state.players.map(p => p.wins) : [0, 0];
    state.players = [makePlayer(0), makePlayer(1)];
    state.players[0].wins = wins[0] || 0;
    state.players[1].wins = wins[1] || 0;

    bakeBg(state.tiles);
    syncHUD(true);
    state.players.forEach(p => { const c = $('pc' + (p.idx + 1)); if (c) c.classList.remove('dead', 'win'); });
    hideOverlay();
    applyModeUI();
    state.phase = 'play';
    state.flash = 0.35;
  }

