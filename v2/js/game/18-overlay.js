/* =========================================================================
   QQ糖 · 夺宝对决 — 模式 UI + 覆盖层（准备页 / 结算页）
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 模式 UI
     人机模式（pve）下，把 P2 那张卡标成「AI 托管」，藏掉人类按键提示。 */
  function applyModeUI() {
    const card = $('pc2'), badge = $('ai2'), keys = $('keys2');
    if (!card) return;
    const ai = state.mode === 'pve';
    card.classList.toggle('ai', ai);
    if (badge) badge.hidden = !ai;
    if (keys) keys.style.display = ai ? 'none' : '';
  }

  /* ------------------------------------------------------------- 覆盖层 */
  const ov = $('ov');
  let mapsScroll = 0;   // 选图条的滚动位置，showStart 重绘时恢复
  let mapsTimer = 0;    // 选图条状态轮询（rAF 在后台内嵌页里会被挂起，不能靠它）

  /* 选图条箭头状态 + 滚动位置记忆：showStart 起一个轻量轮询，
     离开准备页自动停；不依赖 scroll 事件（内嵌浏览器里可能不触发） */
  function syncMapsNav() {
    const wrap = ov.querySelector('.ov-maps-wrap');
    if (!wrap) return;
    const strip = wrap.querySelector('.ov-maps');
    const prev = wrap.querySelector('.maps-nav.prev');
    const next = wrap.querySelector('.maps-nav.next');
    mapsScroll = strip.scrollLeft;
    const max = strip.scrollWidth - strip.clientWidth;
    wrap.classList.toggle('paged', strip.scrollWidth > strip.clientWidth + 4);
    prev.disabled = mapsScroll <= 2;
    next.disabled = mapsScroll >= max - 2;
  }

  function startMapsSync() {
    clearInterval(mapsTimer);
    mapsTimer = setInterval(() => {
      if (state.phase !== 'ready' || !ov.querySelector('.ov-maps-wrap')) {
        clearInterval(mapsTimer);
        return;
      }
      syncMapsNav();
    }, 200);
  }

  /* 地图缩略图：色值直接从贴图中心采样，换主题不会脱节 */
  const MINI_COL = {};
  function spriteCol(key, dx, dy) {
    const k = key + ':' + dx + ',' + dy;
    if (MINI_COL[k]) return MINI_COL[k];
    let col = '#3A2A1C';
    const im = IMG[key];
    if (im) {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const g2 = c.getContext('2d');
      g2.drawImage(im, 0, 0, 32, 32);
      const d = g2.getImageData(dx, dy, 1, 1).data;
      if (d[3] > 40) col = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
    }
    MINI_COL[k] = col;
    return col;
  }

  function parseRows(map) {
    const rows = map.rows, t = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const ch = rows[y][x];
        row.push(ch === '#' ? WALL : ch === 'P' ? PILLAR : ch === 'c' ? CRATE
          : ch === 'o' ? AMPHORA : ch === '$' ? CHEST : ch === 's' ? PUSH
            : ch === 'd' ? DECOR : EMPTY);
      }
      t.push(row);
    }
    return t;
  }

  function drawMini(canvas, map) {
    const t = parseRows(map);
    const S = 6;                       // 每格 6px -> 126×72
    canvas.width = COLS * S;
    canvas.height = ROWS * S;
    const g2 = canvas.getContext('2d');
    g2.imageSmoothingEnabled = false;
    g2.fillStyle = spriteCol(map.floor.base, 16, 16);
    g2.fillRect(0, 0, canvas.width, canvas.height);

    // 自定义地图手绘的地面层
    if (map.frows) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const k = FLOOR_KEYS[+map.frows[y][x]];
          if (!k) continue;
          g2.fillStyle = spriteCol(k, 16, 16);
          g2.fillRect(x * S, y * S, S, S);
        }
      }
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = t[y][x];
        const ch = map.rows[y][x];
        const own = map.pal && typeof map.pal[ch] === 'string' ? map.pal[ch] : null;
        let col = null;
        if (v === WALL) col = spriteCol(own || map.wall, 16, 16);
        else if (v === PILLAR) col = spriteCol(own || map.pillar, 16, 16);
        else if (v === CRATE) col = spriteCol(own || map.crate, 16, 16);
        else if (v === AMPHORA) col = spriteCol(own || map.urn, 16, 16);
        else if (v === CHEST) col = spriteCol(own || map.chest, 16, 16);
        else if (v === PUSH) col = spriteCol(own || PUSH_SPRITE, 16, 16);
        else if (v === DECOR) col = spriteCol(own || map.decor || 'prop-snowman', 16, 16);
        if (!col) continue;
        g2.fillStyle = col;
        g2.fillRect(x * S, y * S, S, S);
        if (v !== CHEST) {             // 顶面提亮一线，缩略图才不糊成色块
          g2.fillStyle = 'rgba(255,255,255,.18)';
          g2.fillRect(x * S, y * S, S, 1);
        }
      }
    }
    // 出生点
    map.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch !== '1' && ch !== '2') continue;
        g2.fillStyle = ch === '1' ? '#EFC96A' : '#4CA64C';
        g2.fillRect(x * S, y * S, S, S);
      }
    });
  }

  /* 在准备页里换图：不离开准备页，只把画布和文案一起换掉 */
  function pickMap(i) {
    if (i === state.mapIdx) return;
    state.mapIdx = i;
    state.tiles = parseMap();
    state.players = [makePlayer(0), makePlayer(1)];
    state.bombs = []; state.flames = []; state.powerups = []; state.parts = [];
    state.pushAnims = [];
    state.time = 0; state.overTimer = -1; state.shake = 0; state.flash = 0;
    bakeBg(state.tiles);
    syncHUD(true);
    updateMapBtn();
    showStart();
    render();
  }

  function showStart() {
    state.phase = 'ready';
    ov.innerHTML = `
      <div class="ov-box">
        <div class="ov-modes">
          <button class="mode-btn${state.mode === 'pve' ? ' on' : ''}" data-mode="pve" type="button">人机对战</button>
          <button class="mode-btn${state.mode === 'pvp' ? ' on' : ''}" data-mode="pvp" type="button">双人对战</button>
        </div>
        <div class="ov-labelrow">
          <span class="ov-label">选择地图</span>
          <span class="ov-count">${MAPS.length} 张</span>
        </div>
        <div class="ov-maps-wrap">
          <button class="maps-nav prev" type="button" aria-label="上一页">‹</button>
          <div class="ov-maps">
            ${MAPS.map((m, i) => `
            <button class="map-card${i === state.mapIdx ? ' on' : ''}" data-map="${i}" type="button">
              <span class="tick">已选</span>
              ${m.custom ? '<span class="flag">自定义</span>' : ''}
              <span class="thumb"><canvas></canvas></span>
              <span class="nm"><b>${m.name}</b><i>${m.sub}</i></span>
            </button>`).join('')}
          </div>
          <button class="maps-nav next" type="button" aria-label="下一页">›</button>
        </div>
        <div class="ov-grid">
          <div class="ov-cell p1">
            <h4><span class="dot" style="color:#EFC96A"></span>玩家 1 · 塞尔达</h4>
            ${bombStripHTML(0)}
            <div class="kline"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><i>移动</i></div>
            <div class="kline"><kbd class="space">空格</kbd><i>放糖弹</i></div>
          </div>
          <div class="ov-cell p2">
            <h4><span class="dot" style="color:#4CA64C"></span>${state.mode === 'pve' ? '玩家 2 · 林克（AI）' : '玩家 2 · 林克'}</h4>
            ${bombStripHTML(1)}
            ${state.mode === 'pve'
              ? '<div class="kline"><i>由 AI 托管 · 自动走位与放弹</i></div>'
              : '<div class="kline"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><i>移动</i></div><div class="kline"><kbd class="wide">回车</kbd><i>放糖弹</i></div>'}
          </div>
        </div>
        <button class="btn" id="btnStart">开始对战</button>
      </div>`;
    ov.classList.add('on');

    ov.querySelectorAll('.map-card').forEach(el => {
      const i = +el.dataset.map;
      drawMini(el.querySelector('canvas'), MAPS[i]);
      el.onclick = () => pickMap(i);
    });

    /* 选图条翻页：图多到放不下才出现箭头。箭头状态与滚动位置的记忆
       交给 startMapsSync 的轮询（scroll 事件 / rAF 在内嵌浏览器里都不可靠）；
       翻页用瞬时滚动 + scroll-snap 落格，平滑滚动会被吸附打断 */
    const wrap = ov.querySelector('.ov-maps-wrap');
    if (wrap) {
      const strip = wrap.querySelector('.ov-maps');
      wrap.querySelector('.maps-nav.prev').onclick =
        () => strip.scrollBy({ left: -(strip.clientWidth - 30) });
      wrap.querySelector('.maps-nav.next').onclick =
        () => strip.scrollBy({ left: strip.clientWidth - 30 });
      strip.scrollLeft = mapsScroll;
      syncMapsNav();
      startMapsSync();
    }

    ov.querySelectorAll('.mode-btn').forEach(el => {
      el.onclick = () => { state.mode = el.dataset.mode; applyModeUI(); showStart(); };
    });

    /* 炮弹选择条：点谁用谁，选中框当场挪过去（不整页重绘，选图条不闪） */
    ov.querySelectorAll('.bomb-strip').forEach(strip => {
      const pi = +strip.dataset.p;
      strip.querySelectorAll('.bkind').forEach(el => {
        el.onclick = () => { setPick(pi, el.dataset.kind); el.blur(); };
      });
    });

    applyModeUI();
    const btn = $('btnStart');
    if (btn) btn.onclick = () => { audio(); startRound(); };
  }

  function showResult(winner) {
    const isChamp = winner && winner.wins >= WIN_ROUND;
    const face = winner ? SPRITES[winner.sprite + '-front'] : '';
    const title = !winner ? '同归于尽' : (isChamp ? winner.name + ' 夺冠！' : winner.name + ' 获胜');
    const sub = !winner
      ? '两颗糖弹同时开花，谁都别想活着走出去。'
      : (isChamp ? `连下 ${WIN_ROUND} 城，遗迹归 ${winner.name} 所有。`
        : `第 ${state.players[0].wins + state.players[1].wins} 局结束 · 再赢 ${WIN_ROUND - winner.wins} 局夺冠`);
    ov.innerHTML = `
      <div class="ov-box">
        <div class="ov-kicker">ROUND OVER</div>
        ${face ? `<img class="result-face" src="${face}" alt="">` : ''}
        <div class="ov-title" style="color:${winner && winner.idx === 1 ? '#9BE08F' : '#FFF3D2'}">${title}</div>
        <div class="ov-sub">${sub}</div>
        <button class="btn" id="btnNext">${isChamp ? '重新开始' : '下一局'}</button>
        <div style="margin-top:12px; font-size:10.5px; color:#6E5B44; letter-spacing:.1em">按 空格 / 回车 也可以继续</div>
      </div>`;
    ov.classList.add('on');
    const btn = $('btnNext');
    if (btn) btn.onclick = () => {
      if (isChamp) state.players.forEach(p => p.wins = 0);
      startRound();
    };
  }

  function hideOverlay() { ov.classList.remove('on'); }

