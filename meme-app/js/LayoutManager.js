/**
 * LayoutManager.js
 * 负责桌面端主工作区（Workspace）左右分栏的拖拽拉伸逻辑
 */
(function () {
  // 确保全局命名空间存在
  window.MemeGen = window.MemeGen || {};

  var LayoutManager = {
    /**
     * 初始化拖拽调节面板功能
     * @param {string} resizerId 拖拽条的手柄ID
     * @param {string} rightPanelId 右侧需要被调节宽度的面板ID
     */
    init: function (resizerId, rightPanelId) {
      var resizer = document.getElementById(resizerId);
      var rightPanel = document.getElementById(rightPanelId);

      // 防御性容错：如果找不到节点（如在某些特殊测试环境中），直接返回
      if (!resizer || !rightPanel) return;

      resizer.addEventListener('mousedown', function (e) {
        e.preventDefault();

        // 记录鼠标按下时的初始 X 坐标和右侧栏的初始宽度
        var startX = e.clientX;
        var startWidth = rightPanel.getBoundingClientRect().width;

        function onMouseMove(e) {
          // 鼠标向左拖动（deltaX为负）时，右侧面板宽度应该增加
          var deltaX = e.clientX - startX;
          var newWidth = startWidth - deltaX;

          // 限制范围（280px - 600px），与 CSS 中的 min-width/max-width 保持一致
          if (newWidth >= 280 && newWidth <= 600) {
            rightPanel.style.width = newWidth + 'px';
          }
        }

        function onMouseUp() {
          // 拖拽结束，及时销毁事件，释放内存
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = 'default';
        }

        // 监听全局 document，保证鼠标滑出拖拽条时依然能平稳响应
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
      });
    }
  };

  // 挂载到全局命名空间上
  window.MemeGen.LayoutManager = LayoutManager;
})();   