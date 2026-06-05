/**
 * LayoutManager.js
 * 专职负责桌面端主工作区左右分栏的鼠标拖拽拉伸逻辑
 */
(function () {
  window.MemeGen = window.MemeGen || {};

  var LayoutManager = {
    init: function (resizerId, rightPanelId) {
      var resizer = document.getElementById(resizerId);
      var rightPanel = document.getElementById(rightPanelId);

      // 防御性容错：若非桌面端环境或找不到节点，直接静默退出，不产生任何副作用
      if (!resizer || !rightPanel) return;

      resizer.addEventListener('mousedown', function (e) {
        e.preventDefault();

        var startX = e.clientX;
        var startWidth = rightPanel.getBoundingClientRect().width;

        function onMouseMove(e) {
          var deltaX = e.clientX - startX;
          var newWidth = startWidth - deltaX;

          // Allow the panel to shrink to 1 card wide and expand up to 75 % of
          // the viewport. Both limits are evaluated at drag time so they adapt
          // when the window is resized between drags.
          var minW = 160;
          var maxW = Math.round(window.innerWidth * 0.75);
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