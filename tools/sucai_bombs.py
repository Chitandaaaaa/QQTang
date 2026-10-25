# -*- coding: utf-8 -*-
"""
QQ糖 · 糖弹家族（素材库用）
- 一副 24×24 球体（引线 + 火花 + 左上高光 + 右下暗部），只换主色 -> 口味变体
- 彩虹糖弹是横向七色条带版，单独一副点阵
- 与 build_assets.bomb() 同形，保证放进地图 / 游戏时格子对齐
- 每种口味配一块同色地的爆炸格（32×32），沿用 sucai_fx.boom_cell 的构图：
  竖向渐变 + 短故障条 + 白热芯，**不画整圈深边框**（相邻格要能连成一片火）
"""
from sucai_lib import normalize, hex2rgb
import build_assets as B
import sucai_fx

INK = '#2A1B33'    # 描边
FUSE = '#8C5A3C'   # 引线
SPARK = '#FF9E3D'  # 火花
WHITE = '#FFFFFF'


def _recolor(g, mapping):
    return [[mapping.get(c, c) for c in row] for row in g]


def tint(h, k):
    """往白里混，k=1 全白"""
    r, g, b = hex2rgb(h)
    return '#%02X%02X%02X' % tuple(int(c + (255 - c) * k) for c in (r, g, b))


def mix(a, b, k):
    """a -> b 插值，k=0 取 a"""
    ca, cb = hex2rgb(a), hex2rgb(b)
    return '#%02X%02X%02X' % tuple(int(x + (y - x) * k)
                                  for x, y in zip(ca, cb))


def shade(h, k):
    """往黑里压，k=1 全黑"""
    return mix(h, '#000000', k)


def variant(body, light, dark, spark=SPARK, deco=None):
    """基于 B.bomb() 的形状换色。

    deco='star' —— 右上再加一颗四角高光星（黄金弹用）
    """
    g = _recolor(B.bomb(), {'r': 'a', 'R': 'b', 'q': 'c'})
    if deco == 'star':
        # 球面偏右一颗四角闪光（十 + 四个短芒），避开左上原有的高光块
        for (x, y) in [(15, 8), (14, 9), (15, 9), (16, 9), (15, 10)]:
            g[y][x] = 'w'
        for (x, y) in [(15, 7), (12, 9), (18, 9), (15, 11)]:
            if g[y][x] != 'k':
                g[y][x] = 'b'
    pal = {'a': body, 'b': light, 'c': dark,
           'u': FUSE, 'o': spark, 'w': WHITE, 'k': INK}
    normalize(g, pal)
    return g, pal


# 条带： (主色, 亮色) × 7
RAINBOW = [
    ('#FF5E86', '#FF9EB6'),
    ('#FF8A4A', '#FFB27A'),
    ('#F7C74A', '#FFE39A'),
    ('#9BD95A', '#C4F08C'),
    ('#63DFC0', '#9BF2E0'),
    ('#4FA8E8', '#A9DCFF'),
    ('#9B6BE0', '#C9A6FF'),
]


def rainbow():
    """彩虹糖弹：球体按行切成七道色带，每道「亮 / 主」两行"""
    g = _recolor(B.bomb(), {'r': 'a', 'q': 'a', 'R': 'a'})
    # 球体占 y=6..20 共 15 行：7 色 × 2 行 + 1 行补齐
    seq = []
    for i in range(len(RAINBOW)):
        seq += ['L%d' % i, 'M%d' % i]
    seq.append('M%d' % (len(RAINBOW) - 1))
    for y in range(6, 21):
        ch = seq[y - 6]
        for x in range(24):
            if g[y][x] == 'a':
                g[y][x] = ch
    pal = {'w': WHITE, 'u': FUSE, 'o': SPARK, 'k': INK}
    for i, (main, light) in enumerate(RAINBOW):
        pal['M%d' % i] = main
        pal['L%d' % i] = light
    normalize(g, pal)
    return g, pal


