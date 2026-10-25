# -*- coding: utf-8 -*-
"""生成 QQ糖 角色集规格页（单文件 HTML，内联全部 SVG）"""
import os
import build_assets as B
import build_chars as C

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)

SHARED = [('k', '描边'), ('s', '皮肤'), ('S', '皮肤暗'), ('b', '腮红'),
          ('w', '高光白'), ('e', '眼'), ('n', '奶油'), ('i', '暗钢'), ('I', '亮钢')]

CHARS = [
    dict(key='tangdou', num='00', name='糖豆', role='主角 · 已定稿',
         desc='草莓冻发色 + 薄荷连帽衫，头顶奶油。比例与配色是整套的基准。',
         pal=[('h', '发'), ('H', '发亮'), ('d', '发暗'), ('c', '上衣'),
              ('C', '上衣亮'), ('x', '上衣暗'), ('p', '短裤'), ('f', '鞋')]),
    dict(key='archer', num='01', name='青羽', role='弓箭手 · 远程',
         desc='森林绿不对称短披肩（左肩垂到髋、右肩只盖到腰）+ 皮革马甲，背后两枝长箭斜挑过肩。',
         pal=[('g', '斗篷绿'), ('G', '绿亮'), ('y', '绿暗'), ('a', '皮革'),
              ('A', '皮革亮'), ('j', '皮革暗'), ('t', '琥珀发'), ('T', '发亮')]),
    dict(key='glam', num='02', name='夜蔷薇', role='御姐 · 近战法术',
         desc='酒红露肩礼服 + 金饰，紫黑长发垂到腰。高开衩与过膝靴，靠腰胯曲线识别。',
         pal=[('m', '酒红'), ('M', '玫瑰亮'), ('N', '酒红暗'), ('l', '紫黑发'),
              ('L', '发亮'), ('z', '发暗'), ('Y', '金'), ('Z', '暗金')]),
    dict(key='sword', num='03', name='银霜', role='剑士 · 前排',
         desc='钢蓝板甲 + 猩红披风，银发配红头带。肩甲外扩 4px、长剑杵地，是最宽的剪影。',
         pal=[('D', '钢蓝'), ('E', '钢亮'), ('Q', '钢暗'), ('B', '披风红'),
              ('V', '红暗'), ('W', '银发'), ('X', '银发暗')]),
]

FILES = {
    'tangdou': ('tangdou-front', 'tangdou-side', 'tangdou-back'),
    'archer': ('archer-front', 'archer-side', 'archer-back'),
    'glam': ('glam-front', 'glam-side', 'glam-back'),
    'sword': ('sword-front', 'sword-side', 'sword-back'),
}

FN = {
    'tangdou': (B.front, B.side, B.back),
    'archer': (C.archer_front, C.archer_side, C.archer_back),
    'glam': (C.glam_front, C.glam_side, C.glam_back),
    'sword': (C.sword_front, C.sword_side, C.sword_back),
}

VIEW_NAMES = ['① 正面', '② 侧面（朝右）', '③ 背面']
VIEW_NOTES = {
    'tangdou': ['看镜头的主姿态，头顶奶油是识别点。', '朝左直接 scaleX(-1)，不要重画。', '后脑的奶油蝴蝶结是背面识别点。'],
    'archer': ['左肩披肩垂到髋、右肩只到腰，露出两枝箭的箭羽。', '长弓在前手，弦贴身体一侧；短披肩在身后掠出，到髋线收边。', '兜帽垂在背上，中缝一条麻花辫，左侧披肩同样垂到髋。'],
    'glam': ['高开衩露出右腿，左裙片垂到 y25。', '胸部前探 1px，腰部回收，形成 S 线。', '长发从肩线 18px 收到腰线 14px，只露腰链与靴子。'],
    'sword': ['肩甲外扩 + 长剑杵地，正面最宽的剪影。', '披风贴背垂到脚踝，剑在身前。', '披风肩线收、下摆展开成 A 形，锯齿下摆落在脚踝。'],
}


def svg_of(fn):
    return B.to_svg(fn())


def card(key, title, sub, svg, dim=32):
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
    for i, ch in enumerate(CHARS):
        fkey = FILES[ch['key']][views]
        slots.append('<div class="slot" style="left:%dpx" data-clone="%s.svg"><b>%s</b></div>'
                     % (i * 96, fkey, ch['name']))
    return """
    <div class="lane">
      <span class="lane-label">%s</span>
      <div class="floor">%s</div>
    </div>""" % (label, ''.join(slots))


