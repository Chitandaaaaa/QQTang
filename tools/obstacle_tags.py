# -*- coding: utf-8 -*-
"""障碍标签：一处定义，地图编辑器与素材页共用。

只回答两件事（外加「挡不挡路」这条）：
    bomb  能不能被糖弹炸开          —— 可炸 / 不可炸
    push  能不能被人物顶着走        —— 可推动 / 不可推动
    walk  是不是可以直接踩过去      —— 装饰专属

推动玩法已经接进游戏：雪块「可推动」是真的可推动 —— 对正了按住方向
0.05s 推一格（去处没有遮挡才动）。以后调整规则也只改游戏和这一张表，
编辑器和素材页的标签会一起变。

地图字符：# 硬墙  P 石柱  c 可炸障碍  o 陶罐（按 c 走）  $ 宝箱
          s 雪块（可推动）  d 实心装饰（雪人：挡路但炸不开）
"""
# ------------------------------------------------------------------ 定义
KINDS = {
    '#': dict(name='硬墙', bomb=False, push=False, walk=False,
              note='走不过去，也炸不开'),
    'P': dict(name='石柱', bomb=False, push=False, walk=False,
              note='走不过去，也炸不开，棋盘格拐角专用'),
    'c': dict(name='可炸障碍', bomb=True, push=False, walk=False,
              note='炸开按「掉落率」掉道具'),
    '$': dict(name='宝箱', bomb=True, push=False, walk=False,
              note='炸开必掉一件道具'),
    's': dict(name='雪块', bomb=True, push=True, walk=False,
              note='炸开掉道具；也能顶着推走（对正按住方向 0.05s 推一格）'),
    'd': dict(name='实心装饰', bomb=False, push=False, walk=False,
              note='挡路也挡糖弹，但炸不开、推不动'),
}

# 素材 id -> 属于哪一类（不在表里的就是地砖 / 道具 / 特效，不打障碍标签）
ASSET_KIND = {
    'wall-stone': '#', 'wall-icebrick': '#',
    'wall-pillar': 'P', 'wall-icepillar': 'P',
    'prop-crate': 'c', 'prop-iceblock': 'c', 'prop-amphora': 'c',
    'prop-block-red': 'c', 'prop-block-violet': 'c',
    'prop-chest': '$', 'prop-icechest': '$',
    'prop-snowblock': 's',
    'prop-snowman': 'd',
}


# ------------------------------------------------------------------ 输出
def chips(ch):
    """返回 [(文案, 语气)]，语气：yes 能做 / no 不能做 / mute 中性说明"""
    k = KINDS.get(ch)
    if not k:
        return []
    out = [('可炸' if k['bomb'] else '不可炸', 'yes' if k['bomb'] else 'no')]
    if k['walk']:
        out.append(('不挡路', 'mute'))
    out.append(('可推动' if k['push'] else '不可推动',
                'yes' if k['push'] else 'no'))
    return out


def asset_chips(asset_id):
    """按素材 id 取标签（非障碍返回空表）"""
    return chips(ASSET_KIND.get(asset_id))


def js_table():
    """给编辑器用的 JS 表：{字符: {name, note, tags:[[文案,语气],...]}}"""
    out = {}
    for ch, k in KINDS.items():
        out[ch] = dict(name=k['name'], note=k['note'], tags=chips(ch))
    return out


if __name__ == '__main__':
    for ch in KINDS:
        print('%-3s %-6s %s' % (ch, KINDS[ch]['name'],
                                ' / '.join(c[0] for c in chips(ch))))
