/* =========================================================================
   QQ糖 · 夺宝素材库 — 页面逻辑
   数据由 tools/build_v2.py 生成：data/gallery-data.js（window.QQ_GALLERY）
   ========================================================================= */
'use strict';
const GALL = window.QQ_GALLERY || { cats: [], assets: [], scene: '' };
const CATS = GALL.cats;
const ASSETS = GALL.assets;

/* ---------- 渲染 ---------- */
const navEl = document.getElementById('nav');
const groupsEl = document.getElementById('groups');
const state = { cat: 'all', q: '' };

function countOf(cat){ return ASSETS.filter(a => cat === 'all' || a.cat === cat).length; }

function buildNav(){
  const items = [{id:'all', name:'全部素材', desc:'整套 v1'}, ...CATS];
  navEl.innerHTML = items.map(c => `
    <button data-cat="${c.id}" class="${state.cat===c.id?'on':''}">
      <span class="dot"></span>${c.name}<span class="n">${countOf(c.id)}</span>
    </button>`).join('');
  navEl.querySelectorAll('button').forEach(b => b.onclick = () => {
    state.cat = b.dataset.cat; buildNav(); render();
  });
}

function match(a){
  const q = state.q.trim().toLowerCase();
  if (state.cat !== 'all' && a.cat !== state.cat) return false;
  if (!q) return true;
  return (a.name + ' ' + a.id + ' ' + a.cat).toLowerCase().includes(q);
}

function cardHTML(a){
  const tileCls = (a.w === 32 && a.h === 32) ? ' tile' : '';
  const sc = Math.max(1, Math.floor(100 / Math.max(a.w, a.h)));
  return `<button class="card${tileCls}" data-id="${a.id}">
    <div class="thumb">${a.svg.replace(/width="\d+" height="\d+"/,
      `width="${a.w * sc}" height="${a.h * sc}"`)}</div>
    <div class="info">
      <div>
        <div class="nm">${a.name}</div>
        <div class="id">${a.id}</div>
      </div>
      <div class="sz">${a.w}×${a.h}</div>
    </div>
    ${a.note ? `<div class="badge">${a.note}</div>` : ''}
    ${a.tags && a.tags.length ? `<div class="tags">${a.tags.map(t =>
        `<span class="chip ${t[1]}">${t[0]}</span>`).join('')}</div>` : ''}
  </button>`;
}

function render(){
  const list = ASSETS.filter(match);
  if (!list.length){
    groupsEl.innerHTML = '<div class="empty">没有匹配的素材，试试别的关键词。</div>';
    return;
  }
  const cats = state.cat === 'all' ? CATS : CATS.filter(c => c.id === state.cat);
  let html = '';
  for (const c of cats){
    const items = list.filter(a => a.cat === c.id);
    if (!items.length) continue;
    html += `<section class="group">
      <div class="group-h">
        <h2>${c.name}</h2><span class="c">${items.length}</span>
        <span class="d">${c.desc}</span><span class="line"></span>
      </div>
      <div class="grid">${items.map(cardHTML).join('')}</div>
    </section>`;
  }
  groupsEl.innerHTML = html;
  groupsEl.querySelectorAll('.card').forEach(el => {
    el.onclick = () => openAsset(el.dataset.id);
  });
}

/* ---------- 详情 ---------- */
const modal = document.getElementById('modal');
let current = null, zoom = 4;
const $ = id => document.getElementById(id);

function openAsset(id){
  const a = ASSETS.find(x => x.id === id);
  if (!a) return;
  current = a;
  zoom = Math.min(8, Math.max(2, Math.round(240 / Math.max(a.w, a.h))));
  $('m-name').textContent = a.name;
  $('m-id').textContent = a.id + (a.note ? '  ·  ' + a.note : '');
  const tg = a.tags || [];
  $('m-tags').innerHTML = tg.map(t =>
    `<span class="chip ${t[1]}">${t[0]}</span>`).join('');
  $('m-tags').style.display = tg.length ? '' : 'none';
  $('m-cat').textContent = (CATS.find(c => c.id === a.cat) || {}).name || a.cat;
  $('m-size').textContent = a.w + ' × ' + a.h;
  $('m-grid').textContent = a.w + ' × ' + a.h + ' units';
  $('m-ncol').textContent = a.pal.length + ' 色';
  $('m-pal').innerHTML = a.pal.map(c =>
    `<div class="sw" style="background:${c}" data-c="${c}"><span>${c}</span></div>`).join('');
  $('m-pal').querySelectorAll('.sw').forEach(s => s.onclick = () => {
    copyText(s.dataset.c); toast('已复制 ' + s.dataset.c);
  });
  $('m-src').textContent = a.src || '—';
  $('m-code').textContent = a.svg.replace(/></g, '>\n<');
  $('m-tiling').classList.toggle('on', false);
  $('m-tile').classList.toggle('on', false);
  $('m-preview').style.display = '';
  paint();
  modal.classList.add('on');
}