def main():
    sections = []
    for ch in CHARS:
        fns = FN[ch['key']]
        keys = FILES[ch['key']]
        cards = ''.join(card(keys[i], VIEW_NAMES[i], VIEW_NOTES[ch['key']][i], svg_of(fns[i]))
                        for i in range(3))
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

    bank = ''.join('<div class="bank" data-file="%s.svg">%s</div>'
                   % (k, svg_of(f)) for k, f in
                   [('tangdou-front', B.front), ('tangdou-side', B.side),
                    ('tangdou-back', B.back), ('candy-bomb', B.bomb)])

    page = TEMPLATE
    page = page.replace('__BANK__', bank)
    page = page.replace('__SECTIONS__', '\n'.join(sections))
    page = page.replace('__SHARED__', pal_list(SHARED))
    page = page.replace('__LINEUP_FRONT__', lineup_row(0, '正面 · 四角色'))
    page = page.replace('__LINEUP_SIDE__', lineup_row(1, '侧面 · 四角色'))

    out = os.path.join(DESIGN, 'QQTang-chars-v1.html')
    open(out, 'w', encoding='utf-8').write(page)
    print('sheet ->', out, len(page), 'bytes')


TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>QQ糖 · 角色集 v1（弓箭手 / 夜蔷薇 / 银霜）</title>
<style>
  :root{
    --ink:#2A1B33; --ink2:#6E5B84; --paper:#FFFDF7; --line:#E9D9BE;
    --pink:#FF7BA8; --mint:#63DFC0; --cream:#FFD166; --z:4;
  }
  *{box-sizing:border-box}
  body{
    margin:0; padding:44px 24px 80px; color:var(--ink);
    background:
      radial-gradient(circle at 12% 0%, #FFF6E2 0%, transparent 46%),
      radial-gradient(circle at 92% 6%, #FFEAF2 0%, transparent 40%),
      #FBF3E4;
    font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1080px;margin:0 auto}

  header{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px 26px;margin-bottom:6px}
  h1{font-size:26px;margin:0;letter-spacing:.4px}
  h1 b{color:var(--pink)}
  .sub{color:var(--ink2);font-size:13px;font-weight:700;margin:8px 0 0;line-height:1.85;max-width:600px}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;padding-bottom:4px}
  .chip{
    font-size:11px;font-weight:800;letter-spacing:.6px;padding:5px 10px;border-radius:999px;
    border:2px solid var(--ink);background:#fff;box-shadow:0 2px 0 rgba(42,27,51,.14);
  }
  .chip.on{background:var(--ink);color:#fff}

  .toolbar{
    display:flex;align-items:center;gap:10px;margin:22px 0 8px;padding:10px 14px;
    background:var(--paper);border:2.5px solid var(--ink);border-radius:14px;
    box-shadow:0 5px 0 rgba(42,27,51,.10);flex-wrap:wrap;
  }
  .toolbar span{font-size:12px;font-weight:800;color:var(--ink2);margin-right:2px}
  .toolbar .zoom{display:flex;gap:6px}
  button{
    appearance:none;border:2.5px solid var(--ink);background:#fff;color:var(--ink);
    font:inherit;font-weight:800;font-size:12px;padding:6px 11px;border-radius:9px;cursor:pointer;
    box-shadow:0 3px 0 rgba(42,27,51,.16);transition:.08s;
  }
  button:hover{background:#FFF1D9}
  button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(42,27,51,.16)}
  .zoom button{padding:4px 9px}
  .zoom button.on, button.on{background:var(--ink);color:#fff}

  h2{font-size:15px;margin:34px 0 12px;display:flex;align-items:center;gap:10px}
  h2::after{content:"";flex:1;height:2px;background:repeating-linear-gradient(90deg,var(--line) 0 8px,transparent 8px 14px)}

  /* ---------- 排排站 ---------- */
  .lineup{
    background:var(--paper);border:2.5px solid var(--ink);border-radius:18px;padding:16px 18px 20px;
    box-shadow:0 6px 0 rgba(42,27,51,.10);
  }
  .lane{display:flex;align-items:flex-end;gap:14px;padding:4px 0}
  .lane + .lane{margin-top:10px;border-top:2px dashed var(--line);padding-top:14px}
  .lane-label{
    flex:none;width:96px;font-size:11.5px;font-weight:800;color:var(--ink2);
    padding-bottom:6px;line-height:1.5;
  }
  .floor{position:relative;flex:1;height:118px;
    background-image:
      linear-gradient(to right, rgba(42,27,51,.07) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(42,27,51,.07) 1px, transparent 1px);
    background-size:24px 24px;background-position:0 100%;
    border-bottom:3px solid var(--ink);
  }
  .slot{position:absolute;bottom:0;width:96px;display:flex;flex-direction:column;align-items:center}
  .slot b{order:2;font-size:10.5px;font-weight:800;color:var(--ink2);margin-top:2px}
  .slot svg{order:1;width:96px;height:96px;display:block}

  /* ---------- 角色段 ---------- */
  .char{
    margin-top:30px;background:var(--paper);border:2.5px solid var(--ink);border-radius:20px;
    padding:16px 16px 18px;box-shadow:0 6px 0 rgba(42,27,51,.10);
  }
  .char-head{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
  .num{
    flex:none;width:38px;height:38px;border-radius:11px;background:var(--ink);color:#fff;
    font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;
    letter-spacing:.5px;
  }
  .who{flex:1;min-width:220px}
  .who h3{margin:0;font-size:17px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .role{
    font-size:10.5px;font-weight:800;letter-spacing:.5px;color:#fff;background:var(--pink);
    border-radius:999px;padding:3px 9px;
  }
  .who p{margin:7px 0 0;font-size:12.5px;line-height:1.85;color:var(--ink2);font-weight:650;max-width:560px}

  .pal{display:flex;gap:6px;list-style:none;margin:0;padding:0;flex-wrap:wrap;max-width:340px}
  .pal li{display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid var(--line);
    border-radius:8px;padding:3px 7px 3px 4px}
  .pal i{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--ink);flex:none}
  .pal b{font-size:10px;font-weight:800;line-height:1.2}
  .pal span{display:none}

  .views{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .card{border:2px solid var(--line);border-radius:14px;padding:10px;background:#fff}
  .stage{
    position:relative;height:240px;border-radius:10px;border:1.5px solid var(--line);
    display:flex;align-items:center;justify-content:center;overflow:hidden;
    background-color:#FFFCF4;
    background-image:
      linear-gradient(to right, rgba(42,27,51,.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(42,27,51,.06) 1px, transparent 1px);
    background-size: calc(var(--z) * 1px) calc(var(--z) * 1px);
    background-position:center center;
  }
  .pix{filter:drop-shadow(0 5px 0 rgba(42,27,51,.12))}
  .pix svg{width:calc(var(--s) * var(--z) * 1px);height:auto;display:block}
  .meta h4{margin:10px 0 0;font-size:13px;display:flex;align-items:center;gap:7px}
  .dim{font-size:9.5px;font-weight:800;letter-spacing:.3px;color:#fff;background:var(--ink);
    border-radius:5px;padding:2px 5px}
  .meta p{margin:5px 0 0;font-size:11.5px;line-height:1.75;color:var(--ink2);font-weight:650;min-height:40px}
  .row{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}
  .row button{font-size:11px;padding:5px 9px;border-width:2px}

  .bank{display:none}

  /* 剪影模式 */
  body.silhouette .pix svg{filter:brightness(0)}
  body.silhouette .slot svg{filter:brightness(0)}

  /* ---------- 规格 ---------- */
  .spec{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .spec div{background:var(--paper);border:2.5px solid var(--ink);border-radius:14px;padding:13px 15px;
    box-shadow:0 4px 0 rgba(42,27,51,.08)}
  .spec b{display:block;font-size:12.5px;margin-bottom:5px}
  .spec p{margin:0;font-size:12px;line-height:1.85;color:var(--ink2);font-weight:650}
  .spec code{background:#FFF1D9;border-radius:4px;padding:1px 5px;font-size:11px;font-weight:800;color:#A8501F}

  .shared{margin-top:12px;background:var(--paper);border:2px dashed var(--line);border-radius:14px;padding:12px 14px}
  .shared h4{margin:0 0 9px;font-size:12px;color:var(--ink2)}
  .shared .pal{max-width:none}
  .shared .pal span{display:block;font-size:9px;color:var(--ink2);font-weight:700}

  footer{margin-top:34px;text-align:center;font-size:11.5px;color:var(--ink2);font-weight:700;line-height:2}

  .toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,14px);
    background:var(--ink);color:#fff;font-size:12.5px;font-weight:700;padding:9px 18px;border-radius:10px;
    opacity:0;pointer-events:none;transition:.22s;z-index:9}
  .toast.on{opacity:1;transform:translate(-50%,0)}

  @media (max-width:900px){
    .views{grid-template-columns:1fr}
    .spec{grid-template-columns:1fr}
    .stage{height:220px}
    .lane{flex-direction:column;align-items:stretch}
    .lane-label{width:auto}
    .floor{overflow-x:auto}
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div>
      <h1>QQ糖 · <b>角色集</b> <span style="font-size:13px;color:#6E5B84;font-weight:800">v1 定稿候选</span></h1>
      <p class="sub">四套角色共用同一副骨架（头 y3-17 / 肩 y18 / 腰 y23 / 脚底 y30），只换发型、服装与武器。下面每一张都是 32×32 手绘点阵直接导出的矢量，不是位图放大。</p>
    </div>
    <div class="chips">
      <span class="chip on">32×32</span>
      <span class="chip on">1px 描边</span>
      <span class="chip on">共用骨架</span>
      <span class="chip on">每角色 6-8 色</span>
      <span class="chip">透明底</span>
    </div>
  </header>

  <div class="toolbar">
    <span>缩放</span>
    <div class="zoom">
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

  <h2>三个新角色 · 各三视图</h2>
__SECTIONS__

  <h2>规格与落地</h2>
  <div class="spec">
    <div><b>共用骨架（最关键）</b>
      <p>头 <code>y3–17</code>、肩线 <code>y18</code>、腰 <code>y23</code>、腿 <code>y25–26</code>、鞋 <code>y27–30</code>，脚底压 <code>y30</code>，水平中线 <code>x=15.5</code>。四人并排时身高、头身比完全一致，换角色不会跳。</p></div>
    <div><b>武器是独立图层</b>
      <p>弓、箭、剑都按独立物件画：自带 1px 描边、和身体留 1px 间隙。换武器只改这一段代码，不动角色本体。剑长 13px、弓高 17px，都在 32px 画布内。</p></div>
    <div><b>颜色规则</b>
      <p>共用底色 <code>描边/皮肤/白/钢</code> 9 个不换；每个角色再加 6–8 个专属色。整套 32 色，仍然无渐变。换肤只改 <code>build_chars.py</code> 顶部的 <code>PAL.update()</code>。</p></div>
    <div><b>剪影检查（已量化）</b>
      <p>点上方「剪影模式」全黑看轮廓。纯黑两两重叠率：正面 <code>0.74–0.83</code>、侧面 <code>0.73–0.83</code>、背面 <code>0.83–0.86</code>。正面识别点是青羽右肩的箭枝 + 左侧长披肩、夜蔷薇两侧垂发、银霜外扩肩甲 + 长剑。</p></div>
    <div><b>朝向</b>
      <p>三个视角都朝右/朝前。朝左一律 <code>transform: scaleX(-1)</code>，不要重画。背面用于角色背对镜头（向上走）。</p></div>
    <div><b>文件</b>
      <p><code>assets/archer-*.svg</code>、<code>glam-*.svg</code>、<code>sword-*.svg</code>，每套 front/side/back 三张。生成脚本 <code>tools/build_chars.py</code>。</p></div>
  </div>

  <div class="shared">
    <h4>共用底色（9 色，四角色通用）</h4>
    <ul class="pal">__SHARED__</ul>
  </div>

  <footer>
    QQ糖 · 角色集 v1 · 四角色 × 三视图 = 12 张 · 手工点阵<br>
    下一步可延伸：待机呼吸 2 帧 / 走路 4 帧 / 弓箭射击 3 帧 / 剑士挥砍 3 帧
  </footer>
</div>

<div class="toast" id="toast">已复制</div>
<div id="bank">__BANK__</div>

<script>
  document.querySelectorAll('.zoom button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.zoom button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.documentElement.style.setProperty('--z', b.dataset.z);
    });
  });

  var sil = document.getElementById('sil');
  sil.addEventListener('click', function () {
    document.body.classList.toggle('silhouette');
    sil.classList.toggle('on', document.body.classList.contains('silhouette'));
  });

  function svgCode(card) {
    return '<?xml version="1.0" encoding="UTF-8"?>\\n' + card.querySelector('svg').outerHTML;
  }

  var toast = document.getElementById('toast'), t = null;
  function ping(msg) {
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(t);
    t = setTimeout(function () { toast.classList.remove('on'); }, 1500);
  }

  document.querySelectorAll('.card').forEach(function (card) {
    card.querySelector('[data-save]').addEventListener('click', function () {
      var blob = new Blob([svgCode(card)], { type: 'image/svg+xml' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = card.dataset.file;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      ping('已下载 ' + card.dataset.file);
    });
    card.querySelector('[data-copy]').addEventListener('click', function () {
      var code = svgCode(card);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function () { ping('SVG 代码已复制'); },
          function () { fallback(code); });
      } else { fallback(code); }
    });
  });

  /* 排排站：直接克隆卡片里的 svg，永远和上面同步 */
  document.querySelectorAll('[data-clone]').forEach(function (slot) {
    var src = document.querySelector('[data-file="' + slot.dataset.clone + '"] svg');
    if (src) { slot.insertBefore(src.cloneNode(true), slot.firstChild); }
  });

  function fallback(code) {
    var ta = document.createElement('textarea');
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    ping('SVG 代码已复制');
  }
</script>
</body>
</html>
"""

if __name__ == '__main__':
    main()
