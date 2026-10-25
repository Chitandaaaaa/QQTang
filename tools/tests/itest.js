/* 集成测试：把编辑器导出的地图塞进 localStorage，再打开游戏页验证它真的被用上了。
   由 run_test.py 注入，不在编辑器里跑。 */
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

  for (let i = 0; i < 500 && !window.__game; i++) await sleep(10);
  const G = window.__game;
  if (!G) {
    out.bad.push('游戏没有初始化 __game');
    document.body.setAttribute('data-diag', JSON.stringify(out));
    return;
  }
  if (G.setMode) G.setMode('pvp');   // 集成测试固定双人模式，避免 AI 干扰断言

  try {
    const K = G.consts, T = K.TILE, W0 = T * K.COLS;

    /* ---- 1 自定义地图被接进来了 ---- */
    const ids = G.maps();
    truth('X1 游戏读到了自定义地图', ids.indexOf('u_testmap') >= 0, ids);
    eq('X2 内置两张还在最前面', [ids[0], ids[1]], ['temple', 'ice']);
    truth('X3 标记为自定义', G.userMaps().indexOf('u_testmap') >= 0, G.userMaps());

    G.map('u_testmap');
    eq('X4 能切到自定义地图', G.mapId(), 'u_testmap');
    const info = G.mapById('u_testmap');
    truth('X5 带着手绘地面层', info.frows === true, info);
    eq('X6 自定义墙贴图生效', info.wall, 'wall-icebrick');
    eq('X7 自定义障碍贴图生效', info.crate, 'prop-iceblock');
    eq('X8 掉落率跟着走', info.drop, 0.6);

    /* ---- 2 出生点 / 连通 ---- */
    G.start();
    const s = G.snap();
    eq('X9 出生点按编辑器摆的', [s.players[0].cell, s.players[1].cell], [[1, 1], [19, 10]]);
    const r = G.reach();
    truth('X10 两个出生点连通（内部 19×10 全可达）', r.other && r.n >= 185, r);

    /* ---- 3 障碍挡路 / 雪块挡路 / 雪人挡路 ---- */
    truth('X11 木箱那一格站不进去', G.free(5 * T, 5 * T) === false);
    truth('X12 雪块那一格也站不进去', G.free(9 * T, 4 * T) === false);
    truth('X12b 雪人是实心装饰，站不进去', G.free(3 * T, 3 * T) === false);
    truth('X13 空地当然可以站', G.free(10 * T, 6 * T) === true);

    /* ---- 4 贴图真的换成自定义素材（冰面 + 深蓝冰砖墙） ---- */
    G.map('u_testmap');
    G.paint();
    const cv = document.getElementById('cv');
    const dpr = cv.width / W0;
    const px = (gx, gy) => {
      const d = cv.getContext('2d').getImageData(
        Math.round((gx * T + 16) * dpr), Math.round((gy * T + 16) * dpr), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const floor = px(10, 6), wall = px(0, 0);
    out.logs.px = { floor: floor, wall: wall };
    truth('X14 神殿主题下地面被画成了冰面（冷色）', floor[2] > floor[0] + 40 && floor[2] > 200, floor);
    truth('X15 墙用的是深蓝冰砖', wall[2] > wall[0] + 40 && wall[0] < 120, wall);

    /* ---- 5 准备页的地图选择里也多了一张 ---- */
    G.home();
    const cards = [...document.querySelectorAll('.map-card')];
    eq('X16 准备页列出全部地图', cards.length, ids.length);
    truth('X17 自定义地图有缩略图', cards[cards.length - 1].querySelector('canvas').width > 0);

    /* ---- 6 换掉自定义图后游戏照常 ---- */
    G.map('temple');
    G.start();
    eq('X18 换回内置神殿', G.mapId(), 'temple');
    G.step(60);
    truth('X19 内置地图照常能跑', G.snap().phase === 'play', G.snap().phase);
  } catch (e) {
    out.bad.push('异常: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
  }

  document.body.setAttribute('data-diag', JSON.stringify(out));
})();
