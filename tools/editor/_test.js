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

  for (let i = 0; i < 600 && !document.body.dataset.ready; i++) await sleep(10);
  const E = window.__editor;
  if (!E) {
    out.bad.push('页面没有初始化 __editor');
    document.body.setAttribute('data-diag', JSON.stringify(out));
    return;
  }

  const COLS = 21, ROWS = 12;
  const cell = (x, y) => E.rows()[y][x];
  const fcell = (x, y) => E.frows()[y][x];
  const count = ch => E.rows().reduce((n, r) => n + r.split('').filter(c => c === ch).length, 0);

  try {
    /* ================ A 页面骨架 ================ */
    truth('A1 编辑器初始化完成', E.ready());
    truth('A2 素材笔 ≥ 20 个', E.paletteCount() >= 20, E.paletteCount());
    const brushes = [...document.querySelectorAll('#pal .br')];
    truth('A3 素材按钮都渲染出来了', brushes.length === E.paletteCount(),
      [brushes.length, E.paletteCount()]);
    truth('A4 每支笔都有缩略图（橡皮除外）', brushes.every((b, i) => {
      const img = b.querySelector('img');
      return img ? img.src.indexOf('data:image/svg') === 0 : true;
    }), brushes.filter(b => {
      const img = b.querySelector('img');
      return img && img.src.indexOf('data:image/svg') !== 0;
    }).length);
    const cvr = document.getElementById('cv').getBoundingClientRect();
    truth('A5 画布是 21:12', Math.abs(cvr.width / cvr.height - COLS / ROWS) < 0.02,
      [Math.round(cvr.width), Math.round(cvr.height)]);
    truth('A6 地砖素材 9 种', E.floorKeys().length === 9, E.floorKeys().length);

    /* ================ B 落笔 ================ */
    E.newMap('temple');
    eq('B1 新图有边框墙', cell(0, 0), '#');
    eq('B2 新图两个出生点', [cell(1, 1), cell(COLS - 2, ROWS - 2)], ['1', '2']);
    eq('B3 新图内部是空地', cell(5, 5), '.');

    eq('B4 选「石墙」笔', E.brush(1, 0), '石墙');
    E.paint(5, 5);
    eq('B5 落笔后是硬墙', cell(5, 5), '#');
    eq('B6 墙的贴图记进调色板', E.pal()['#'], 'wall-stone');

    E.brush(1, 1);                       // 冰砖墙
    E.paint(6, 5);
    eq('B7 换贴图会整类替换', E.pal()['#'], 'wall-icebrick');
    eq('B8 已有的墙跟着换（只是换图，种类不变）', cell(5, 5), '#');

    E.brush(3, 0);                       // 木箱
    E.paint(7, 7);
    eq('B9 可炸障碍落笔', cell(7, 7), 'c');
    eq('B10 障碍贴图', E.pal()['c'], 'prop-crate');
    E.brush(5, 1);                       // 冰宝箱
    E.paint(8, 7);
    eq('B11 宝箱是独立一类', cell(8, 7), '$');
    E.brush(4, 0);                       // 雪块（可推动 · 可炸）
    E.paint(9, 6);
    eq('B12 雪块单独一类', cell(9, 6), 's');
    eq('B12a 雪块贴图', E.pal()['s'], 'prop-snowblock');
    E.brush(3, 3);                       // 纯色方块 · 朱红
    E.paint(10, 6);
    eq('B12b 纯色方块还是可炸障碍', cell(10, 6), 'c');
    eq('B12c 纯色方块换的是贴图', E.pal()['c'], 'prop-block-red');
    E.brush(6, 0);                       // 雪人（实心装饰）
    E.paint(9, 7);
    eq('B12d 实心装饰单独一类', cell(9, 7), 'd');

    E.brush(0, 7);                       // 冰面地砖
    E.paint(3, 3);
    eq('B13 地面笔只改地面', fcell(3, 3), '7');
    eq('B14 地面笔不动物件', cell(3, 3), '.');

    /* ================ C 出生点 / 橡皮 / 撤销 ================ */
    E.brush(7, 0);                       // 出生点 1
    E.paint(10, 8);
    eq('C1 出生点挪到新格', cell(10, 8), '1');
    eq('C2 旧出生点被清掉', count('1'), 1);
    E.brush(7, 1);                       // 出生点 2
    E.paint(2, 9);
    eq('C3 2 号出生点也只有一个', count('2'), 1);

    E.brush(8, 0);                       // 橡皮
    E.paint(5, 5);
    eq('C4 橡皮擦掉物件', cell(5, 5), '.');

    const beforeUndo = E.rows().slice();
    E.undo();
    const afterUndo = E.rows();
    truth('C5 撤销能还原', afterUndo[5][5] === '#' && JSON.stringify(afterUndo) !== JSON.stringify(beforeUndo),
      [afterUndo[5][5]]);
    E.redo();
    eq('C6 重做回到擦掉之后', E.rows()[5][5], '.');

    /* ================ D 矩形 / 油漆桶 ================ */
    E.newMap('temple');
    E.brush(3, 0);                       // 木箱
    E.tool('rect');
    E.rect(4, 4, 8, 6);
    eq('D1 矩形填满 5×3', count('c'), 15);
    E.tool('fill');
    E.brush(0, 2);                       // 红毯
    const filled = E.fill(1, 1);
    truth('D2 油漆桶铺满一整片地面', filled > 150, filled);
    eq('D3 地面换成了红毯', fcell(15, 9), '2');
    E.tool('brush');
    eq('D4 工具能切回画笔', E.tool('brush'), 'brush');

    /* ================ E 生成器 ================ */
    E.newMap('temple');
    let symOK = false;
    for (let i = 0; i < 6; i++) {
      E.random(true);
      const rows = E.rows();
      let same = true, at = null;
      for (let y = 0; y < ROWS && same; y++) {
        for (let x = 0; x < COLS; x++) {
          const a = rows[y][x], b = rows[ROWS - 1 - y][COLS - 1 - x];
          if (a === '1' || a === '2' || b === '1' || b === '2') continue;   // 两个出生点本来就不是同一个字符
          if (a !== b) { same = false; at = [x, y, a, b]; break; }
        }
      }
      out.logs.sym = at;
      const a = E.analyze();
      if (same && !a.issues.filter(t => t[0] === 'bad').length) { symOK = true; break; }
    }
    truth('E1 对称生成是 180° 中心对称的', symOK);
    const aSym = E.analyze();
    truth('E2 对称生成没有致命问题', !aSym.issues.filter(t => t[0] === 'bad').length, aSym.issues);
    truth('E3 对称生成障碍够多', aSym.c.crate + aSym.c.chest >= 20, aSym.c);

    E.random(false);
    const aFree = E.analyze();
    truth('E4 自由生成没有致命问题', !aFree.issues.filter(t => t[0] === 'bad').length, aFree.issues);
    truth('E5 自由生成障碍够多', aFree.c.crate + aFree.c.chest >= 20, aFree.c);

    E.mirror('x');
    const rx = E.rows();
    let mx = true, at2 = null;
    for (let y = 0; y < ROWS && mx; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const a = rx[y][x], b = rx[y][COLS - 1 - x];
        if (a === '1' || a === '2' || b === '1' || b === '2') continue;
        if (a !== b) { mx = false; at2 = [x, y, a, b]; break; }
      }
    }
    truth('E6 左右镜像生效', mx, at2);

    /* ================ F 校验 ================ */
    E.newMap('temple');
    E.set(10, 5, '.');
    let a2 = E.analyze();
    truth('F1 正常图：出生点齐全', !!a2.s1 && !!a2.s2, [a2.s1, a2.s2]);
    truth('F2 正常图：两人连通', a2.loose.other && a2.strict.other, [a2.loose, a2.strict]);
    E.set(1, 1, '.');                     // 删掉 1 号出生点
    a2 = E.analyze();
    truth('F3 缺出生点会被判为必须修', a2.issues.some(t => t[0] === 'bad'), a2.issues);
    const badge = document.getElementById('chkBadge').textContent;
    truth('F4 校验条会提示', badge.indexOf('修') >= 0 || badge.indexOf('开玩') >= 0, badge);

    /* ================ G 保存 / 地图库 ================ */
    E.delAll();
    E.newMap('ice');
    E.random(true);
    E.open({ v: 1, name: '测试地图', theme: 'ice', drop: 0.6, rows: E.rows(), frows: E.frows(), pal: E.pal() });
    document.getElementById('fName').value = '测试地图';
    const id = E.save(false);
    truth('G1 保存返回 id', !!id, id);
    const lib = E.lib();
    truth('G2 地图库里有了', lib.some(m => m.id === id && m.name === '测试地图'), lib);
    const rawStore = JSON.parse(localStorage.getItem('qqtang.maps.v1'));
    truth('G3 真的写进 localStorage', rawStore.maps.some(m => m.id === id), Object.keys(rawStore));
    truth('G4 库里渲染出了条目', document.querySelectorAll('#libList .item').length === 1,
      document.querySelectorAll('#libList .item').length);

    const j = JSON.parse(E.json());
    eq('G5 导出 JSON 是 21×12', [j.rows.length, j.rows[0].length], [12, 21]);
    truth('G6 JSON 带主题与掉落率', j.theme === 'ice' && j.drop === 0.6, [j.theme, j.drop]);
    truth('G7 JSON 有地面层', Array.isArray(j.frows) && j.frows.length === 12, !!j.frows);

    /* ================ H 导入 / 打开内置 ================ */
    E.delAll();
    const n = E.importJson(JSON.stringify({ v: 1, maps: [j] }));
    eq('H1 导入 1 张', n, 1);
    truth('H2 导入后进了地图库', E.lib().length === 1, E.lib());

    E.openBuiltin('ice');
    const bi = E.rows();
    truth('H3 内置冰原能当模板打开', bi[1][1] === '1' && bi[10][19] === '2', [bi[1][1], bi[10][19]]);
    truth('H4 内置模板有障碍', count('c') + count('$') > 40, count('c') + count('$'));
    truth('H5 打开模板后校验通过', !E.analyze().issues.filter(t => t[0] === 'bad').length,
      E.analyze().issues);

    /* ================ I 铺满地面 ================ */
    E.fillFloor(7);
    eq('I1 铺满后每格都是冰面', E.frows().every(r => r.split('').every(c => c === '7')), true);

    /* ================ J 导出可玩网页 ================ */
    E.newMap('temple');
    E.random(true);
    const html = E.playable();
    truth('J1 导出的网页里带地图数据', html.indexOf('window.__QQTANG_MAPS__') > 0);
    truth('J2 导出的网页有画布', html.indexOf('<canvas id="cv"') > 0);
    truth('J3 素材已内联（没有占位符）', html.indexOf('__SPRITE_DATA__') < 0 && html.indexOf('__CSS__') < 0,
      [html.indexOf('__SPRITE_DATA__'), html.indexOf('__CSS__')]);
    truth('J4 体积像个单文件游戏', html.length > 400000, Math.round(html.length / 1024) + 'KB');
    truth('J5 导出页里没有「地图编辑」按钮', html.indexOf('id="btnEdit"') < 0,
      html.indexOf('id="btnEdit"'));
    out.logs.htmlKB = Math.round(html.length / 1024);

    /* ================ K 画布真的画了东西 ================ */
    const cv = document.getElementById('cv');
    const g2 = cv.getContext('2d');
    const d = g2.getImageData(0, 0, cv.width, cv.height).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 997) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    truth('K1 画布上画出了多种颜色', set.size > 5, set.size);
  } catch (e) {
    out.bad.push('异常: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
  }

  document.body.setAttribute('data-diag', JSON.stringify(out));
})();
