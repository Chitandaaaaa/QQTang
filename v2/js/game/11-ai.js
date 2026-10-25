/* =========================================================================
   QQ糖 · 夺宝对决 — AI（规则版）
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- AI（规则版）
     保命优先，然后看身板分档决策。身板 = 吃到的道具数（威力/弹量/速度各算一个）：
       <2（弱） 发育+防御为主；2~5（起势）敢打，顺路捡；≥6（充足）进攻优先只捡很近的；
       ≥8（溢出）进攻最高优先，道具完全无视。
       1) 脚下是危险格（糖弹火焰 / 即将被炸到的范围）→ 立刻逃向最近的绝对安全格；
          真安全格到不了（被困死）→ 退而求其次，往「最晚才被烧到」的格挪，别站着等死。
       2) 否则按 ~0.12s 节流决策：
          - 直线上有敌人（≤ 威力、中间无遮挡）或近处有箱子（≤2 格），
            且模拟放弹后逃得掉 → 放糖弹，并立刻沿逃生方向起步；
            （弱且对手贴身时，逃生终点还必须避开对手火力线 —— 防被补弹封死）
          - 否则沿「计划」游走（计划 0.5~1.2s 才换一次）：
              起势+ 有弹 + 对手够得着 → 压上去（道具按档位顺路捡）；
              够不着                  → 掘进：朝猎杀位把挡路的箱子一块块炸开；
              弱 + 对手逼近(≤5格)     → 撤出对手火力线，发育目标也避开火线；
              其余                     → 吃道具、就近开箱，攒出进攻资本再压上。
     保命铁律（漏了就会「逃」进墙角被自己的糖弹炸死）：
       - BFS 的每一步（包括第一步）都要安检：墙/箱子不是路，马上要炸的格不是路；
       - 糖弹本身是实心的，逃生路线不许从别的糖弹格上穿过去；
       - 危险图把连锁算进去：A 弹先炸到 B 弹，B 的覆盖范围就按 A 的时刻算。
     去抖三件套（以前 0.12s 一换目标，看起来在原地左右横跳）：
       - 游走目标用「计划」锁 0.5~1.2s，不每拍重选；
       - BFS 同分时优先展开/保持当前方向（opts.keep），不轻易掉头；
       - 兜底走位排除回头路。 */

  // 危险图：danger[y][x] = 这格还有多少秒会被火焰覆盖（Infinity = 永远安全）
  function aiDangerMap(extra) {
    const d = [];
    for (let y = 0; y < ROWS; y++) d.push(new Array(COLS).fill(Infinity));
    const bombs = [];
    const take = b => bombs.push({ x: b.x, y: b.y, t: b.fuseLeft, cells: blastCells(b) });
    for (const b of state.bombs) if (!b.dead) take(b);
    if (extra) take(extra);
    // 连锁传播：别的弹会提前引爆这颗，这颗就跟着那一炸提前响（炸到糖弹是同帧全响）
    for (let changed = true; changed;) {
      changed = false;
      for (const b of bombs) for (const o of bombs) {
        if (o === b || o.t >= b.t) continue;
        if (o.cells.some(cc => cc.x === b.x && cc.y === b.y)) { b.t = o.t; changed = true; }
      }
    }
    for (const b of bombs) for (const c of b.cells) if (b.t < d[c.y][c.x]) d[c.y][c.x] = b.t;
    for (const f of state.flames) d[f.y][f.x] = 0;   // 正在烧 = 立刻死
    return d;
  }

  // 这格现在能不能落脚（实心/障碍/糖弹一律不行；危险但还早、来得及走到的可以过）
  // soft：掘进模式 —— 可炸障碍算「能过」（它们马上就会被炸开），用来找该去炸哪块
  function aiPassable(d, x, y, stepT, margin, soft) {
    if (!inside(x, y)) return false;
    const v = state.tiles[y][x];
    if (v === WALL || v === PILLAR || v === DECOR) return false;
    if (v !== EMPTY && !soft) return false;
    if (bombAt(x, y)) return false;
    return d[y][x] > stepT + margin;
  }

  // 从 start BFS，返回起步方向：给 isGoal 就找第一个满足的格（已在目标返回 ''，无路 null）；
  // 给 opts.score 就不提前返回，扫完可达格后返回得分最高的一格（平分取更近的）。
  // opts.keep：去抖 —— 同分/同深度的候选里优先保持这个方向，别左右横跳。
  // opts.soft：可炸障碍当路走（掘进搜索专用）；opts.path：连带返回完整路径。
  function aiBFS(start, danger, isGoal, opts) {
    opts = opts || {};
    const margin = opts.margin == null ? 0.25 : opts.margin;
    const maxSteps = opts.maxSteps || 60;
    const score = opts.score, keep = opts.keep && DIRS[opts.keep] ? opts.keep : null;
    const soft = !!opts.soft, startKey = start.x + ',' + start.y;
    if (!score && isGoal && isGoal(start)) return { dir: '', goal: start, path: [start] };
    // 把 keep 方向排在最前展开：多个目标一样近时，优先走上「正在走的方向」
    const order = keep ? [keep].concat(Object.keys(DIRS).filter(n => n !== keep))
                       : Object.keys(DIRS);
    const q = [{ x: start.x, y: start.y, t: 0, dir: '', k: startKey }];
    const seen = new Set([startKey]);
    const prev = opts.path ? new Map() : null;
    let head = 0, best = null, bestS = -Infinity;
    if (score) bestS = score(start);
    while (head < q.length) {
      const cur = q[head++];
      if (cur.t >= maxSteps) break;
      for (const name of order) {
        const dd = DIRS[name];
        const nx = cur.x + dd[0], ny = cur.y + dd[1], key = nx + ',' + ny;
        if (seen.has(key)) continue;
        // 第一步也照查：墙/箱子/糖弹/来不及的火格都不是路 —— 不查就会「逃」进墙角等死
        if (!aiPassable(danger, nx, ny, cur.t + STEP, margin, soft)) continue;
        seen.add(key);
        if (prev) prev.set(key, cur.k);
        const nt = cur.t + STEP, first = cur.dir || name, cell = { x: nx, y: ny };
        if (score) {
          const s = score(cell);
          if (s > bestS) { bestS = s; best = { dir: first, goal: cell }; }
        } else if (isGoal(cell)) {
          let path = null;
          if (prev) {
            path = [];
            for (let k = key; k !== startKey; k = prev.get(k)) {
              const [px, py] = k.split(',').map(Number);
              path.push({ x: px, y: py });
            }
            path.push({ x: start.x, y: start.y });
            path.reverse();
          }
          return { dir: first, goal: cell, path };
        }
        q.push({ x: nx, y: ny, t: nt, dir: first, k: key });
      }
    }
    return score ? best : null;
  }

  // 进攻：直线上有敌人（距离 ≤ 威力、中间无实心遮挡）→ 放弹；近处（≤2 格）有
  // 可炸障碍也顺手开花。远处的箱子不炸 —— 跑过去炸再折返，看起来就是在原地打转。
  function aiTryAttack(p, danger) {
    if (p.bombsOut >= p.maxBombs) return false;
    const c = pCell(p);
    if (bombAt(c.x, c.y)) return false;
    let hits = false;
    for (const name in DIRS) {
      const dd = DIRS[name];
      for (let i = 1; i <= p.power; i++) {
        const x = c.x + dd[0] * i, y = c.y + dd[1] * i;
        if (!inside(x, y)) break;
        const v = state.tiles[y][x];
        if (v === WALL || v === PILLAR || v === DECOR) break;
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) {
          if (i <= 2) hits = true;
          break;
        }
        // 这条直线上的敌人（没被实心格挡住）是头号目标，多远都值得炸
        for (const o of state.players) {
          if (o !== p && o.alive && pCellX(o) === x && pCellY(o) === y) { hits = true; break; }
        }
        if (hits) break;
      }
      if (hits) break;
    }
    if (!hits) return false;
    // 模拟放弹：脚下变危险（含被别的弹连锁提前引爆）后，是否还能走到真正安全的格。
    // 弱且对手贴身时，逃生终点还得避开对手的火力线 —— 不然弹刚放下，
    // 对手再补一颗就把自己封死在逃生路上（被炮弹堵死）。
    const foe = state.players.find(o => o !== p && o.alive);
    const defensive = !!foe && grownOf(p) < GROWN_ATTACK && nearFoe(c, foe);
    const threat = defensive ? aiThreatMap(p) : null;
    const sim = { x: c.x, y: c.y, power: p.power, fuseLeft: FUSE, owner: p, dead: false };
    const d2 = aiDangerMap(sim);
    const r = aiBFS(c, d2,
      cell => d2[cell.y][cell.x] === Infinity && (!threat || !threat[cell.y][cell.x]),
      { maxSteps: p.power + 3, keep: p.aiDir });
    if (!r) return false;            // 逃不掉就不炸，保命优先
    if (placeBomb(p)) p.aiDir = r.dir;   // 立刻按逃生路线起步，下一帧危险图接管接着逃
    return true;
  }

  // (x1,y1)→(x2,y2) 同行/列时，中间有没有实心格挡着（不含两端）
  function aiLineClear(x1, y1, x2, y2) {
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
    let x = x1 + dx, y = y1 + dy;
    while (x !== x2 || y !== y2) {
      if (state.tiles[y][x] !== EMPTY) return false;
      x += dx; y += dy;
    }
    return true;
  }

  // 身板：吃到的道具数，分三档（威力/弹量/速度各算一个）：
  //   < GROWN_ATTACK(2)   弱   —— 发育和防御优先，不主动找打；
  //   ≥ GROWN_FULL(6)     充足 —— 进攻优先，只顺路捡很近（≤2 步）的道具；
  //   ≥ GROWN_OVERFLOW(8) 溢出 —— 进攻最高优先，道具直接无视。
  //   中间档（2~5）       起势 —— 敢打，顺路 ≤3 步的道具顺手捡。
  const GROWN_ATTACK = 2;
  const GROWN_FULL = 6;
  const GROWN_OVERFLOW = 8;
  const grownOf = p => (p.power - 1) + (p.maxBombs - 1) + (p.spd - 1);
  const nearFoe = (c, foe) =>
    Math.max(Math.abs(c.x - pCellX(foe)), Math.abs(c.y - pCellY(foe))) <= 5;

  // 对手威胁图：对手现在就能炸到的格 —— 同行/列 ≤ 对手威力且中间无遮挡的火线，
  // 加上对手脚下和贴身格（贴脸放弹首当其冲）。威胁是「随时可能成真」的：
  // 弱的时候别站在线上，不然对手补一颗糖弹就把你堵死在原地。
  function aiThreatMap(p) {
    const t = [];
    for (let y = 0; y < ROWS; y++) t.push(new Array(COLS).fill(0));
    for (const o of state.players) {
      if (o === p || !o.alive) continue;
      const fx = pCellX(o), fy = pCellY(o);
      t[fy][fx] = 1;
      for (const name in DIRS) {
        const dd = DIRS[name];
        const nx = fx + dd[0], ny = fy + dd[1];      // 贴身格
        if (inside(nx, ny)) t[ny][nx] = 1;
        for (let i = 1; i <= o.power; i++) {         // 火线
          const x = fx + dd[0] * i, y = fy + dd[1] * i;
          if (!inside(x, y)) break;
          const v = state.tiles[y][x];
          if (v === WALL || v === PILLAR || v === DECOR) break;
          t[y][x] = 1;
          if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) break;
        }
      }
    }
    return t;
  }

  // 猎杀位：和敌人同行/列、距离 1..power、中间无遮挡 —— 站上去就能炸到人
  function aiKillCellFn(p, foe) {
    const fc = pCell(foe);
    return cell => {
      const dx = Math.abs(cell.x - fc.x), dy = Math.abs(cell.y - fc.y);
      if (dx > 0 && dy > 0) return false;               // 必须同行或同列
      const dist = dx + dy;
      return dist >= 1 && dist <= p.power && aiLineClear(cell.x, cell.y, fc.x, fc.y);
    };
  }

  // 计划还有效吗：过期 / 目标没了（道具被吃、箱子被开、敌人死了）都算失效
  function aiPlanValid(p, plan) {
    if (!plan || state.time > plan.until) return false;
    if (plan.kind === 'evade') return true;     // 撤离目标随对手移动，短时限内认了
    if (plan.kind === 'item') return state.powerups.some(pu => pu.x === plan.x && pu.y === plan.y);
    if (plan.kind === 'hunt') return state.players.some(o => o !== p && o.alive);
    if (plan.kind === 'tunnel') {
      const row = state.tiles[plan.ty];
      const v = row ? row[plan.tx] : WALL;
      return v === CRATE || v === AMPHORA || v === CHEST || v === PUSH;
    }
    if (plan.kind === 'crate') {
      for (const name in DIRS) {
        const dd = DIRS[name], x = plan.x + dd[0], y = plan.y + dd[1];
        if (!inside(x, y)) continue;
        const v = state.tiles[y][x];
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) return true;
      }
      return false;
    }
    return false;
  }

  // 定个新计划。先看身板分档：「溢出只管打，充足少捡点，起势顺手捡，没吃够别找打」——
  //   弱（道具 < GROWN_ATTACK）+ 对手近：
  //     站在对手火线/贴身区 → 先撤离（evade）；没在线上 → 发育但目标避开火线。
  //   起势及以上（≥ GROWN_ATTACK）+ 有弹：
  //     对手够得着（走得到猎杀位）→ 压上去开火；道具按档位顺路捡；
  //     够不着 → 掘进：把可炸障碍当软路，朝猎杀位一段一段炸过去；
  //     掘进也无路 → 充足及以下捡道具发育，溢出无视道具去开箱开路。
  //   其余（弱且对手远 / 手里没弹）→ 发育：吃道具 → 就近开箱。
  function aiPickPlan(p, danger) {
    const c = pCell(p);
    const onItem = cell => state.powerups.some(pu => pu.x === cell.x && pu.y === cell.y);
    const nearCrate = cell => {
      for (const name in DIRS) {
        const dd = DIRS[name], x = cell.x + dd[0], y = cell.y + dd[1];
        if (!inside(x, y)) continue;
        const v = state.tiles[y][x];
        if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) return true;
      }
      return false;
    };
    const foe = state.players.find(o => o !== p && o.alive);
    const stamp = kind =>
      ({ kind, until: state.time + (kind === 'hunt' || kind === 'evade' ? 0.5 : 1.2) });

    // —— 弱且被逼近：防御 + 躲着发育 ——
    if (foe && grownOf(p) < GROWN_ATTACK && nearFoe(c, foe)) {
      const threat = aiThreatMap(p);
      if (threat[c.y][c.x]) {
        const re = aiBFS(c, danger, cell => !threat[cell.y][cell.x], { maxSteps: 20 });
        if (re && re.goal) return Object.assign(stamp('evade'), { x: re.goal.x, y: re.goal.y });
      }
      const safeItem = cell => onItem(cell) && !threat[cell.y][cell.x];
      let r = aiBFS(c, danger, safeItem, { maxSteps: 30 });
      if (!r) r = aiBFS(c, danger, onItem, { maxSteps: 30 });     // 实在没有安全的，饿着不如冒险
      if (r && r.goal) return Object.assign(stamp('item'), { x: r.goal.x, y: r.goal.y });
      const safeCrate = cell => nearCrate(cell) && !threat[cell.y][cell.x];
      r = aiBFS(c, danger, safeCrate, { maxSteps: 30 });
      if (!r) r = aiBFS(c, danger, nearCrate, { maxSteps: 30 });
      if (r && r.goal) return Object.assign(stamp('crate'), { x: r.goal.x, y: r.goal.y });
      return null;
    }

    // —— 强：找打。身板越厚越不管道具：
    //     2~5 顺路 ≤3 步捡；6~7（充足）只捡 ≤2 步的；≥8（溢出）完全无视 ——
    //     对手够得着就压上，够不着就朝它掘进；掘进也无路时：
    //     充足及以下去捡道具发育，溢出去开箱开路（照样不捡道具）。 ——
    if (foe && p.bombsOut < p.maxBombs && grownOf(p) >= GROWN_ATTACK) {
      const grown = grownOf(p);
      const detour = grown >= GROWN_OVERFLOW ? 0 : grown >= GROWN_FULL ? 2 : 3;
      const r = aiBFS(c, danger, aiKillCellFn(p, foe), { maxSteps: 60 });
      if (r && r.goal) {
        if (detour) {
          const ri = aiBFS(c, danger, onItem, { maxSteps: detour });
          if (ri && ri.goal) return Object.assign(stamp('item'), { x: ri.goal.x, y: ri.goal.y });
        }
        return Object.assign(stamp('hunt'), { x: r.goal.x, y: r.goal.y });
      }
      // 掘进：软搜索（箱子当路）找到通往猎杀位的方向，炸开第一块挡路的
      const rt = aiBFS(c, danger, aiKillCellFn(p, foe), { maxSteps: 60, soft: true, path: true });
      if (rt && rt.path) {
        for (let i = 1; i < rt.path.length; i++) {
          const cell = rt.path[i];
          const v = state.tiles[cell.y][cell.x];
          if (v === CRATE || v === AMPHORA || v === CHEST || v === PUSH) {
            const spot = rt.path[i - 1];   // 箱子在路径上的前一格：站上去就炸得到它
            return { kind: 'tunnel', x: spot.x, y: spot.y, tx: cell.x, ty: cell.y,
                     until: state.time + 0.6 };
          }
        }
      }
      // 掘进也无路（对手被硬墙彻底封死）
      if (grown >= GROWN_OVERFLOW) {
        const rc = aiBFS(c, danger, nearCrate, { maxSteps: 30 });
        if (rc && rc.goal) return Object.assign(stamp('crate'), { x: rc.goal.x, y: rc.goal.y });
        return null;
      }
    }

    // —— 发育 ——
    let r = aiBFS(c, danger, onItem, { maxSteps: 30 });
    if (r && r.goal) return Object.assign(stamp('item'), { x: r.goal.x, y: r.goal.y });
    r = aiBFS(c, danger, nearCrate, { maxSteps: 30 });
    if (r && r.goal) return Object.assign(stamp('crate'), { x: r.goal.x, y: r.goal.y });
    return null;
  }

  // 游走：沿当前计划走。计划 ~0.5~1.2s 才换一次（目标不抖，路线才不抖），
  // 路被堵死就丢弃计划，下一拍重新定。真没目标就挑个不掉头的安全邻居走走。
  function aiWander(p, danger) {
    const c = pCell(p);
    if (!aiPlanValid(p, p.aiPlan)) p.aiPlan = aiPickPlan(p, danger);
    const plan = p.aiPlan;
    if (plan) {
      // maxSteps 60：掘进/压上可能要横穿整张地图，别半路把计划饿死
      const r = aiBFS(c, danger, cell => cell.x === plan.x && cell.y === plan.y,
        { maxSteps: 60, keep: p.aiDir });
      if (r) return r.dir;                // 到位时 r.dir 是 ''：站住，等进攻节拍开火
      p.aiPlan = null;                    // 路被堵/目标没了，下一拍重定
    }
    // 兜底：随便挑个安全邻居走走，但别掉头 —— 掉头就是在原地画龙
    const back = OPP[p.aiDir];
    let pick = '';
    for (const name in DIRS) {
      if (name === back) continue;
      const dd = DIRS[name];
      if (aiPassable(danger, c.x + dd[0], c.y + dd[1], STEP, 0.25)) { pick = name; break; }
    }
    if (!pick && back) {
      const dd = DIRS[back];
      if (aiPassable(danger, c.x + dd[0], c.y + dd[1], STEP, 0.25)) pick = back;
    }
    return pick;
  }

  // 每帧给 AI 玩家算一次方向（逃命每帧都算，进攻/游走按节流）
  function aiUpdate(p, dt) {
    if (!p.alive) { p.aiDir = ''; return; }
    const c = pCell(p);
    const danger = aiDangerMap();
    // 1) 脚下危险 → 逃：优先去绝对安全的格；到不了就往「最晚被烧到」的格挪
    if (danger[c.y][c.x] !== Infinity) {
      const r = aiBFS(c, danger, null,
        { maxSteps: 40, score: cell => danger[cell.y][cell.x], keep: p.aiDir });
      p.aiDir = r ? r.dir : '';
      p.aiTimer = 0;
      p.aiPlan = null;                    // 局势变了，脱险后重新规划
      return;
    }
    // 2) 节流决策
    p.aiTimer -= dt;
    if (p.aiTimer > 0) return;
    p.aiTimer = 0.12;
    if (aiTryAttack(p, danger)) return;   // 有把握（敌人在直线火力上）就开火
    p.aiDir = aiWander(p, danger) || '';
  }

