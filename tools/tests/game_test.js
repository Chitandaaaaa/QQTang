(async function () {
  const out = { ok: [], bad: [], logs: {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const eq = (name, got, want) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    (g === w ? out.ok : out.bad).push(name + (g === w ? '' : '  got=' + g + ' want=' + w));
  };
  const truth = (name, cond, extra) => {
    (cond ? out.ok : out.bad).push(name + (cond ? '' : '  ' + JSON.stringify(extra)));
  };
  const near = (name, got, want, tol) => {
    const ok = Math.abs(got - want) <= tol;
    (ok ? out.ok : out.bad).push(name + (ok ? '' : '  got=' + got + ' want≈' + want + '±' + tol));
  };

  for (let i = 0; i < 500 && !document.getElementById('btnStart'); i++) await sleep(10);
  const G = window.__game;
  if (!G) {
    out.bad.push('页面没有初始化 __game');
    document.body.setAttribute('data-diag', JSON.stringify(out));
    return;
  }
  if (G.setMode) G.setMode('pvp');   // 回归测试固定双人模式，避免 AI 干扰断言

  try {
    G.pause(true);
    const K = G.consts;
    const T = K.TILE;
    const W0 = K.TILE * K.COLS;
    const FRAME = K.FIXED;
    const p0 = () => G.snap().players[0];
    const p1 = () => G.snap().players[1];
    const fuseFrames = Math.ceil(K.FUSE / FRAME) + 200;
    const stepSec = s => G.step(Math.round(s / FRAME));
    const tap = (code, secs) => {
      G.key(code, true); stepSec(secs == null ? 0.03 : secs); G.key(code, false);
    };

    /* ================ A 一格=一格：贴图 32×32 + 整格碰撞体 ================ */
    G.start();
    const SPAWN0 = [1, 1], SPAWN1 = [K.COLS - 2, K.ROWS - 2];
    const s0 = G.snap();
    eq('A0a 一方出生格子', p0().cell, SPAWN0);
    eq('A0b 另一方出生格子', p1().cell, SPAWN1);
    /* 人物：整格宽、一格半高 —— 上面那半格（头部）是刻意探出碰撞格的 */
    eq('A0c 人物贴图 32×48（整格宽、一格半高）',
      G.sprite('zelda-front'), [T, T * 1.5]);
    eq('A0d 侧/背向同样 32×48', [G.sprite('zelda-side'), G.sprite('link-back')],
      [[T, T * 1.5], [T, T * 1.5]]);
    eq('A0e 三件道具贴图都是 32×32',
      [G.sprite('prop-power'), G.sprite('prop-bombs'), G.sprite('prop-speed')],
      [[T, T], [T, T], [T, T]]);
    eq('A0f 爆炸格贴图 32×32', G.sprite('boom-cell'), [T, T]);
    eq('A0h 地图 21×12 格', [K.COLS, K.ROWS], [21, 12]);
    eq('A0i 糖弹撑满整格（不透明像素四边相切）', G.spriteBox('bomb'), [0, 0, 31, 31]);
    const box = k => G.spriteBox(k) || [];
    const inCell = k => {
      const b2 = box(k);
      return b2.length === 4 && b2[0] >= 0 && b2[1] >= 0 && b2[2] <= T - 1 && b2[3] <= T - 1;
    };
    truth('A0j 三件道具都不出格', [inCell('prop-power'), inCell('prop-bombs'), inCell('prop-speed')],
      [box('prop-power'), box('prop-bombs'), box('prop-speed')]);
    truth('A0k 道具剪影够大（最窄边 ≥ 20px）',
      ['prop-power', 'prop-bombs', 'prop-speed'].every(k => {
        const b2 = box(k);
        return b2.length === 4 && (b2[2] - b2[0] >= 20) && (b2[3] - b2[1] >= 20);
      }),
      ['prop-power', 'prop-bombs', 'prop-speed'].map(box));

    const BASE = s0.crates;
    truth('A0g 初始障碍数', BASE >= 26, BASE);

    // 往下走一格
    G.start();
    tap('KeyS', 0.17);
    const a1 = p0();
    eq('A1 走一格 = 格坐标 +1', a1.cell, [SPAWN0[0], SPAWN0[1] + 1]);
    near('A1b 位移约一格', a1.wy - T, T, 6);

    // 左边是石墙：只转身，原地不动
    G.start();
    G.key('KeyA', true); stepSec(0.1);
    const fa = G.facing(0);
    out.logs.leftBlocked = fa;
    eq('A2 左边是墙 -> 朝向变左', fa.dir, 'left');
    eq('A3 左边是墙 -> 位置一动不动', [fa.wx, fa.wy], [SPAWN0[0] * T, SPAWN0[1] * T]);
    eq('A4 左边是墙 -> 没有起步动画', fa.moving, false);
    G.key('KeyA', false); stepSec(0.05);

    // 上方是石墙：同样只转身
    G.key('KeyW', true); stepSec(0.1);
    const fw = G.facing(0);
    eq('A5 上方是墙 -> 朝向变上', fw.dir, 'up');
    eq('A6 上方是墙 -> 位置不变', [fw.wx, fw.wy], [SPAWN0[0] * T, SPAWN0[1] * T]);
    G.key('KeyW', false);

    // 走到木箱左边，再往右顶木箱
    G.start();
    G.walk(0, 'right', 5);                      // (1,1) -> (2,1)，(3,1) 是木箱
    eq('A7 走到木箱左侧', p0().cell, [2, 1]);
    G.key('KeyD', true); stepSec(0.12);
    const fd = G.facing(0);
    eq('A8 右边是木箱 -> 朝向变右', fd.dir, 'right');
    eq('A9 右边是木箱 -> 一格都不挪', [fd.wx, fd.wy], [2 * T, 1 * T]);
    G.key('KeyD', false);

    // 一路往右冲，身体右边缘正好停在木箱左边缘（整格碰撞体）
    G.start();
    G.key('KeyD', true); stepSec(0.6); G.key('KeyD', false); stepSec(0.02);
    near('A10 贴着木箱停住（右边缘对齐 3×32）', p0().wx + T, 3 * T, 2.5);
    eq('A10b 纵向没被带偏', p0().wy, 1 * T);

    // 子格移动：开阔处走一小段，停在非整数格上
    G.start();
    tap('KeyS', 0.06);
    const a11 = p0();
    truth('A11 停在格子中间（wy 不是 32 的整数倍）', a11.subY > 0.5 && a11.subY < T - 0.5, a11.subY);
    truth('A11b 位置比 8px 的子格更细（连续像素）', a11.subY % 1 !== 0, a11.subY);

    /* ================ B 拐弯修正：偏离中线时自动对正 ================ */
    // (3,5) 上下都空，(4,6) 是石柱 —— 右边的巷子只有一格高，必须对正才能进
    G.start();
    truth('B0 斜站位本身合法（跨 5/6 两行）', G.free(3 * T, 5 * T + 14), G.free(3 * T, 5 * T + 14));
    G.put(0, 3 * T, 5 * T + 14);                // 偏离中线 14px
    G.key('KeyD', true); stepSec(0.35); G.key('KeyD', false);
    const b1 = p0();
    out.logs.align = b1;
    eq('B1 自动对正到第 5 行', b1.wy, 5 * T);
    truth('B2 对正后成功拐进右边一格', b1.wx > 3 * T + 1, b1.wx);
    truth('B3 没穿过石柱（停在 4 格边界内）', b1.wx <= 4 * T + 0.5, b1.wx);

    // 已经对正时：不进修正分支，直着走
    G.start();
    G.put(0, 3 * T, 5 * T);
    G.key('KeyD', true); stepSec(0.2); G.key('KeyD', false);
    eq('B4 已对正 -> 纵向不动', p0().wy, 5 * T);
    truth('B5 横向照常前进', p0().wx > 3 * T + 8, p0().wx);

    // 上下通畅时按当前子格位置直着走，不做横向修正
    G.start();
    G.put(0, 7 * T, 5 * T + 8);
    G.key('KeyS', true); stepSec(0.1); G.key('KeyS', false);
    eq('B6 竖着走不修正横向位置', p0().wx, 7 * T);
    truth('B7 竖向正常前进', p0().wy > 5 * T + 16, p0().wy);

    /* ========= B2 亚像素偏差：不能因为「差一点点」就永远卡在巷口 =========
       (4,6) 是石柱，(4,5) 是空地 —— 必须把身体精确对到第 5 行才进得去。
       上下走动停下的位置是连续像素，常常只差 0.2~0.6px，
       以前这些残余量小于「对正阈值」就被跳过，于是永远顶在巷口。 */
    const tiny = [0.12, 0.25, 0.38, 0.5, 0.58, 0.72, 0.9, 1.15, 1.6, 2.4,
                  -0.12, -0.3, -0.45, -0.58, -0.8, -1.3, -2.2];
    for (let v2 = 0.05; v2 <= 6; v2 += 0.07) { tiny.push(+v2.toFixed(2), +(-v2).toFixed(2)); }
    const stuck = [];
    for (const off of tiny) {
      G.start();
      G.put(0, 3 * T, 5 * T + off);
      G.key('KeyD', true); stepSec(0.3); G.key('KeyD', false);
      const q = p0();
      if (!(q.wx > 3 * T + 1)) stuck.push({ off, wx: q.wx, wy: q.wy });
      else if (q.wy !== 5 * T) stuck.push({ off, 'ytarget': q.wy });
    }
    out.logs.tinyStuck = stuck;
    eq('B8 任意亚像素偏差都能对正并拐进窄巷（' + tiny.length + ' 种）', stuck, []);

    // 差得更多（14px）时同样要能进去，且不能来回抖
    G.start();
    G.put(0, 3 * T, 5 * T + 14);
    G.key('KeyD', true); stepSec(0.3);
    const b9 = p0();
    G.key('KeyD', false);
    truth('B9 偏差 14px 也能进去', b9.wx > 3 * T + 1, b9);
    eq('B9b 进去后稳稳贴在第 5 行', b9.wy, 5 * T);

    // 反向：横向只差 0.4px，往下挤进一列宽的竖巷（左右都是石柱）
    G.start();
    G.put(0, 3 * T + 0.4, 5 * T);
    G.key('KeyS', true); stepSec(0.3); G.key('KeyS', false);
    const b10 = p0();
    out.logs.yAlign = b10;
    truth('B10 横向差 0.4px 也能拐进竖巷', b10.wy > 5 * T + 1, b10);
    eq('B10b 横向已对正到第 3 列', b10.wx, 3 * T);

    // 真实手感：先往下走一小段（停在半格上），再按右 —— 必须能拐进巷子
    G.start();
    G.setPos(0, 3, 5);
    tap('KeyS', 0.06);
    const drift = p0().wy - 5 * T;
    G.key('KeyD', true); stepSec(0.35); G.key('KeyD', false);
    const b11 = p0();
    out.logs.walkThenTurn = { drift, b11 };
    truth('B11 先走半格再拐弯（下走 ' + drift.toFixed(1) + 'px）也能进', b11.wx > 3 * T + 1, b11);
    eq('B11b 拐进去后贴在第 5 行', b11.wy, 5 * T);

    // 一直按着右：进巷之后要稳稳顶住宝箱，不能来回抖、不能往纵向漂
    G.start();
    G.setPos(0, 3, 5);
    G.put(0, 3 * T, 5 * T + 9);
    G.key('KeyD', true); stepSec(1.2);
    const b12 = p0();
    stepSec(0.4);
    const b12b = p0();
    G.key('KeyD', false);
    out.logs.holdRight = { b12, b12b };
    eq('B12 长按不漂移（1.2s 与 1.6s 位置一致）', [b12.wx, b12.wy], [b12b.wx, b12b.wy]);
    near('B12b 顶在宝箱左侧、仍在第 5 行', b12.wx + T, 5 * T, 2.5);
    eq('B12c 全程没离开第 5 行', b12.wy, 5 * T);

    /* ================ C 糖弹放置与阻挡 ================ */
    G.start();
    G.setPos(0, 2, 1);
    G.place(0);
    let s = G.snap();
    eq('C1 糖弹放在脚下这一格', [s.bombs[0].x, s.bombs[0].y], [2, 1]);

    // 糖弹是障碍物：别人踩不进去
    G.start();
    G.placeAt(1, 2, 1, 1);
    G.walk(0, 'down', 1);
    eq('C2 糖弹挡路，踩不过去', p0().cell, [1, 1]);
    G.key('KeyS', true); stepSec(0.2); G.key('KeyS', false);
    eq('C2b 往糖弹方向按也只转身', [G.facing(0).dir, p0().cell], ['down', [1, 1]]);

    G.start();
    G.setPos(0, 5, 5);
    eq('C3 第一颗放下', G.place(0), true);
    eq('C4 同格不能再放（糖弹数限制）', G.place(0), false);

    // 但自己放的那一颗不能把自己困住：站在上面照样能走出去
    G.start();
    G.setPos(0, 3, 5);
    G.place(0);
    G.key('KeyS', true); stepSec(0.3); G.key('KeyS', false);
    const c6 = p0();
    out.logs.selfBomb = c6;
    truth('C5 站在自己糖弹上能走出去', c6.wy > 5 * T + 4, c6);
    G.key('KeyW', true); stepSec(0.3); G.key('KeyW', false);
    eq('C6 走出去之后不能踩回糖弹格', p0().cell, [3, 6]);

    // 对手同样踩不进去
    G.start();
    G.placeAt(3, 6, 1, 1);
    G.setPos(0, 3, 7);
    G.key('KeyW', true); stepSec(0.2); G.key('KeyW', false);
    eq('C7 对手踩不进糖弹格', p0().cell, [3, 7]);

    /* ================ D 定时爆炸 ================ */
    G.start();
    G.placeAt(2, 1, 1, 0);
    G.step(200);
    let c = G.snap();
    eq('D1 引信未到不爆', c.bombs.length, 1);
    eq('D2 木箱仍在', c.crates, BASE);
    G.step(120);
    c = G.snap();
    eq('D3 到点爆炸', c.bombs.length, 0);
    eq('D4 相邻木箱被炸毁', c.crates, BASE - 1);
    truth('D5 产生火焰', c.flames.length > 0, c.flames);

    /* ================ E 连锁 = 同一帧一起爆 ================ */
    G.start();
    G.placeAt(5, 3, 1, 0);
    G.step(200);
    G.placeAt(6, 3, 1, 1);
    const seq = [], flameSeq = [];
    for (let i = 0; i < 200; i++) {
      G.step(1);
      const sn = G.snap();
      seq.push(sn.bombs.length);
      flameSeq.push(sn.flames.length);
    }
    out.logs.chainBombs = seq.join('');
    truth('E1 两颗糖弹同帧消失（中间没有只爆一颗的帧）', seq.indexOf(1) < 0, seq.join(','));
    eq('E2 两颗都爆了', G.snap().bombs.length, 0);
    const firstBoom = seq.indexOf(0);
    truth('E3 第一帧就同时清空', firstBoom >= 0 && seq[firstBoom] === 0,
      seq.slice(Math.max(0, firstBoom - 3), firstBoom + 2));
    truth('E4 火焰同帧铺开', firstBoom >= 0 && flameSeq[firstBoom] >= 4,
      flameSeq.slice(Math.max(0, firstBoom - 2), firstBoom + 2));
    eq('E5 两个障碍被摧毁', G.snap().crates, BASE - 2);

    /* ================ F 障碍阻断爆炸 ================ */
    G.start();
    G.placeAt(2, 1, 3, 0);
    const seenF = {};
    for (let i = 0; i < fuseFrames; i++) {
      G.step(1);
      G.snap().flames.forEach(f => { seenF[f.x + ',' + f.y] = 1; });
    }
    out.logs.block = Object.keys(seenF).sort();
    truth('F1 穿不过石墙', !seenF['2,0'], seenF);
    truth('F2 穿不过石柱', !seenF['2,2'], seenF);
    truth('F3 木箱挡住延伸（威力 3 也只到 3,1）', !!seenF['3,1'] && !seenF['4,1'], seenF);

    /* ================ G 三种道具 ================ */
    // 木箱掉落（把随机数钉死成「必掉 + 第一件」）
    G.start();
    const rnd = Math.random;
    Math.random = () => 0.1;
    G.placeAt(2, 1, 1, 0);
    G.walk(0, 'down', 1);
    eq('G0 已躲开爆炸范围', p0().cell, [1, 2]);
    G.step(fuseFrames);
    Math.random = rnd;
    let g1 = G.snap();
    truth('G1 木箱掉出道具', g1.powerups.length === 1, g1.powerups);
    eq('G2 掉的是威力', g1.powerups[0] && g1.powerups[0].kind, 'power');
    G.setPos(0, 3, 1);
    G.step(4);
    g1 = G.snap();
    eq('G3 站到道具格上', g1.players[0].cell, [3, 1]);
    eq('G4 捡到后威力 2', g1.players[0].power, 2);
    eq('G5 道具被吃掉', g1.powerups.length, 0);

    // 速度道具：捡到后同样的时间里走得更远
    G.start();
    const dist0 = (() => {
      G.key('KeyD', true); stepSec(0.1); G.key('KeyD', false);
      return p0().wx - SPAWN0[0] * T;
    })();
    G.start();
    G.powerup(2, 1, 'speed');
    G.setPos(0, 2, 1);
    G.step(4);
    eq('G6 捡到速度道具 -> 速度等级 2', p0().spd, 2);
    G.setPos(0, 1, 1);
    G.key('KeyD', true); stepSec(0.1); G.key('KeyD', false);
    const dist1 = p0().wx - SPAWN0[0] * T;
    out.logs.speed = [+dist0.toFixed(2), +dist1.toFixed(2)];
    truth('G7 速度道具真的更快', dist1 > dist0 + 2, [dist0, dist1]);

    // 糖弹数道具
    G.start();
    G.powerup(2, 1, 'bomb');
    G.setPos(0, 2, 1);
    G.step(4);
    eq('G8 捡到糖弹道具 -> 上限 2', p0().bombs, 2);

    /* ================ H 死亡判定看中心点 + 伤害只在爆炸瞬间 ================ */
    G.start();
    G.placeAt(1, 1, 1, 1);
    G.step(fuseFrames);
    eq('H1 中心和火焰同格 -> 炸死', G.snap().players[0].alive, false);

    G.start();
    G.setPos(0, 1, 3);
    G.placeAt(1, 1, 1, 1);
    G.step(fuseFrames);
    truth('H2 火在隔壁格 -> 活着', G.snap().players[0].alive, G.snap().players[0]);
    eq('H3 没人死就不结算', G.snap().phase, 'play');

    // 火焰只是动画：烧完之后走进那个格子不会再死
    G.start();
    G.setPos(0, 5, 6);
    G.placeAt(5, 4, 1, 1);                       // 火焰含 (5,5)
    G.step(Math.ceil(K.FUSE / FRAME) + 2);
    truth('H4 火焰已生成', G.snap().flames.some(x => x.x === 5 && x.y === 5), G.snap().flames);
    G.key('KeyW', true);
    G.step(10);
    const lit = G.snap().flames.length;
    G.key('KeyW', false);
    truth('H5 火焰还在烧（没被提前清掉）', lit > 0, lit);
    eq('H6 火只烧一瞬间：之后走进去不死', G.snap().players[0].alive, true);

    // 火焰存留时间变短了
    truth('H7 火焰存留 <= 0.3s', K.FLAME_LIFE <= 0.3, K.FLAME_LIFE);

    /* ================ I 炸死对手 = 赢 ================ */
    G.start();
    const w0 = G.snap().players.map(p => p.wins);
    G.placeAt(1, 1, 1, 0);
    G.step(fuseFrames);
    const h = G.snap();
    eq('I1 踩在自己糖弹上被炸死', h.players[0].alive, false);
    eq('I2 进入结算', h.phase, 'over');
    eq('I3 对手胜利数 +1', h.players[1].wins, w0[1] + 1);
    const ovl = G.overlay();
    truth('I4 弹出结果层', ovl.on && ovl.text.indexOf('林克') >= 0, ovl);
    out.logs.result = ovl.text;

    /* ================ J 重开复位 ================ */
    G.start();
    const r1 = G.snap();
    eq('J1 双方复活', r1.players.map(p => p.alive), [true, true]);
    eq('J2 地形复原', r1.crates, BASE);
    eq('J3 无残留糖弹', r1.bombs.length, 0);
    eq('J4 比分保留', r1.players[1].wins, w0[1] + 1);
    eq('J5 回到出生格', r1.players.map(p => p.cell), [SPAWN0, SPAWN1]);

    /* ================ K 画面 ================ */
    await sleep(80);
    const cv = document.getElementById('cv');
    const cx2 = cv.getContext('2d');
    const px = cx2.getImageData(0, 0, cv.width, cv.height).data;
    const colors = new Set();
    let filled = 0;
    for (let i = 0; i < px.length; i += 4 * 53) {
      if (px[i + 3] > 0) filled++;
      colors.add(px[i] + ',' + px[i + 1] + ',' + px[i + 2]);
    }
    truth('K1 画布已绘制', filled > 500, filled);
    truth('K2 画面颜色丰富', colors.size > 20, colors.size);
    const rect = cv.getBoundingClientRect();
    const ratio = rect.width / rect.height;
    out.logs.canvas = [Math.round(rect.width), Math.round(rect.height), +ratio.toFixed(3), filled, colors.size];
    truth('K3 画布比例正确', Math.abs(ratio - 672 / 384) < 0.02, ratio);

    // 火焰用的是爆炸格素材：火格中心必须是蓝紫色，而不是沙地/石砖
    G.start();
    G.setPos(0, 1, 1);
    G.placeAt(3, 4, 1, 1);       // (3,3) 起火，(3,2) 是石柱挡住了向上
    G.step(Math.ceil(K.FUSE / FRAME) + 14);   // 越过白闪再采样
    await sleep(60);
    const dpr = cv.width / W0;
    const sample = (gx, gy, dx, dy) => {
      const d = cx2.getImageData(Math.round((gx * T + dx) * dpr), Math.round((gy * T + dy) * dpr), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const fc = sample(3, 3, 26, 26);
    out.logs.flameColor = fc;
    truth('K4 火格被爆炸格素材盖住（偏蓝）', fc[2] > fc[0] + 20 && fc[2] > 80, fc);

    /* 糖弹要撑满整格：把这一格（含上下左右各 3px）挖出来和「还没放糖弹」时对比，
       差异必须正好铺满 32×32 —— 既不能留缝，也不能漫到隔壁格子。 */
    const RS = cv.width / W0;            // 画布内部像素 / 逻辑像素
    const grab = (gx, gy, pad) => {
      const x0 = gx * T - pad, y0 = gy * T - pad, w = T + pad * 2, h = T + pad * 2;
      const dw = Math.round(w * RS), dh = Math.round(h * RS);
      return {
        x0, y0, w, h, dw, dh,
        d: cx2.getImageData(Math.round(x0 * RS), Math.round(y0 * RS), dw, dh).data
      };
    };
    const diffBox = (a, b) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
      const rx = a.w / a.dw, ry = a.h / a.dh;
      for (let y = 0; y < a.dh; y++) {
        for (let x = 0; x < a.dw; x++) {
          const i = (y * a.dw + x) * 4;
          const dd = Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]);
          if (dd > 18) {
            n++;
            const lx = a.x0 + x * rx, ly = a.y0 + y * ry;
            if (lx < x0) x0 = lx; if (lx > x1) x1 = lx;
            if (ly < y0) y0 = ly; if (ly > y1) y1 = ly;
          }
        }
      }
      const total = a.dw * a.dh;
      return n ? { n, total, box: [x0, y0, x1, y1] } : { n, total, box: null };
    };
    const PAD = 3;
    /* 脚底下那圈软阴影会溢出格子 2~3px，属于美术效果，放行 */
    const fitsCell = (bx2, by2, d) => !!d.box &&
      d.box[0] >= bx2 - 1 && d.box[1] >= by2 - 1 &&
      d.box[2] <= bx2 + T && d.box[3] <= by2 + T + 4;
    const spriteH = (d, by2) => Math.min(d.box[3], by2 + T - 1) - d.box[1];

    G.start();
    G.setPos(0, 1, 1);
    G.setPos(1, K.COLS - 2, K.ROWS - 2);
    await sleep(60);
    G.paint();
    const empty4 = grab(12, 4, PAD);
    G.placeAt(12, 4, 1, 0);
    G.paint();
    const bd = diffBox(empty4, grab(12, 4, PAD));
    out.logs.bombBox = bd;
    truth('K8 糖弹撑满整格（占满 32×32 且不越界）',
      fitsCell(12 * T, 4 * T, bd) && bd.n / bd.total > 0.37 &&
      bd.box[2] - bd.box[0] >= T - 2 && spriteH(bd, 4 * T) >= T - 2, bd);

    /* 人物：身子占满自己那一格，头顶再往上探出半格（16px）。
       这不是画出了边界，而是这版刻意让头压在围墙上的效果 ——
       PAD 要够大才拍得到头顶那一截。 */
    const PADH = 22;
    G.start();                      // 两人都在出生点，离 12/8 远远的，不会脏取景框
    await sleep(60);
    G.paint();
    const empty8 = grab(12, 8, PADH);
    G.setPos(0, 12, 8);
    G.paint();
    const cd = diffBox(empty8, grab(12, 8, PADH));
    out.logs.charBox = cd;
    truth('K9 人物贴着自己那格画：横向不越界、纵向到脚底',
      !!cd.box &&
      cd.box[0] >= 12 * T - 1 && cd.box[2] <= 12 * T + T + 1 &&
      cd.box[3] >= 8 * T + T - 3 && cd.box[3] <= 8 * T + T + 4 &&
      cd.n / cd.total > 0.10, cd);
    truth('K9a 头顶探出碰撞格半格（16px）',
      Math.abs(cd.box[1] - (8 * T - T / 2)) <= 2, { top: cd.box[1], want: 8 * T - T / 2 });

    /* 头顶能盖住上面的围墙：人物不参与 y 排序，永远画在最上层。
       12/6 那格是一根立柱（实心墙），人站到 12/7 —— 头就该压在柱子上。 */
    G.start();
    G.setPos(0, 12, 10);
    G.setPos(1, K.COLS - 2, K.ROWS - 2);
    await sleep(60);
    G.paint();
    const emptyPI = grab(12, 6, 6);
    G.setPos(0, 12, 7);
    G.paint();
    const hd = diffBox(emptyPI, grab(12, 6, 6));
    out.logs.headOverWall = hd;
    truth('K9b 头顶能压在上面的围墙上（人物在最上层）',
      !!hd.box && hd.n > 60 && hd.box[1] < 7 * T - 1, hd);

    const face = document.getElementById('face1');
    truth('K5 头像已载入', !!face && face.src.indexOf('data:image/svg') === 0);
    const stage = document.querySelector('.stage').getBoundingClientRect();
    out.logs.stage = [Math.round(stage.width), Math.round(stage.height)];
    truth('K6 舞台有尺寸', stage.width > 300, stage.width);
    eq('K7 无横向溢出', document.documentElement.scrollWidth <= window.innerWidth + 1, true);

    // 布局：两张属性卡都在右栏，底部说明行已移除
    const rail = document.getElementById('rail');
    truth('K6b 两张属性卡都在右侧栏', !!rail && rail.querySelectorAll('.pcard').length === 2,
      rail ? rail.querySelectorAll('.pcard').length : null);
    truth('K6c 页脚说明已移除', !document.querySelector('footer'));
    const rb = document.getElementById('btnRestart');
    truth('K6d 顶栏有「重开」按钮', !!rb && rb.textContent.replace(/\s/g, '') === '重开');
    if (rb) {
      G.start();
      G.step(60);
      const before = G.snap().time;
      rb.click();
      const after = G.snap();
      out.logs.restart = [before, after.time, after.phase, rail ? Math.round(rail.getBoundingClientRect().left) : null];
      truth('K6e 点重开把对局拉回起点', after.phase === 'play' && after.time < before * 0.5, after.time);
    }

    G.start();
    out.logs.hud = [
      document.getElementById('b1').textContent,
      document.getElementById('ps1').textContent,
      document.getElementById('sp1') && document.getElementById('sp1').textContent
    ];

    /* ================ L 冰原：换主题换一整套贴图 ================ */
    const ICE_KEYS = ['tile-ice', 'tile-ice-snow', 'wall-icebrick', 'wall-icepillar',
                      'prop-iceblock', 'prop-icechest', 'prop-snowman'];
    eq('L1 两张内置地图在最前面', G.maps().slice(0, 2), ['temple', 'ice']);
    eq('L2 切到冰原', G.map('ice'), 'ice');

    // 冰原地面必须是冷色（换主题真的换皮了）—— 先取样，G.start() 的白闪会把颜色洗掉
    if (G.paint) G.paint();
    const sampleAt = (gx, gy, off) => {
      const s = cv.width / W0;
      const dx = Math.round((gx * T + (off || 2)) * s);
      const dy = Math.round((gy * T + (off || 2)) * s);
      const d2 = cx2.getImageData(dx, dy, 1, 1).data;
      return [d2[0], d2[1], d2[2]];
    };
    const iceFloor = sampleAt(5, 4), iceFloor2 = sampleAt(15, 7);
    truth('L2b 冰原地面是冷色（蓝明显高于红）',
      iceFloor[2] > iceFloor[0] + 12 && iceFloor2[2] > iceFloor2[0] + 12,
      { a: iceFloor, b: iceFloor2 });

    G.start();
    const sIce = G.snap();
    eq('L3 冰原出生格（对角）', [sIce.players[0].cell, sIce.players[1].cell],
      [[1, 1], [19, 10]]);
    truth('L4 冰原贴图全部载入 32×32',
      ICE_KEYS.map(k => G.sprite(k)).every(v => v && v[0] === T && v[1] === T),
      ICE_KEYS.map(k => [k, G.sprite(k)]));
    truth('L5 冰原贴图都在网格内',
      ICE_KEYS.every(k => {
        const b2 = G.spriteBox(k);
        return b2 && b2[0] >= 0 && b2[1] >= 0 && b2[2] <= T - 1 && b2[3] <= T - 1;
      }), ICE_KEYS.map(k => [k, G.spriteBox(k)]));
    const reachIce = G.reach();
    truth('L6 冰原两个出生点连通', reachIce.other && reachIce.n > 90, reachIce);

    /* 严格模式：障碍/宝箱都还没炸开，也必须走得到对面（不能只靠炸） */
    const strictIce = G.reach(true);
    truth('L6b 冰原开局纯靠走就能摸到对面', strictIce.other && strictIce.n > 80, strictIce);

    truth('L7 冰原有大量可炸障碍', sIce.crates >= 60, sIce.crates);
    truth('L7b 冰原障碍明显多于神殿', sIce.crates >= G.cratesOf('temple') * 1.5,
      { ice: sIce.crates, temple: G.cratesOf('temple') });

    /* 障碍多，掉率也给高一档：冰原砸开同样一块冰，更容易出道具 */
    truth('L7d 冰原掉落率高于神殿', G.dropRate() > 0.4,
      { ice: G.dropRate(), temple: 0.34 });

    /* 冰柱只在四角：到最近角点的曼哈顿距离 ≤ 4 */
    const pillars = G.pillarCells();
    const cornerDist = c => Math.min(
      c[0] - 1 + c[1] - 1,
      K.COLS - 2 - c[0] + c[1] - 1,
      c[0] - 1 + K.ROWS - 2 - c[1],
      K.COLS - 2 - c[0] + K.ROWS - 2 - c[1]);
    truth('L7c 冰柱都堆在四个角',
      pillars.length >= 16 && pillars.every(c => cornerDist(c) <= 4),
      pillars.map(c => [c, cornerDist(c)]));

    // 冰原上炸开一块冰：格子清空
    G.start();
    G.setPos(0, 3, 3);
    G.setPos(1, 19, 10);
    const beforeIce = G.snap().crates;
    G.placeAt(2, 3, 1, 0);
    stepSec(K.FUSE + 0.1);
    const afterIce = G.snap();
    truth('L9 冰原冰块被炸开', afterIce.crates < beforeIce,
      { before: beforeIce, after: afterIce.crates });

    /* ================ N 新增障碍：纯色方块 / 雪块 / 实心装饰（雪人） ================ */
    const NEW_KEYS = ['prop-block-red', 'prop-block-violet', 'prop-snowblock'];
    truth('N1 三种新障碍素材都是 32×32',
      NEW_KEYS.map(k => G.sprite(k)).every(v => v && v[0] === T && v[1] === T),
      NEW_KEYS.map(k => [k, G.sprite(k)]));
    truth('N2 三种新障碍都收在一格内',
      NEW_KEYS.every(k => {
        const b2 = G.spriteBox(k);
        return b2 && b2[0] >= 0 && b2[1] >= 0 && b2[2] <= T - 1 && b2[3] <= T - 1;
      }), NEW_KEYS.map(k => [k, G.spriteBox(k)]));

    const EMPTY_V = 0, DECOR_V = 6, PUSH_V = 7;
    G.start();
    truth('N3 冰原摆了雪块（可炸 · 可推动）',
      G.tileAt(9, 3) === PUSH_V && G.tileAt(11, 8) === PUSH_V,
      [G.tileAt(9, 3), G.tileAt(11, 8)]);
    truth('N4 雪块挡路', G.free(9 * T, 3 * T) === false);

    const beforePush = G.snap().crates;
    G.setPos(0, 9, 4);
    G.placeAt(9, 4, 1, 0);
    stepSec(K.FUSE + 0.1);
    truth('N5 雪块能被炸开', G.tileAt(9, 3) === EMPTY_V && G.snap().crates < beforePush,
      { cell: G.tileAt(9, 3), before: beforePush, after: G.snap().crates });

    /* 雪人：挡路、挡糖弹，但炸不开也推不动 */
    const deco = G.decorCells();
    truth('N6 冰原撒出了雪人', deco.length > 0, deco.length);
    let dspot = null;
    for (const c of deco) {
      for (const d of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = c[0] + d[0], ny = c[1] + d[1];
        if (nx < 1 || ny < 1 || nx > K.COLS - 2 || ny > K.ROWS - 2) continue;
        if (G.free(nx * T, ny * T)) { dspot = [c[0], c[1], nx, ny]; break; }
      }
      if (dspot) break;
    }
    truth('N7 雪人挡路（站不进去）', !!dspot && G.free(dspot[0] * T, dspot[1] * T) === false, dspot);
    if (dspot) {
      G.setPos(0, dspot[2], dspot[3]);
      G.placeAt(dspot[2], dspot[3], 1, 0);
      stepSec(K.FUSE + 0.1);
      truth('N8 雪人炸不开', G.tileAt(dspot[0], dspot[1]) === DECOR_V, G.tileAt(dspot[0], dspot[1]));
    }

    // 换回神殿，确认主题能来回切
    G.map('temple');
    G.start();
    eq('L10 切回神殿', G.mapId(), 'temple');
    eq('L11 神殿出生格（对角）', [p0().cell, p1().cell], [[1, 1], [19, 10]]);
    const reachTemple = G.reach();
    truth('L12 神殿两个出生点连通', reachTemple.other && reachTemple.n > 120, reachTemple);

    /* ================ O 推雪块：对正按住方向 0.05s 推一格 ================ */
    G.map('ice');
    G.start();
    for (const c of G.decorCells()) G.setTile(c[0], c[1], EMPTY_V);  // 拿掉随机雪人，棋盘才确定
    const CRATE_V = 3;
    // 冰原 (8,3) 已让成空地：站到雪块 (9,3) 左边正好面对面
    G.setPos(0, 8, 3);
    G.setPos(1, 19, 10);
    eq('O0 雪块在 (9,3)', G.tileAt(9, 3), PUSH_V);
    G.key('KeyD', true);
    G.step(5);                                    // ~0.042s，不足 0.05s
    eq('O1 不足 0.05s 不推', G.tileAt(9, 3), PUSH_V);
    eq('O1b 人也没挪', [p0().wx, p0().wy], [8 * T, 3 * T]);
    G.step(2);                                    // 蓄力过 0.05s
    eq('O2 到点雪块右移一格', [G.tileAt(9, 3), G.tileAt(10, 3)], [EMPTY_V, PUSH_V]);
    eq('O2b 推的人原地没动', p0().cell, [8, 3]);
    G.key('KeyD', false);
    G.step(2);

    // 一直按着：推一格、跟走一格，一路推到没路为止
    G.setPos(0, 10, 2);                           // 雪块已在 (10,3)，站到它正上方
    G.key('KeyS', true);
    stepSec(1.5);                                 // 够推满一整列再稳稳顶住
    G.key('KeyS', false);
    eq('O3 一路推到墙边停住', [G.tileAt(10, 3), G.tileAt(10, 9), G.tileAt(10, 10), G.tileAt(10, 11)],
      [EMPTY_V, EMPTY_V, PUSH_V, 1]);
    eq('O3b 人跟在雪块正后方', p0().cell, [10, 9]);

    // 主体对着雪块（只是歪 14px）：先对正去推，绝不侧身绕开 ——
    // 不然一歪就被带去旁边空行，玩起来就是「推不动 / 绕着雪块转圈」
    G.start();
    for (const c of G.decorCells()) G.setTile(c[0], c[1], EMPTY_V);
    G.setPos(1, 19, 10);
    G.put(0, 10 * T, 3 * T + 14);                 // 大部分身体在第 3 行（雪块那条线）
    G.key('KeyA', true);
    stepSec(0.3);
    G.key('KeyA', false);
    eq('O4 主体对着雪块：歪 14px 也对正去推', [G.tileAt(9, 3), G.tileAt(8, 3)],
      [EMPTY_V, PUSH_V]);
    eq('O4b 人跟到雪块旁那一格', p0().cell, [9, 3]);

    // 主体大部分在旁边空行上：不算「面对雪块」，照旧侧身溜过去，不硬推
    G.start();
    for (const c of G.decorCells()) G.setTile(c[0], c[1], EMPTY_V);
    G.setPos(1, 19, 10);
    G.put(0, 10 * T, 4 * T - 6);                  // 大部分身体在第 4 行（空行）
    G.key('KeyA', true);
    stepSec(0.3);
    G.key('KeyA', false);
    eq('O4c 主体在空行：照旧绕过去，雪块不动', [G.tileAt(9, 3), p0().cell],
      [PUSH_V, [9, 4]]);

    // 去处被堵就推不动：糖弹、人、别的障碍都算
    G.start();
    for (const c of G.decorCells()) G.setTile(c[0], c[1], EMPTY_V);
    G.setPos(0, 8, 3);
    G.setPos(1, 19, 10);
    G.placeAt(10, 3, 1, 1);                       // 雪块要去的那格放了颗糖弹
    G.key('KeyD', true);
    stepSec(0.3);
    G.key('KeyD', false);
    eq('O5 去处有糖弹推不动', [G.tileAt(9, 3), G.tileAt(10, 3)], [PUSH_V, EMPTY_V]);
    truth('O5b 糖弹还在原格', G.snap().bombs.some(b => b.x === 10 && b.y === 3), G.snap().bombs);

    G.start();
    for (const c of G.decorCells()) G.setTile(c[0], c[1], EMPTY_V);
    G.setPos(0, 8, 3);
    G.setPos(1, 10, 3);                           // 对手就站在雪块后面
    G.key('KeyD', true);
    stepSec(0.3);
    G.key('KeyD', false);
    eq('O6 去处站着人推不动', [G.tileAt(9, 3), p1().cell], [PUSH_V, [10, 3]]);

    // 这个待遇只有雪块有：可炸障碍（冰砖）顶不动
    G.start();
    for (const c of G.decorCells()) G.setTile(c[0], c[1], EMPTY_V);
    G.setPos(1, 19, 10);
    G.setPos(0, 1, 5);                            // (2,5) 是冰砖，右边一格是空地
    G.key('KeyD', true);
    stepSec(0.3);
    G.key('KeyD', false);
    eq('O7 冰砖推不动', G.tileAt(2, 5), CRATE_V);
    eq('O7b 人原地', p0().cell, [1, 5]);

    /* ================ P 炮弹口味：开局选择 + 局内换弹 ================ */
    G.bombReset();                       // 上一次跑测试点过的口味会存进 localStorage，先归零
    G.map('temple');
    G.home();
    eq('P0 默认口味 P1 草莓 / P2 汽水', [p0().bomb, p1().bomb], ['candy-bomb', 'bomb-soda']);
    eq('P0b 口味表一共 9 种', G.kinds().length, 9);
    const strips = [...document.querySelectorAll('#ov .bomb-strip')];
    truth('P1 准备页每人一条炮弹选择条', strips.length === 2, strips.length);
    truth('P2 每条 9 格、选中格唯一',
      strips.map(s => s.querySelectorAll('.bkind').length).join(',') === '9,9' &&
      strips.map(s => s.querySelectorAll('.bkind.on').length).join(',') === '1,1',
      strips.map(s => [s.querySelectorAll('.bkind').length, s.querySelectorAll('.bkind.on').length]));
    const gold = strips[0].querySelector('.bkind[data-kind="bomb-gold"]');
    gold.click();
    truth('P3 点选黄金弹：选中框挪过去且唯一', gold.classList.contains('on') &&
      strips[0].querySelectorAll('.bkind.on').length === 1);
    eq('P4 待局玩家口径已换', p0().bomb, 'bomb-gold');
    eq('P5 面板选择条同步亮起一格', document.querySelectorAll('#pb1 .bkind.on').length, 1);
    eq('P5b 面板亮的就是黄金', document.querySelector('#pb1 .bkind.on').dataset.kind, 'bomb-gold');

    G.start();
    G.place(0);                          // P1 脚下放一颗：该是黄金弹
    eq('P6 新弹用上选中的口味', G.snap().bombs[0].kind, 'bomb-gold');
    G.setPos(0, 6, 1);                   // 人先撤出威力 1 的炸圈，别把自己炸死结回合
    stepSec(K.FUSE + 0.15);
    const pf = G.snap().flames;
    truth('P7 爆炸格跟口味（boom-cell-gold）',
      pf.length > 0 && pf.every(f => f.cell === 'boom-cell-gold'), pf.length && pf[0].cell);
    truth('P7b 站远了没事', p0().alive && G.snap().phase === 'play', G.snap().phase);

    // 局内面板换弹：只影响下一颗，空中的弹不追改
    G.placeAt(6, 5, 1, 1);               // P2 的汽水弹挂在远处（默认口味）
    document.querySelector('#pb2 .bkind[data-kind="bomb-grape"]').click();
    eq('P8 面板点选即换口径', p1().bomb, 'bomb-grape');
    stepSec(K.FUSE + 0.2);               // 汽水弹到点炸开（金弹的火已经熄了）
    truth('P9 空中的弹不追改：炸出来还是汽水格',
      G.snap().flames.length > 0 && G.snap().flames.every(f => f.cell === 'boom-cell-soda'),
      G.snap().flames.map(f => f.cell));
    G.place(1);                          // P2 再放一颗：这颗该是葡萄
    eq('P10 下一颗用新口味', G.snap().bombs[0].kind, 'bomb-grape');

    /* ================ M 准备页：左上角品牌 + 选地图 ================ */
    G.map('temple');
    G.home();
    truth('M0 顶栏有素材库按钮', !!document.getElementById('btnGallery'));
    const logoEl = document.querySelector('.brand .logo svg, .brand .logo img');
    const lr = logoEl && logoEl.getBoundingClientRect();
    truth('M1 左上角是 logo（svg 或 img）', !!logoEl && lr.width > 80 && lr.height > 40,
      lr ? [Math.round(lr.width), Math.round(lr.height)] : null);

    const cards = [...document.querySelectorAll('.map-card')];
    truth('M2 准备页列出两张地图', cards.length === G.maps().length, cards.length);
    const thumbs = cards.map(c => c.querySelector('canvas'));
    truth('M3 每张卡都有缩略图并画了东西', thumbs.every(c => {
      if (!c || !c.width) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const set = new Set();
      for (let i = 0; i < d.length; i += 4 * 7) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      return set.size > 3;
    }), thumbs.map(c => (c ? c.width : null)));

    cards[1].click();
    out.logs.pickMap = [G.mapId(), document.querySelectorAll('.map-card.on').length];
    eq('M4 点第二张卡真的换了地图', G.mapId(), 'ice');
    truth('M5 选中态跟到第二张', document.querySelectorAll('.map-card')[1].classList.contains('on') &&
      !document.querySelectorAll('.map-card')[0].classList.contains('on'));
    truth('M6 换图后仍停在准备页', document.getElementById('ov').classList.contains('on'));
    eq('M7 画布同步换成冰原', G.snap().crates > 40, true);
  } catch (e) {
    out.bad.push('异常: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
  }

  document.body.setAttribute('data-diag', JSON.stringify(out));
})();