# ------------------------------------------------------------------ 爆炸格
def cell_for(body, light, dark):
    """口味爆炸格 32×32：沿用 sucai_fx.boom_cell 的构图，只换整套色阶。

    竖向渐变（顶浅 -> 主色 -> 底亮）+ 短故障条 + 白热芯。
    **不画整圈深边框** —— 游戏里相邻两格要能连成一片火。
    """
    cols = {
        't': tint(body, .55),           # 顶部：主色提亮
        'v': light,                     # 亮
        'm': mix(light, body, .55),     # 亮 -> 主色的过渡
        'b': body,                      # 主色
        'g': tint(body, .35),           # 底部发亮（保留色相，别洗成白）
        'e': mix(body, dark, .5),       # 撕裂行的柔化深调
        'd': dark,                      # 压角的深调
        'w': WHITE,                     # 白热芯
    }
    g = [['.'] * 32 for _ in range(32)]
    bands = [('t', 2), (('e', 'v'), 1), ('v', 4), (('v', 'm'), 1), ('m', 3),
             (('m', 'b'), 1), ('b', 8), (('b', 'g'), 1), ('g', 11)]
    y = 0
    for spec, h in bands:
        for _ in range(h):
            if y >= 32:
                break
            if isinstance(spec, tuple):
                for x in range(32):
                    g[y][x] = spec[0] if (x + y) % 2 else spec[1]
            else:
                for x in range(32):
                    g[y][x] = spec
            y += 1
    while y < 32:
        for x in range(32):
            g[y][x] = 'g'
        y += 1
    # 短故障条：只有 4~11px 长，贯通整行会让「两格并排」变成条形码
    for (yy, x0, ln, ch) in [(3, 5, 11, 'w'), (6, 19, 9, 't'), (10, 7, 8, 'g'),
                             (13, 22, 7, 't'), (17, 4, 10, 'g'), (21, 15, 9, 'w'),
                             (25, 9, 8, 'g'), (28, 21, 7, 't')]:
        for x in range(x0, min(31, x0 + ln) + 1):
            g[yy][x] = ch
    # 白热芯 + 外圈
    for yy in range(13, 19):
        for x in range(13, 19):
            g[yy][x] = 'w' if (abs(x - 15.5) < 1.6 and abs(yy - 15.5) < 1.6) else 'g'
    # 不压四角：四角一暗，2×2 拼起来就有网格感
    return g, cols


def cell_rainbow():
    """彩虹爆炸格：竖向七道色带，每道「亮 / 主 / 暗」三段"""
    sizes = [5, 5, 5, 5, 4, 4, 4]           # 合计 32 行
    pal = {'w': WHITE}
    g = [['.'] * 32 for _ in range(32)]
    y = 0
    for i, (main, light) in enumerate(RAINBOW):
        pal['L%d' % i] = light
        pal['M%d' % i] = main
        pal['D%d' % i] = shade(main, .22)
        for j in range(sizes[i]):
            ch = 'L%d' % i if j == 0 else ('D%d' % i if j == sizes[i] - 1
                                           else 'M%d' % i)
            for x in range(32):
                g[y][x] = ch
            y += 1
    for (yy, x0, ln) in [(3, 5, 11), (10, 7, 8), (17, 4, 10), (25, 9, 8)]:
        for x in range(x0, min(31, x0 + ln) + 1):
            g[yy][x] = 'w'
    for yy in range(13, 19):
        for x in range(13, 19):
            if abs(x - 15.5) < 1.6 and abs(yy - 15.5) < 1.6:
                g[yy][x] = 'w'
    return g, pal


# ------------------------------------------------------------------ 口味表
FLAVORS = [
    dict(key='candy-bomb', cell='boom-cell-strawberry', name='草莓',
         body='#FF5E86', light='#FF9EB6', dark='#C43A63',
         tags=[('草莓味', 'mute'), ('基础弹药', '')], note='已定稿'),
    dict(key='bomb-mint', cell='boom-cell-mint', name='薄荷',
         body='#4FD1B5', light='#9BF2E0', dark='#2A9078',
         tags=[('薄荷味', 'mute'), ('暗色关卡更显眼', '')]),
    dict(key='bomb-choco', cell='boom-cell-choco', name='巧克力',
         body='#8C5A3C', light='#B98157', dark='#5C3722',
         tags=[('可可味', 'mute'), ('重弹', '')]),
    dict(key='bomb-lemon', cell='boom-cell-lemon', name='柠檬',
         body='#F2C14E', light='#FFE9A3', dark='#C08E20',
         tags=[('柠檬味', 'mute'), ('别和金币同屏', '')]),
    dict(key='bomb-grape', cell='boom-cell-grape', name='葡萄',
         body='#9B6BE0', light='#C9A6FF', dark='#6B3FA0',
         tags=[('葡萄味', 'mute'), ('毒 / 暗属性', '')]),
    dict(key='bomb-soda', cell='boom-cell-soda', name='汽水',
         body='#4FA8E8', light='#A9DCFF', dark='#2A6FBF',
         tags=[('汽水味', 'mute'), ('冰属性', '')]),
    dict(key='bomb-melon', cell='boom-cell-melon', name='蜜瓜',
         body='#7ED957', light='#C2F5A0', dark='#4A9E2E',
         tags=[('蜜瓜味', 'mute'), ('草地同色系', '')]),
    dict(key='bomb-gold', cell='boom-cell-gold', name='黄金',
         body='#E9B93E', light='#FFEFAE', dark='#8F6212', spark='#FFF3C4',
         deco='star', tags=[('限量口味', 'mute'), ('稀有弹', 'yes')],
         note='稀有'),
    dict(key='bomb-rainbow', cell='boom-cell-rainbow', name='彩虹',
         rainbow=True, tags=[('七色', 'mute'), ('全屏特效', 'yes')],
         note='彩蛋'),
]


