/* =========================================================================
   QQ糖 · 夺宝对决 — 玩家 + 炮弹口味选择
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 玩家 */
  const KEYMAP = {
    '1': { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: ['Space', 'KeyJ'] },
    '2': { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: ['Enter', 'Numpad0', 'NumpadEnter'] }
  };
  const held = Object.create(null);

  /* ------------------------------------------------------------- 炮弹选择
     每人一份口味：准备页选，局内面板也能随时换 —— 只影响之后放出的弹，
     已经在倒计时的弹不追改。选过就记进 localStorage，下次打开还是自己的口味。 */
  const BOMB_STORE = 'qqtang.bombs.v1';
  const BOMB_DEFAULT = ['candy-bomb', 'bomb-soda'];
  const PICKS = BOMB_DEFAULT.slice();
  try {
    const s = JSON.parse(localStorage.getItem(BOMB_STORE) || 'null');
    if (Array.isArray(s)) for (let i = 0; i < 2; i++) if (KIND_BY_KEY[s[i]]) PICKS[i] = s[i];
  } catch (e) { /* 存档坏了当没存过 */ }

  function setPick(i, key) {
    if (!KIND_BY_KEY[key]) return false;
    PICKS[i] = key;
    const p = state.players[i];
    if (p) p.bombKind = key;
    try { localStorage.setItem(BOMB_STORE, JSON.stringify(PICKS)); } catch (e) { /* 存不了就算了 */ }
    syncBombUI();
    return true;
  }

  /* 选择条：一排糖弹小图，点谁用谁。准备页（覆盖层）和局内面板共用一套标记 */
  function bombStripHTML(pi) {
    return '<div class="bomb-strip" data-p="' + pi + '">' + BOMB_KINDS.map(k =>
      '<button class="bkind' + (PICKS[pi] === k.key ? ' on' : '') + '" data-kind="' + k.key +
      '" title="' + k.name + '糖弹" type="button"><img draggable="false" alt="' + k.name +
      '" src="' + (SPRITES[k.key] || '') + '"></button>').join('') + '</div>';
  }

  /* 选中态同步：面板的选择条是常驻 DOM，覆盖层那条每次 showStart 重建；
     选中框颜色跟着人走（P1 金 / P2 绿），CSS 按 data-p 区分 */
  function syncBombUI() {
    for (let i = 0; i < 2; i++) {
      document.querySelectorAll('#pb' + (i + 1) + ' .bkind, #ov .bomb-strip[data-p="' + i + '"] .bkind')
        .forEach(el => el.classList.toggle('on', el.dataset.kind === PICKS[i]));
    }
  }

  function bindBombStrip(box, pi) {
    if (!box) return;
    box.innerHTML = bombStripHTML(pi);
    box.querySelectorAll('.bkind').forEach(el => {
      el.onclick = () => { setPick(pi, el.dataset.kind); el.blur(); };
    });
  }

  function makePlayer(i) {
    const sp = SPAWNS[i];
    return {
      idx: i,
      sprite: i === 0 ? 'zelda' : 'link',
      name: i === 0 ? '塞尔达' : '林克',
      x: sp.x, y: sp.y,                       // 出生格（只用于开局/测试对照）
      wx: sp.x * TILE, wy: sp.y * TILE,       // 身体左上角的世界像素坐标
      dir: i === 0 ? 'down' : 'up',
      moving: false, walkT: 0, pushT: 0,       // pushT：顶着雪块按方向的累计时长
      alive: true, dying: false, dieT: 0,
      power: 1, maxBombs: 1, bombsOut: 0, spd: 1,
      bombKind: KIND_BY_KEY[PICKS[i]] ? PICKS[i] : BOMB_DEFAULT[0],
      wins: 0, lastDir: '',
      isAI: state.mode === 'pve' && i === 1,   // 人机模式：P2 交给 AI
      aiDir: '', aiTimer: 0, aiPlan: null,
      key: KEYMAP[String(i + 1)]
    };
  }

  function readDir(p) {
    if (p.isAI) return p.aiDir || '';        // AI 走自己的决策通道，不读键盘
    const k = p.key;
    if (p.lastDir && held[k[p.lastDir]]) return p.lastDir;
    if (held[k.up]) return 'up';
    if (held[k.down]) return 'down';
    if (held[k.left]) return 'left';
    if (held[k.right]) return 'right';
    return '';
  }

  function bombAt(x, y) {
    for (const b of state.bombs) if (!b.dead && b.x === x && b.y === y) return b;
    return null;
  }

