/* =========================================================================
   QQ糖 · 人物规格面板 — 渲染与交互
   数据由 tools/build_v2.py 生成：data/spec-data.js（window.QQ_SPEC）
   原人物规格页（build_sheet_all）的卡片 / 排排站 / 剪影逻辑移植至此。
   ========================================================================= */
'use strict';
(function () {
  const SPEC = window.QQ_SPEC || { chars: [], shared: [] };
  const panel = document.getElementById('specPanel');
  if (!panel) return;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function palList(pairs) {
    return pairs.map(p => '<li><i style="background:' + p[0] + '"></i><b>' + esc(p[1]) +
      '</b><span>' + p[0] + '</span></li>').join('');
  }

  /* ---------- 角色段 ---------- */
  function cardHTML(view) {
    return '<article class="card" data-file="' + view.file + '.svg">' +
      '<div class="stage" style="--s:32"><div class="pix">' + view.svg + '</div></div>' +
      '<div class="meta"><h4>' + esc(view.name) + ' <span class="dim">32×32</span></h4>' +
      '<p>' + esc(view.note) + '</p>' +
      '<div class="row"><button data-copy type="button">复制 SVG</button>' +
      '<button data-save type="button">下载 .svg</button></div></div></article>';
  }

  document.getElementById('specSections').innerHTML = SPEC.chars.map(ch =>
    '<section class="char" id="' + ch.key + '">' +
    '<div class="char-head"><div class="num">' + ch.num + '</div>' +
    '<div class="who"><h3>' + esc(ch.name) + ' <span class="role">' + esc(ch.role) + '</span></h3>' +
    '<p>' + esc(ch.desc) + '</p></div>' +
    '<ul class="pal">' + palList(ch.pal) + '</ul></div>' +
    '<div class="views">' + ch.views.map(cardHTML).join('') + '</div></section>'
  ).join('');

  /* ---------- 排排站（克隆卡片里的 svg，永远同步） ---------- */
  function lane(views, label) {
    return '<div class="lane"><span class="lane-label">' + label + '</span><div class="floor">' +
      views.map((f, i) => '<div class="slot" style="left:' + (i * 96) + 'px" data-clone="' + f +
        '"><b></b></div>').join('') + '</div></div>';
  }
  document.getElementById('lineupBox').innerHTML =
    lane(SPEC.chars.map(c => c.views[0].file), '正面 · 四角色') +
    lane(SPEC.chars.map(c => c.views[1].file), '侧面 · 四角色');
  panel.querySelectorAll('[data-clone]').forEach(slot => {
    const src = panel.querySelector('[data-file="' + slot.dataset.clone + '.svg"] svg');
    if (src) slot.insertBefore(src.cloneNode(true), slot.firstChild);
  });

  /* ---------- 共用底色 ---------- */
  document.getElementById('specShared').innerHTML = palList(SPEC.shared || []);

  /* ---------- 缩放（--z 挂在面板上，不污染页面） ---------- */
  panel.querySelectorAll('.zoom button').forEach(b => {
    b.addEventListener('click', () => {
      panel.querySelectorAll('.zoom button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      panel.style.setProperty('--z', b.dataset.z);
    });
  });

  /* ---------- 剪影模式 ---------- */
  const sil = document.getElementById('sil');
  sil.addEventListener('click', () => {
    panel.classList.toggle('sil');
    sil.classList.toggle('on', panel.classList.contains('sil'));
  });

  /* ---------- 复制 / 下载 ---------- */
  function svgCode(card) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + card.querySelector('svg').outerHTML;
  }
  function ping(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('on'), 1600);
  }
  function fallbackCopy(code) {
    const ta = document.createElement('textarea');
    ta.value = code; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); ping('SVG 代码已复制');
  }
  panel.querySelectorAll('.card').forEach(card => {
    card.querySelector('[data-copy]').addEventListener('click', () => {
      const code = svgCode(card);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => ping('SVG 代码已复制'), () => fallbackCopy(code));
      } else fallbackCopy(code);
    });
    card.querySelector('[data-save]').addEventListener('click', () => {
      const blob = new Blob([svgCode(card)], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = card.dataset.file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      ping('已下载 ' + card.dataset.file);
    });
  });
})();
