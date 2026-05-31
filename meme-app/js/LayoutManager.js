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

          // 限制拉伸临界值，保护两端样式不发生坍塌
          if (newWidth >= 280 && newWidth <= 600) {
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