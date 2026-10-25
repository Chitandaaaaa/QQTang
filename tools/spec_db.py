# -*- coding: utf-8 -*-
"""QQ糖 · 人物规格数据（自 build_sheet_chars.py 的数据部分独立成模块）

四角色：糖豆 / 青羽 / 夜蔷薇 / 银霜，各三视图（32×32）。
build_v2.py 用它生成 v2/data/spec-data.js（素材库页的「人物规格」标签）。
"""
import build_assets as B
import build_chars as C

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


def spec_data():
    """组装成素材库「人物规格」标签要的数据结构"""
    chars = []
    for ch in CHARS:
        fns, keys = FN[ch['key']], FILES[ch['key']]
        views = []
        for i in range(3):
            svg = B.to_svg(fns[i]())
            views.append({'file': keys[i], 'name': VIEW_NAMES[i],
                          'note': VIEW_NOTES[ch['key']][i], 'svg': svg.strip()})
        chars.append({'key': ch['key'], 'num': ch['num'], 'name': ch['name'],
                      'role': ch['role'], 'desc': ch['desc'],
                      'pal': [[B.PAL[c], name] for c, name in ch['pal']],
                      'views': views})
    shared = [[B.PAL[c], name] for c, name in SHARED]
    return {'shared': shared, 'chars': chars}
