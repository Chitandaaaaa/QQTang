/* =========================================================================
   QQ糖 · 夺宝对决 — 渲染
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 渲染 */
  const VIEW = { up: 'back', down: 'front', left: 'side', right: 'side' };

  function drawShadow(cx, cy, rx, ry, a) {
    ctx.globalAlpha = a == null ? 0.26 : a;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* 人物规格：素材 32×48 —— 整格宽、一格半高。
     碰撞体仍是一整格 32×32（能不能过、会不会被炸到都只看这一格），
     多出来的半格全在头顶：精灵底边对齐脚底，头就自然探进上面那一格。
     于是头顶可以压在上面的围墙上，看着是站在墙前面，而不是贴在墙上的贴纸。 */
  const CHAR_W = 32, CHAR_H = 48;
  const HEAD_OVER = CHAR_H - TILE;      // 16：露在自己碰撞格之外的那半格

  function drawChar(p) {
    const key = p.sprite + '-' + (VIEW[p.dir] || 'front');
    const im = IMG[key];
    if (!im) return;
    const x = Math.round(p.wx);
    const y = Math.round(p.wy);
    const footY = y + TILE;             // 脚底 = 碰撞格下沿
    const topY = footY - CHAR_H;        // 头顶伸到上一格去了（y - 16）
    // 步态：以脚底为轴压扁一点点，绝不顶出格子
    const bounce = p.moving ? Math.abs(Math.sin(p.walkT * 13)) * 0.045 : 0;

    drawShadow(x + TILE / 2, footY - 1.5, p.alive ? 10 : 8, 3.4, p.alive ? 0.28 : 0.12);

    ctx.save();
    if (bounce > 0) {
      ctx.translate(x + TILE / 2, footY);
      ctx.scale(1, 1 - bounce);
      ctx.translate(-(x + TILE / 2), -footY);
    }
    if (p.dir === 'left') { ctx.translate(x + TILE, topY); ctx.scale(-1, 1); }
    else ctx.translate(x, topY);

    if (!p.alive) {
      const k = clamp(p.dieT / 0.9, 0, 1);
      ctx.globalAlpha = Math.max(0, 1 - k * 1.15) * (k > 0.4 ? (Math.sin(p.dieT * 40) > 0 ? 1 : .4) : 1);
      ctx.translate(16, CHAR_H);
      ctx.scale(1 - k * 0.18, 1 - k * 0.62);
      ctx.rotate(k * 0.12);
      ctx.translate(-16, -CHAR_H);
    }
    ctx.drawImage(im, 0, 0, CHAR_W, CHAR_H);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBomb(b) {
    const im = IMG[b.kind] || IMG['bomb'];
    if (!im) return;
    const cx = b.x * TILE + 16, cy = b.y * TILE + 16;
    const t = 1 - b.fuseLeft / FUSE;
    const urgent = t > 0.68;
    /* 素材本身就是整格 32×32，外接圆正好和格子四边相切。
       所以呼吸只允许「缩」，绝不放出去 —— 一放大就压到隔壁格了。 */
    const k = 0.5 + 0.5 * Math.sin(state.time * (urgent ? 34 : 14));
    const s = TILE * (1 - k * (urgent ? 0.05 : 0.025));

    drawShadow(cx, b.y * TILE + TILE - 2, 12, 3.4, 0.3);

    if (urgent) {
      const r = 16 + Math.sin(state.time * 30) * 1.5;
      ctx.globalAlpha = 0.42 + Math.sin(state.time * 30) * 0.16;
      ctx.strokeStyle = '#FF5A3C';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(im, cx - s / 2, cy - s / 2, s, s);

    // 引线火星（贴在球的右上边缘）
    const f = Math.floor(state.time * 18) % 3;
    ctx.fillStyle = f === 0 ? '#FFF3C4' : (f === 1 ? '#FFB347' : '#E8562A');
    const ang = -Math.PI / 4 + (f - 1) * 0.12;
    ctx.fillRect(cx + Math.cos(ang) * 13 - 1, cy + Math.sin(ang) * 13 - 1, 2, 2);
  }

  /* 道具：直接画素材（32×32），底下垫一圈同色光晕 */
  const ITEM_IMG = { power: 'prop-power', bomb: 'prop-bombs', speed: 'prop-speed' };
  const ITEM_GLOW = { power: '255,166,206', bomb: '143,216,245', speed: '186,205,255' };

  function drawPowerup(pu) {
    const cx = pu.x * TILE + TILE / 2;
    const cy = pu.y * TILE + TILE / 2 + Math.sin(state.time * 3 + pu.x) * 1.6;
    const glow = ITEM_GLOW[pu.kind] || '255,222,150';

    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 17);
    g.addColorStop(0, 'rgba(' + glow + ',.42)');
    g.addColorStop(1, 'rgba(' + glow + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 17, cy - 17, 34, 34);

    const im = IMG[ITEM_IMG[pu.kind] || 'prop-power'];
    if (im) {
      ctx.drawImage(im, Math.round(cx) - 16, Math.round(cy) - 16, TILE, TILE);
    } else {
      ctx.fillStyle = '#EFC96A';
      ctx.fillRect(cx - 8, cy - 8, 16, 16);
    }
  }

  /* 障碍物贴图就是 32×32，直接整格铺（按当前主题选图）。
     slideAnim：这块刚被推过 —— 从原来的格子滑过来（纯视觉偏移）。 */
  function drawObstacle(x, y, v, slideAnim) {
    const th = theme();
    let key = null;
    if (v === CRATE) key = th.crate;
    else if (v === AMPHORA) key = th.urn;
    else if (v === CHEST) key = th.chest;
    else if (v === PUSH) key = PUSH_SPRITE;        // 雪块：自定义地图可以换贴图
    if (!key) return;
    const own = SPRITE_GRID[y] && SPRITE_GRID[y][x];
    if (own && IMG[own]) key = own;
    const im = IMG[key];
    if (!im) return;
    let px = x * TILE, py = y * TILE;
    if (slideAnim) {
      const k = 1 - slideAnim.t / PUSH_ANIM;       // 0 -> 1
      const ease = 1 - (1 - k) * (1 - k);          // easeOut：出手快，收尾稳
      px -= slideAnim.dx * (1 - ease) * TILE;
      py -= slideAnim.dy * (1 - ease) * TILE;
    }
    ctx.drawImage(im, Math.round(px), Math.round(py), TILE, TILE);
  }

  /* 火焰：直接用「爆炸格」素材铺格。
     相邻格有火就往那侧多顶 1px，几格连起来就是一片，不会露出格缝。 */
  function drawFlames() {
    if (!state.flames.length) return;
    const map = new Map();
    for (const f of state.flames) map.set(f.x + ',' + f.y, f);

    for (const f of state.flames) {
      const im = IMG[f.cell || 'boom-cell'];
      const life = clamp(f.life / FLAME_LIFE, 0, 1);
      const fade = Math.min(1, life * 2.4);
      const x0 = f.x * TILE, y0 = f.y * TILE;
      const up = map.has(f.x + ',' + (f.y - 1)), dn = map.has(f.x + ',' + (f.y + 1));
      const lf = map.has((f.x - 1) + ',' + f.y), rt = map.has((f.x + 1) + ',' + f.y);
      const ax = x0 - (lf ? 1 : 0), ay = y0 - (up ? 1 : 0);
      const bx = x0 + TILE + (rt ? 1 : 0), by = y0 + TILE + (dn ? 1 : 0);
      const w = bx - ax, h = by - ay;

      // 外扩的光晕（压住地砖，火才有存在感；颜色跟炮弹口味走）
      ctx.globalAlpha = fade * 0.5;
      ctx.fillStyle = 'rgba(' + (f.glow || '40,120,240') + ',.55)';
      ctx.fillRect(ax - 1, ay - 1, w + 2, h + 2);

      ctx.globalAlpha = fade;
      if (im) ctx.drawImage(im, ax, ay, w, h);
      else { ctx.fillStyle = '#1E7CF0'; ctx.fillRect(ax, ay, w, h); }

      // 刚炸开那一下的白闪
      if (life > 0.78) {
        ctx.globalAlpha = (life - 0.78) / 0.22 * 0.8;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x0 + 5, y0 + 5, TILE - 10, TILE - 10);
      }
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (state.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    ctx.drawImage(bg, 0, 0, W, H);

    // 道具
    for (const pu of state.powerups) drawPowerup(pu);

    /* 障碍 + 糖弹按 y 排序做前后遮挡；角色不参与排序，一律画在最上层 ——
       头要比围墙高半格，若还按 y 排序就会被上面的墙茬切掉。 */
    const list = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = state.tiles[y][x];
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH)
          list.push({ y: y * TILE + TILE, kind: 'o', x, yy: y, v });
      }
    }
    for (const b of state.bombs) list.push({ y: b.y * TILE + 22, kind: 'b', b });
    list.sort((a, b) => a.y - b.y);

    const pushing = new Map();                     // 正在被推的雪块按格查偏移
    for (const a of state.pushAnims) pushing.set(a.x + ',' + a.y, a);
    for (const it of list) {
      if (it.kind === 'o') drawObstacle(it.x, it.yy, it.v, pushing.get(it.x + ',' + it.yy));
      else drawBomb(it.b);
    }

    // 最上层：两个角色之间仍按下沿排序，谁在下谁在前
    state.players.slice().sort((a, b) => a.wy - b.wy).forEach(drawChar);

    drawFlames();

    // 粒子
    for (const q of state.parts) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x | 0, q.y | 0, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (state.flash > 0.005) {
      ctx.fillStyle = 'rgba(255,240,200,' + state.flash.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

