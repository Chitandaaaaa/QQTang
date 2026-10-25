# -*- coding: utf-8 -*-
"""生成 QQ糖 人物规格页（四角色 × 三视图 + 排排站 / 剪影模式）
地图与炮弹素材在 QQTang-sucai-v1.html（build_sucai.py），不再放这一页。
运行：python build_sheet_all.py
"""
import os

import build_assets as B
import build_sheet_chars as S

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)


# ---------------------------------------------------------------- 卡片
def char_card(key, title, sub, svg, dim=32):
    return """
      <article class="card" data-file="%(key)s.svg">
        <div class="stage" style="--s:%(dim)d">
          <div class="pix">%(svg)s</div>
        </div>
        <div class="meta">
          <h4>%(title)s <span class="dim">%(dim)d×%(dim)d</span></h4>
          <p>%(sub)s</p>
          <div class="row">
            <button data-copy>复制 SVG</button>
            <button data-save>下载 .svg</button>
          </div>
        </div>
      </article>""" % dict(key=key, title=title, sub=sub, svg=svg, dim=dim)


def pal_list(pairs):
    return ''.join('<li><i style="background:%s"></i><b>%s</b><span>%s</span></li>'
                   % (B.PAL[c], name, B.PAL[c]) for c, name in pairs)


def lineup_row(views, label):
    slots = []
    for i, ch in enumerate(S.CHARS):
        fkey = S.FILES[ch['key']][views]
        slots.append('<div class="slot" style="left:%dpx" data-clone="%s.svg"><b>%s</b></div>'
                     % (i * 96, fkey, ch['name']))
    return """
    <div class="lane">
      <span class="lane-label">%s</span>
      <div class="floor">%s</div>
    </div>""" % (label, ''.join(slots))


# ---------------------------------------------------------------- 组装
def main():
    # ---- 人物 ----
    sections = []
    for ch in S.CHARS:
        fns, keys = S.FN[ch['key']], S.FILES[ch['key']]
        cards = ''.join(char_card(keys[i], S.VIEW_NAMES[i], S.VIEW_NOTES[ch['key']][i],
                                  B.to_svg(fns[i]())) for i in range(3))
        sections.append("""
    <section class="char" id="%(key)s">
      <div class="char-head">
        <div class="num">%(num)s</div>
        <div class="who">
          <h3>%(name)s <span class="role">%(role)s</span></h3>
          <p>%(desc)s</p>
        </div>
        <ul class="pal">%(pal)s</ul>
      </div>
      <div class="views">%(cards)s</div>
    </section>""" % dict(key=ch['key'], num=ch['num'], name=ch['name'], role=ch['role'],
                         desc=ch['desc'], pal=pal_list(ch['pal']), cards=cards))

    bank = ''.join('<div class="bank" data-file="%s.svg">%s</div>' % (k, B.to_svg(f()))
                   for k, f in [('tangdou-front', B.front), ('tangdou-side', B.side),
                                ('tangdou-back', B.back)])

    total = len(S.CHARS) * 3

    page = TEMPLATE
    for k, v in [
        ('__SECTIONS__', '\n'.join(sections)),
        ('__BANK__', bank),
        ('__SHARED__', pal_list(S.SHARED)),
        ('__LINEUP_FRONT__', lineup_row(0, '正面 · 四角色')),
        ('__LINEUP_SIDE__', lineup_row(1, '侧面 · 四角色')),
        ('__N_ALL__', str(total)),
    ]:
        page = page.replace(k, v)

    out = os.path.join(DESIGN, 'QQTang-kit-v1.html')
    open(out, 'w', encoding='utf-8').write(page)
    print('kit -> %s  %d bytes' % (out, len(page)))


TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>QQ糖 · 素材库 v1（人物）</title>
<style>
  :root{
    --ink:#2A1B33; --ink2:#6E5B84; --paper:#FFFDF7; --line:#E9D9BE;
    --pink:#FF7BA8; --mint:#63DFC0; --cream:#FFD166; --z:4;
  }
  *{box-sizing:border-box}
  body{
    margin:0; padding:40px 24px 80px; color:var(--ink);
    background:
      radial-gradient(circle at 12% 0%, #FFF6E2 0%, transparent 46%),
      radial-gradient(circle at 92% 6%, #FFEAF2 0%, transparent 40%),
      #FBF3E4;
    font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1120px;margin:0 auto}

  header{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px 26px}
  h1{font-size:26px;margin:0;letter-spacing:.4px}
  h1 b{color:var(--pink)}
  .sub{color:var(--ink2);font-size:13px;font-weight:700;margin:8px 0 0;line-height:1.85;max-width:640px}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;padding-bottom:4px}
  .chip{font-size:11px;font-weight:800;letter-spacing:.6px;padding:5px 10px;border-radius:999px;
    border:2px solid var(--ink);background:#fff;box-shadow:0 2px 0 rgba(42,27,51,.14)}
  .chip.on{background:var(--ink);color:#fff}

  /* ---------- Tab ---------- */
  .tabs{display:flex;gap:8px;margin:24px 0 0;flex-wrap:wrap}
  .tab{
    appearance:none;border:2.5px solid var(--ink);background:#fff;color:var(--ink);
    font:inherit;font-weight:900;font-size:14px;padding:11px 20px;border-radius:14px 14px 0 0;
    cursor:pointer;box-shadow:0 -3px 0 rgba(42,27,51,0);
    display:flex;align-items:center;gap:9px;border-bottom-color:var(--ink);
  }
  .tab span{font-size:10px;font-weight:800;letter-spacing:.4px;color:#fff;background:var(--ink2);
    border-radius:999px;padding:2px 7px}
  .tab.on{background:var(--ink);color:#fff;transform:translateY(2px)}
  .tab.on span{background:var(--pink)}
  .panel{display:none;border-top:2.5px solid var(--ink);padding-top:18px}
  .panel.on{display:block}

  /* ---------- 通用控件 ---------- */
  .toolbar{
    display:flex;align-items:center;gap:10px;margin:6px 0 18px;padding:10px 14px;
    background:var(--paper);border:2.5px solid var(--ink);border-radius:14px;
    box-shadow:0 5px 0 rgba(42,27,51,.10);flex-wrap:wrap;
  }
  .toolbar span.lb{font-size:12px;font-weight:800;color:var(--ink2);margin-right:2px}
  button{
    appearance:none;border:2.5px solid var(--ink);background:#fff;color:var(--ink);
    font:inherit;font-weight:800;font-size:12px;padding:6px 11px;border-radius:9px;cursor:pointer;
    box-shadow:0 3px 0 rgba(42,27,51,.16);transition:.08s;
  }
  button:hover{background:#FFF1D9}
  button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(42,27,51,.16)}
  .zoom{display:flex;gap:6px}
  .zoom button{padding:4px 9px}
  .zoom button.on, button.on{background:var(--ink);color:#fff}

  h2{font-size:15px;margin:30px 0 12px;display:flex;align-items:center;gap:10px}
  h2::after{content:"";flex:1;height:2px;background:repeating-linear-gradient(90deg,var(--line) 0 8px,transparent 8px 14px)}
  h3.grp{font-size:13px;margin:22px 0 10px;color:var(--ink)}
  h3.grp span{font-size:10.5px;color:var(--ink2);font-weight:800;margin-left:6px}

  /* ---------- 角色 ---------- */
  .lineup{background:var(--paper);border:2.5px solid var(--ink);border-radius:18px;padding:16px 18px 20px;
    box-shadow:0 6px 0 rgba(42,27,51,.10)}
  .lane{display:flex;align-items:flex-end;gap:14px;padding:4px 0}
  .lane + .lane{margin-top:10px;border-top:2px dashed var(--line);padding-top:14px}
  .lane-label{flex:none;width:96px;font-size:11.5px;font-weight:800;color:var(--ink2);padding-bottom:6px;line-height:1.5}
  .floor{position:relative;flex:1;height:118px;
    background-image:
      linear-gradient(to right, rgba(42,27,51,.07) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(42,27,51,.07) 1px, transparent 1px);
    background-size:24px 24px;background-position:0 100%;border-bottom:3px solid var(--ink)}
  .slot{position:absolute;bottom:0;width:96px;display:flex;flex-direction:column;align-items:center}
  .slot b{order:2;font-size:10.5px;font-weight:800;color:var(--ink2);margin-top:2px}
  .slot svg{order:1;width:96px;height:96px;display:block}

  .char{margin-top:26px;background:var(--paper);border:2.5px solid var(--ink);border-radius:20px;
    padding:16px 16px 18px;box-shadow:0 6px 0 rgba(42,27,51,.10)}
  .char-head{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
  .num{flex:none;width:38px;height:38px;border-radius:11px;background:var(--ink);color:#fff;
    font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center}
  .who{flex:1;min-width:220px}
  .who h3{margin:0;font-size:17px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .role{font-size:10.5px;font-weight:800;letter-spacing:.5px;color:#fff;background:var(--pink);
    border-radius:999px;padding:3px 9px}
  .who p{margin:7px 0 0;font-size:12.5px;line-height:1.85;color:var(--ink2);font-weight:650;max-width:560px}
  .pal{display:flex;gap:6px;list-style:none;margin:0;padding:0;flex-wrap:wrap;max-width:340px}
  .pal li{display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid var(--line);
    border-radius:8px;padding:3px 7px 3px 4px}
  .pal i{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--ink);flex:none}
  .pal b{font-size:10px;font-weight:800;line-height:1.2}
  .pal span{display:none}
  .views{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}

  /* ---------- 卡片 ---------- */
  .card{border:2px solid var(--line);border-radius:14px;padding:10px;background:#fff}
  .stage{position:relative;height:240px;border-radius:10px;border:1.5px solid var(--line);
    display:flex;align-items:center;justify-content:center;overflow:hidden;background-color:#FFFCF4;
    background-image:
      linear-gradient(to right, rgba(42,27,51,.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(42,27,51,.06) 1px, transparent 1px);
    background-size: calc(var(--z) * 1px) calc(var(--z) * 1px);
    background-position:center center}
  .pix{filter:drop-shadow(0 5px 0 rgba(42,27,51,.12))}
  .pix svg{width:calc(var(--s) * var(--z) * 1px);height:auto;display:block}
  .meta h4{margin:10px 0 0;font-size:13px;display:flex;align-items:center;gap:7px}
  .dim{font-size:9.5px;font-weight:800;letter-spacing:.3px;color:#fff;background:var(--ink);
    border-radius:5px;padding:2px 5px}
  .meta p{margin:5px 0 0;font-size:11.5px;line-height:1.75;color:var(--ink2);font-weight:650;min-height:34px}
  .tag{display:inline-block;font-size:9.5px;font-weight:800;color:var(--ink2);background:#F4EAD6;
    border-radius:4px;padding:1px 4px;margin-right:5px;vertical-align:1px}
  .row{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}
  .row button{font-size:11px;padding:5px 9px;border-width:2px}

  /* ---------- 规格 ---------- */
  .spec{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
  .spec div{background:var(--paper);border:2.5px solid var(--ink);border-radius:14px;padding:13px 15px;
    box-shadow:0 4px 0 rgba(42,27,51,.08)}
  .spec b{display:block;font-size:12.5px;margin-bottom:5px}
  .spec p{margin:0;font-size:12px;line-height:1.85;color:var(--ink2);font-weight:650}
  .spec code{background:#FFF1D9;border-radius:4px;padding:1px 5px;font-size:11px;font-weight:800;color:#A8501F}

  .shared{margin-top:12px;background:var(--paper);border:2px dashed var(--line);border-radius:14px;padding:12px 14px}
  .shared h4{margin:0 0 9px;font-size:12px;color:var(--ink2)}
  .shared .pal{max-width:none}
  .shared .pal span{display:block;font-size:9px;color:var(--ink2);font-weight:700}

  .bank{display:none}
  body.sil #panel-chars .pix svg{filter:brightness(0)}
  body.sil .slot svg{filter:brightness(0)}

  footer{margin-top:34px;text-align:center;font-size:11.5px;color:var(--ink2);font-weight:700;line-height:2}
  .toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,14px);
    background:var(--ink);color:#fff;font-size:12.5px;font-weight:700;padding:9px 18px;border-radius:10px;
    opacity:0;pointer-events:none;transition:.22s;z-index:9}
  .toast.on{opacity:1;transform:translate(-50%,0)}

  @media (max-width:960px){
    .views,.spec{grid-template-columns:1fr}
    .stage{height:220px}
    .lane{flex-direction:column;align-items:stretch}
    .lane-label{width:auto}
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div>
      <h1>QQ糖 · <b>素材库</b> <span style="font-size:13px;color:#6E5B84;font-weight:800">v1 · __N_ALL__ 个 SVG</span></h1>
      <p class="sub">一套像素素材：<b>人物</b> 四套三视图（32×32）。全部是手绘点阵直接导出的矢量，没有位图放大。地图与炮弹素材在 <b>QQTang-sucai-v1.html</b>。</p>
    </div>
    <div class="chips">
      <span class="chip on">32px 角色</span>
      <span class="chip on">1px 描边</span>
      <span class="chip on">无渐变</span>
    </div>
  </header>

  <nav class="tabs">
    <button class="tab on" data-panel="chars">人物 <span>12 视图</span></button>
  </nav>

  <!-- ============================ 人物 ============================ -->
  <section class="panel on" id="panel-chars">
    <div class="toolbar">
      <span class="lb">缩放</span>
      <div class="zoom" data-for="chars">
        <button data-z="2">2×</button>
        <button data-z="4" class="on">4×</button>
        <button data-z="6">6×</button>
        <button data-z="8">8×</button>
      </div>
      <button id="sil" style="margin-left:auto">剪影模式（查识别度）</button>
    </div>

    <h2>同比例排排站 · 先看身高与剪影是否打架</h2>
    <div class="lineup">
__LINEUP_FRONT__
__LINEUP_SIDE__
    </div>

    <h2>四套角色 · 各三视图</h2>
__SECTIONS__

    <div class="shared">
      <h4>共用底色（9 色，四角色通用）</h4>
      <ul class="pal">__SHARED__</ul>
    </div>

    <h2>规格</h2>
    <div class="spec">
      <div><b>共用骨架</b>
        <p>头 <code>y3–17</code>、肩线 <code>y18</code>、腰 <code>y23</code>、鞋 <code>y27–30</code>，脚底压 <code>y30</code>，中线 <code>x=15.5</code>。四人并排身高完全一致，换角色不跳。</p></div>
      <div><b>武器是独立图层</b>
        <p>弓、箭、剑各自带 1px 描边，和身体留 1px 间隙。换武器只改一段代码，不动角色本体。</p></div>
      <div><b>朝向</b>
        <p>侧面统一朝右，朝左一律 <code>transform:scaleX(-1)</code>，不重画。背面用于向上走。</p></div>
      <div><b>剪影识别度</b>
        <p>点「剪影模式」全黑看轮廓。两两重叠率正面 <code>0.74–0.83</code>，靠青羽的箭枝、夜蔷薇的垂发、银霜的外扩肩甲区分。</p></div>
    </div>
  </section>

  <footer>
    QQ糖 · 素材库 v1 · 12 视图 = __N_ALL__ 个 SVG · 地图与炮弹素材见 QQTang-sucai-v1.html<br>
  </footer>
</div>

<div class="toast" id="toast">已复制</div>
<div id="bank">__BANK__</div>

<script>
  /* ---------- Tab ---------- */
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); });
      document.querySelectorAll('.panel').forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      var panel = document.getElementById('panel-' + t.dataset.panel);
      panel.classList.add('on');
      var z = panel.querySelector('.zoom button.on');
      if (z && z.dataset.z) { document.documentElement.style.setProperty('--z', z.dataset.z); }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  /* ---------- 缩放：人物用 --z ---------- */
  document.querySelectorAll('.zoom').forEach(function (group) {
    group.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        group.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        document.documentElement.style.setProperty('--z', b.dataset.z);
      });
    });
  });

  /* ---------- 剪影 ---------- */
  var sil = document.getElementById('sil');
  sil.addEventListener('click', function () {
    document.body.classList.toggle('sil');
    sil.classList.toggle('on', document.body.classList.contains('sil'));
  });

  /* ---------- 复制 / 下载 ---------- */
  function svgOf(el) {
    return el.querySelector('svg');
  }
  function codeOf(el) {
    return '<?xml version="1.0" encoding="UTF-8"?>\\n' + svgOf(el).outerHTML;
  }
  var toast = document.getElementById('toast'), tt = null;
  function ping(msg) {
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(tt);
    tt = setTimeout(function () { toast.classList.remove('on'); }, 1500);
  }
  function fallback(code) {
    var ta = document.createElement('textarea');
    ta.value = code; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); ping('SVG 代码已复制');
  }
  function copy(el, name) {
    var code = codeOf(el);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(function () { ping('已复制 ' + name); },
        function () { fallback(code); });
    } else { fallback(code); }
  }
  function save(el, name) {
    var blob = new Blob([codeOf(el)], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    ping('已下载 ' + name);
  }

  document.querySelectorAll('.card').forEach(function (card) {
    card.querySelector('[data-copy]').addEventListener('click', function () {
      copy(card, card.dataset.file);
    });
    card.querySelector('[data-save]').addEventListener('click', function () {
      save(card, card.dataset.file);
    });
  });

  /* ---------- 排排站：克隆卡片里的 svg，永远同步 ---------- */
  document.querySelectorAll('[data-clone]').forEach(function (slot) {
    var src = document.querySelector('[data-file="' + slot.dataset.clone + '"] svg');
    if (src) { slot.insertBefore(src.cloneNode(true), slot.firstChild); }
  });
</script>
</body>
</html>
"""

if __name__ == '__main__':
    main()
