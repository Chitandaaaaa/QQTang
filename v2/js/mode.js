/* =========================================================================
   QQ糖 · 页面模式切换 —— 主页 = 游戏，编辑器是同一页面的一个模式
   body[data-mode="game" | "editor"]，CSS 按 data-mode 显隐两个区域。
   ========================================================================= */
'use strict';
(function () {
  function setMode(mode) {
    const m = mode === 'editor' ? 'editor' : 'game';
    document.body.dataset.mode = m;
    const eb = document.getElementById('btnEdit');
    if (eb) eb.textContent = m === 'editor' ? '← 返回游戏' : '地图编辑';
    if (m === 'editor' && window.__editor && window.__editor.enter) window.__editor.enter();
    if (m === 'game' && window.__game && window.__game.paint) window.__game.paint();
  }
  window.pageMode = setMode;
  window.isEditorMode = () => document.body.dataset.mode === 'editor';
})();
