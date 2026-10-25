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

  /* 等数据文件与首屏渲染（gallery.js 在脚本尾部同步 render） */
  for (let i = 0; i < 300 && !document.querySelectorAll('#groups .card').length; i++) await sleep(20);

  try {
    const G = window.QQ_GALLERY, S = window.QQ_SPEC;

    /* ---- 1 数据与首屏 ---- */
    truth('G1 数据文件加载', !!G && G.assets.length > 0 && G.cats.length >= 6,
      G && [G.cats.length, G.assets.length]);
    const cards = document.querySelectorAll('#groups .card');
    eq('G2 卡片数=素材数', cards.length, G.assets.length);
    truth('G3 场景横幅已注入', !!document.getElementById('sceneSlot').querySelector('svg'));
    eq('G4 计数已填', document.getElementById('galCount').textContent, String(G.assets.length));
    eq('G5 分类导航=分类+全部', document.querySelectorAll('#nav button').length, G.cats.length + 1);

    /* ---- 2 详情弹层 ---- */
    cards[0].click();
    truth('G6 详情弹层打开', document.getElementById('modal').classList.contains('on'));
    truth('G7 详情里有 SVG 预览', !!document.getElementById('m-preview').querySelector('svg'));
    document.getElementById('m-close').click();
    truth('G8 弹层已关', !document.getElementById('modal').classList.contains('on'));

    /* ---- 3 搜索过滤 ---- */
    const q = document.getElementById('q');
    q.value = 'zelda';
    q.dispatchEvent(new Event('input'));
    const hit = document.querySelectorAll('#groups .card').length;
    truth('G9 搜索过滤生效', hit > 0 && hit < cards.length, hit);
    q.value = '';
    q.dispatchEvent(new Event('input'));

    /* ---- 4 人物规格页签 ---- */
    document.getElementById('tabSpec').click();
    truth('G10 规格面板显示', !document.getElementById('specPanel').hidden);
    eq('G11 四角色段', document.querySelectorAll('#specSections .char').length, S.chars.length);
    eq('G12 12 张视图卡', document.querySelectorAll('#specSections .card').length, 12);
    eq('G13 排排站 8 个位', document.querySelectorAll('#lineupBox .slot').length, 8);
    eq('G14 排排站克隆出 svg', document.querySelectorAll('#lineupBox .slot svg').length, 8);
    eq('G15 共用底色 9 色', document.querySelectorAll('#specShared li').length, 9);

    truth('G17 返回游戏链接', !!document.querySelector('.top-actions a[href="index.html"]'));

    /* ---- 5 切回素材库 ---- */
    document.getElementById('tabAssets').click();
    truth('G16 切回素材库', document.getElementById('specPanel').hidden &&
      document.querySelector('.shell').style.display !== 'none');
  } catch (e) {
    out.bad.push('异常: ' + e.message);
  }

  document.body.setAttribute('data-diag', JSON.stringify(out));
})();