def _bomb_fn(f):
    if f.get('rainbow'):
        return rainbow
    return lambda: variant(f['body'], f['light'], f['dark'],
                           f.get('spark', SPARK), f.get('deco'))


def _cell_fn(f):
    if f.get('rainbow'):
        return cell_rainbow
    return lambda: cell_for(f['body'], f['light'], f['dark'])


# key / 生成函数 / 中文名
BOMB_ASSETS = [(f['key'], _bomb_fn(f), '%s糖弹' % f['name']) for f in FLAVORS]
CELL_ASSETS = [(f['cell'], _cell_fn(f), '%s爆炸格' % f['name']) for f in FLAVORS]


# ---------------------------------------------------------- 32×32 实装版弹体
# 游戏里的糖弹要「撑满整格」（外接圆和格子四边相切），用的是 sucai_fx.bomb()
# 那副 32×32 点阵 —— 上面那副 24×24 只进素材库。这里给同一副点阵换口味：
# 轮廓、高光块、上浅下深的双色调结构原封不动，只换整套色板。
#   P 左上高光 -> light      p 上半球 -> body
#   b 下半球   -> 深一档      B 底部反光 -> 微深
#   c 右下暗边 -> dark       k 描边 / w 高光点保持通用墨色
def bomb32(f):
    g0, pal0 = sucai_fx.bomb()
    if f.get('rainbow'):
        return bomb32_rainbow(g0, pal0)
    body, light, dark = f['body'], f['light'], f['dark']
    pal = dict(pal0)
    pal['P'] = light
    pal['p'] = body
    pal['b'] = mix(body, dark, .35)
    pal['B'] = mix(body, dark, .12)
    pal['c'] = dark
    normalize(g0, pal)
    return g0, pal


def bomb32_rainbow(g0, pal0):
    """彩虹实装版：球体按行切成七道色带，每道内保留原版的高光/暗部角色"""
    g = [row[:] for row in g0]
    n = len(RAINBOW)
    for y in range(32):
        i = min(n - 1, y * n // 32)
        for x in range(32):
            ch = g0[y][x]
            if ch in 'PpBbc':
                g[y][x] = {'P': 'L', 'p': 'M', 'b': 'm', 'B': 't', 'c': 'd'}[ch] + str(i)
    pal = dict(pal0)
    for i, (main, light) in enumerate(RAINBOW):
        dark = shade(main, .22)
        pal['L%d' % i] = light
        pal['M%d' % i] = main
        pal['m%d' % i] = mix(main, dark, .35)
        pal['t%d' % i] = mix(main, dark, .12)
        pal['d%d' % i] = dark
    normalize(g, pal)
    return g, pal


def _bomb32_fn(f):
    return lambda: bomb32(f)


BOMB32_ASSETS = [(f['key'], _bomb32_fn(f), '%s糖弹 · 实装 32×32' % f['name'])
                 for f in FLAVORS]

# 素材页卡片上的小标签：[(文案, 语气)]，语气 '' 中性 / 'mute' 金色 / 'yes' 绿色
TAGS = {}
NOTES = {}
for f in FLAVORS:
    TAGS[f['key']] = f['tags']
    TAGS[f['cell']] = [('爆炸格', 'mute'), ('%s炸开' % f['name'], '')]
    if f.get('note'):
        NOTES[f['key']] = f['note']

if __name__ == '__main__':
    for key, fn, label in BOMB_ASSETS + CELL_ASSETS:
        g, p = fn()
        print('%-22s %-10s %2dx%-2d  %2d 色' % (key, label, len(g[0]), len(g),
                                                len(set(p.values()))))