function paint(){
  const a = current;
  const s = a.svg.replace(/width="[\d.]+" height="[\d.]+"/,
    `width="${a.w * zoom}" height="${a.h * zoom}"`);
  $('m-preview').innerHTML = s;
}

$('m-zoom').querySelectorAll('button').forEach(b => b.onclick = () => {
  $('m-zoom').querySelectorAll('button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); zoom = +b.dataset.z; paint();
});
$('m-close').onclick = closeModal;
modal.onclick = e => { if (e.target === modal) closeModal(); };
function closeModal(){ modal.classList.remove('on'); current = null; }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (!current) return;
  const list = ASSETS.filter(match);
  const i = list.findIndex(x => x.id === current.id);
  if (e.key === 'ArrowRight' && i >= 0) openAsset(list[(i + 1) % list.length].id);
  if (e.key === 'ArrowLeft' && i >= 0) openAsset(list[(i - 1 + list.length) % list.length].id);
});

/* ---------- 拼接预览 ---------- */
$('m-tile').onclick = () => {
  const a = current; if (!a) return;
  const on = $('m-tiling').classList.toggle('on');
  $('m-tile').classList.toggle('on', on);
  $('m-preview').style.display = on ? 'none' : '';
  if (on){
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
    $('m-tiling').style.background = `url("${uri}") 0 0/64px 64px repeat`;
    $('m-tiling').style.imageRendering = 'pixelated';
  }
};

/* ---------- 下载 / 复制 ---------- */
function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 1600);
}
function copyText(txt){
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
  else {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}
function download(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
$('m-copy').onclick = () => { if (current){ copyText(current.svg); toast('SVG 已复制'); } };
$('m-svg').onclick = () => {
  if (!current) return;
  download(new Blob([current.svg], {type:'image/svg+xml'}), current.id + '.svg');
  toast('已下载 ' + current.id + '.svg');
};
$('m-png').onclick = () => {
  const a = current; if (!a) return;
  const scale = 8;
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = a.w * scale; cv.height = a.h * scale;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob(b => { download(b, a.id + '@' + scale + 'x.png'); toast('已下载 PNG (8×)'); }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
};

/* ---------- 导出 ---------- */
$('btn-json').onclick = () => {
  const manifest = {
    name: 'QQTang 夺宝素材库', version: 'v1', count: ASSETS.length,
    categories: CATS.map(c => ({id:c.id, name:c.name, desc:c.desc, count:countOf(c.id)})),
    assets: ASSETS.map(a => ({id:a.id, name:a.name, cat:a.cat, w:a.w, h:a.h, src:a.src, palette:a.pal})),
  };
  download(new Blob([JSON.stringify(manifest, null, 2)], {type:'application/json'}), 'sucai-manifest.json');
  toast('清单已导出');
};
$('btn-sprite').onclick = () => {
  const syms = ASSETS.map(a => {
    const inner = a.svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
    return `<symbol id="${a.id}" viewBox="0 0 ${a.w} ${a.h}" shape-rendering="crispEdges">${inner}</symbol>`;
  }).join('');
  const out = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" shape-rendering="crispEdges">${syms}</svg>`;
  download(new Blob([out], {type:'image/svg+xml'}), 'sucai-sprite.svg');
  toast('精灵图已导出 · 用 <use href="#id"> 引用');
};

/* ---------- 底色 ---------- */
const stage = $('m-stage');
document.getElementById('bgswitch').querySelectorAll('button').forEach(b => b.onclick = () => {
  document.getElementById('bgswitch').querySelectorAll('button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  document.body.dataset.bg = b.dataset.bg;
  stage.className = 'stage' + (b.dataset.bg === 'night' ? ' night' : (b.dataset.bg === 'sand' ? ' sand' : ''));
});

/* ---------- 搜索 ---------- */
document.getElementById('q').oninput = e => { state.q = e.target.value; render(); };

/* ---------- 场景横幅与计数（构建生成） ---------- */
document.getElementById('sceneSlot').innerHTML = GALL.scene || '';
document.getElementById('galCount').textContent = ASSETS.length;

/* ---------- 页签：素材库 / 人物规格 ---------- */
const tabAssets = document.getElementById('tabAssets');
const tabSpec = document.getElementById('tabSpec');
const shellEl = document.querySelector('.shell');
const specPanel = document.getElementById('specPanel');
function showTab(spec) {
  tabAssets.classList.toggle('on', !spec);
  tabSpec.classList.toggle('on', spec);
  shellEl.style.display = spec ? 'none' : '';
  specPanel.hidden = !spec;
}
tabAssets.onclick = () => showTab(false);
tabSpec.onclick = () => showTab(true);

buildNav(); render();
