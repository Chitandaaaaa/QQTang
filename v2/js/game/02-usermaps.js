/* =========================================================================
   QQ糖 · 夺宝对决 — 自定义地图（localStorage 地图库 + 格式归一化）
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 自定义地图
     编辑器（本页「地图编辑」模式）把地图存进 localStorage；测试或外部嵌入
     可以用 window.__QQTANG_MAPS__ 注入。这里读出来，接在内置地图后面。

     格式：{ v:1, id, name, theme, drop, rows[], frows[], pal:{'#':..,'P':..,'c':..,'$':..,'d':..} }
     rows 字符： # 硬墙  P 石柱  c 可炸  $ 宝箱  d 装饰（不挡路）  1/2 出生点  . 空地
     frows 字符： FLOOR_KEYS 的下标 '0'..'8'
     pal：给某一类格子换个贴图（比如神殿里摆冰块），不给就用主题默认。 */
  const STORE_KEY = 'qqtang.maps.v1';

  function normalizeMap(raw) {
    if (!raw || !Array.isArray(raw.rows) || raw.rows.length !== ROWS) return null;
    const rows = raw.rows.map(r => {
      let s = String(r == null ? '' : r);
      while (s.length < COLS) s += '.';
      return s.slice(0, COLS).replace(/[^#Pc$sd12.]/g, '.');
    });
    // 出生点各留一个，多余的降级成空地
    let s1 = null, s2 = null;
    for (let y = 0; y < ROWS; y++) {
      let r = rows[y];
      for (let x = 0; x < COLS; x++) {
        const ch = r[x];
        if (ch === '1') { if (s1) r = r.slice(0, x) + '.' + r.slice(x + 1); else s1 = [x, y]; }
        else if (ch === '2') { if (s2) r = r.slice(0, x) + '.' + r.slice(x + 1); else s2 = [x, y]; }
      }
      rows[y] = r;
    }
    if (!s1 || !s2) return null;                 // 没有两个出生点，这张图没法开局

    let frows = null;
    if (Array.isArray(raw.frows) && raw.frows.length === ROWS) {
      frows = raw.frows.map(r => {
        let s = String(r == null ? '' : r);
        while (s.length < COLS) s += '0';
        return s.slice(0, COLS).replace(/[^0-8]/g, '0');
      });
    }

    const base = MAPS.find(m => m.id === raw.theme) || MAPS[0];
    const pal = (raw.pal && typeof raw.pal === 'object') ? raw.pal : {};
    const drop = typeof raw.drop === 'number' ? Math.max(0, Math.min(1, raw.drop)) : base.drop;
    return {
      id: String(raw.id || ('u_' + Math.random().toString(36).slice(2, 8))),
      name: String(raw.name || '自定义地图').slice(0, 18),
      sub: 'CUSTOM', custom: true,
      wall: pal['#'] || base.wall, pillar: pal['P'] || base.pillar,
      crate: pal['c'] || base.crate, urn: base.urn, chest: pal['$'] || base.chest,
      floor: { base: base.floor.base, lane: base.floor.lane, laneX: base.floor.laneX,
               emblemAt: base.floor.emblemAt, emblem: base.floor.emblem,
               speckle: frows ? 0 : base.floor.speckle },
      frows: frows, pal: pal,
      dust: base.dust, dust2: base.dust2, debris: base.debris,
      decor: null,                                 // 自定义地图的装饰全部手摆，不再随机撒
      drop: drop, rows: rows
    };
  }

  function loadUserMaps() {
    const out = [];
    const take = raw => { const m = normalizeMap(raw); if (m) out.push(m); };
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (s) {
        const j = JSON.parse(s);
        const arr = Array.isArray(j) ? j : (j && Array.isArray(j.maps) ? j.maps : []);
        arr.forEach(take);
      }
    } catch (e) { console.warn('自定义地图读取失败', e); }
    if (Array.isArray(window.__QQTANG_MAPS__)) window.__QQTANG_MAPS__.forEach(take);

    const used = {};
    MAPS.forEach(m => { used[m.id] = 1; });
    return out.filter(m => { if (used[m.id]) return false; used[m.id] = 1; return true; });
  }
  loadUserMaps().forEach(m => MAPS.push(m));

  const SPRITES = window.QQ_SPRITES;   // data/sprites.js（tools/build_v2.py 生成）

