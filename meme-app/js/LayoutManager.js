/**
 * LayoutManager.js
 * 专职负责桌面端主工作区左右分栏的鼠标拖拽拉伸逻辑
 */
(function () {
  window.MemeGen = window.MemeGen || {};

  const LayoutManager = {
    init: function (resizerId, rightPanelId) {
      const resizer = document.getElementById(resizerId);
      const rightPanel = document.getElementById(rightPanelId);

      // 防御性容错：若非桌面端环境或找不到节点，直接静默退出，不产生任何副作用
      if (!resizer || !rightPanel) return;

      resizer.addEventListener('mousedown', function (e) {
        e.preventDefault();

        const startX = e.clientX;
        const startWidth = rightPanel.getBoundingClientRect().width;

        function onMouseMove(e) {
          const deltaX = e.clientX - startX;
          const newWidth = startWidth - deltaX;

          // Allow the panel to shrink to 1 card wide and expand up to 75 % of
          // the viewport. Both limits are evaluated at drag time so they adapt
          // when the window is resized between drags.
          const minW = 160;
          const maxW = Math.round(window.innerWidth * 0.75);
          if (newWidth >= minW && newWidth <= maxW) {
            rightPanel.style.width = newWidth + 'px';
          }
        }

        function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = 'default';
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
      });
    }
  };

  window.MemeGen.LayoutManager = LayoutManager;
})();