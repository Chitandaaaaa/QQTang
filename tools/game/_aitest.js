/* AI 人机测试：验证「简单 AI」真的在自动操作（走位 + 放弹），
   且双人模式下 P2 不会自动行动（不被 AI 接管）。
   由 run_test.py 注入，不在编辑器里跑。 */
(async function () {
  const out = { ok: [], bad: [], logs: {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const truth = (name, cond, extra) => {
    (cond ? out.ok : out.bad).push(name + (cond ? '' : '  ' + JSON.stringify(extra)));
  };
  const eq = (name, got, want) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    (g === w ? out.ok : out.bad).push(name + (g === w ? '' : '  got=' + g + ' want=' + w));
  };

  for (let i = 0; i < 500 && !window.__game; i++) await sleep(10);
  const G = window.__game;
  if (!G) { out.bad.push('游戏没有初始化 __game'); document.body.setAttribute('data-diag', JSON.stringify(out)); return; }
  G.pause(true);

  try {
    const K = G.consts, FRAME = K.FIXED;

    /* ---- 1 人机模式：P2 被 AI 接管，且会自动放弹 / 走位 ---- */
    G.setMode('pve');
    G.map('temple');
    G.start();
    const s0 = G.snap();
    truth('A1 人机模式下 P2 标记为 AI', s0.players[1].isAI === true, s0.players[1]);
    const p2start = s0.players[1].cell;
    const bombs0 = G.aiBombs();

    let moved = false, sawBomb = false, reachedOver = false, minDist = 99;
    for (let i = 0; i < 5400; i += 40) {        // 最多跑 45 秒：弱时先发育，吃够道具才压上
      G.step(40);
      const s = G.snap();
      if (G.aiBombs() > bombs0) sawBomb = true;
      if (s.players[1].cell[0] !== p2start[0] || s.players[1].cell[1] !== p2start[1]) moved = true;
      // 切比雪夫距离：AI 有没有主动逼近 P1（P1 全程站着不动，靠近只可能是 AI 追过去的）
      const dx = Math.abs(s.players[1].cell[0] - s.players[0].cell[0]);
      const dy = Math.abs(s.players[1].cell[1] - s.players[0].cell[1]);
      if (Math.max(dx, dy) < minDist) minDist = Math.max(dx, dy);
      if (s.phase === 'over') { reachedOver = true; break; }
    }
    out.logs.pve = { moved, sawBomb, reachedOver, aiBombs: G.aiBombs(), minDist };
    truth('A2 AI 至少放过一颗糖弹（核心行为）', sawBomb, { aiBombs: G.aiBombs() });
    truth('A3 AI 会主动走位（离开了出生格）', moved, { p2start });
    truth('A3b AI 有进攻欲望（45 秒内逼近到 P1 五格以内）', minDist <= 5, { minDist });
    // 人机局里 P1 没有输入、从不放弹：场上所有糖弹都是 AI 自己的，
    // AI 只要死了就必然是「自己炸死自己」，这条就是防自炸回归的核心断言。
    const sEnd = G.snap();
    truth('A4 神殿 45 秒：AI 没被自己的糖弹炸死', sEnd.players[1].alive === true,
      { phase: sEnd.phase, aiBombs: G.aiBombs(), reachedOver });

    /* ---- 1b 冰原：障碍密一倍、通道窄，最容易把自己困死，同样跑一轮 ---- */
    G.map('ice');
    G.start();
    const bombsIce0 = G.aiBombs();
    let iceOver = false;
    for (let i = 0; i < 1800; i += 40) {        // 最多 15 秒
      G.step(40);
      if (G.snap().phase === 'over') { iceOver = true; break; }
    }
    out.logs.ice = { iceOver, aiBombs: G.aiBombs() };
    truth('A5 冰原上 AI 也有在放弹', G.aiBombs() > bombsIce0, { aiBombs: G.aiBombs() });
    const sIce = G.snap();
    truth('A6 冰原 15 秒：AI 没被自己的糖弹炸死', sIce.players[1].alive === true,
      { phase: sIce.phase, aiBombs: G.aiBombs(), iceOver });

    /* ---- 2 双人模式：P2 不受 AI 控制，静置不动 ---- */
    G.setMode('pvp');
    G.start();
    const p = G.snap();
    truth('B1 双人模式下 P2 不是 AI', p.players[1].isAI === false, p.players[1]);
    const cell0 = p.players[1].cell;
    G.step(600);                                 // 静置 5 秒
    const p1 = G.snap();
    eq('B2 双人模式下 P2 不自动行动', p1.players[1].cell, cell0);
  } catch (e) {
    out.bad.push('异常: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
  }

  document.body.setAttribute('data-diag', JSON.stringify(out));
})();
