var MemeGen = window.MemeGen || {};

MemeGen.DragResize = (function () {
  var MIN_WIDTH = 80;
  var MIN_HEIGHT = 40;

  function attach(textBox) {
    var el = textBox.el;
    var container = textBox.container;

    var dragging = false;
    var resizing = false;
    var resizeCorner = null;
    var startX, startY, startLeft, startTop, startWidth, startHeight;

    el.addEventListener('mousedown', function (e) {
      var target = e.target;

      if (target.classList.contains('resize-handle')) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        resizeCorner = target.dataset.corner;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = el.offsetLeft;
        startTop = el.offsetTop;
        startWidth = el.offsetWidth;
        startHeight = el.offsetHeight;
        return;
      }

      if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' || target.tagName === 'OPTION') {
        return;
      }

      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.offsetLeft;
      startTop = el.offsetTop;
    });

    document.addEventListener('mousemove', function (e) {
      if (dragging) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        var newLeft = startLeft + dx;
        var newTop = startTop + dy;

        var maxLeft = container.offsetWidth - el.offsetWidth;
        var maxTop = container.offsetHeight - el.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
      }

      if (resizing) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        var newWidth, newHeight, newLeft, newTop;

        switch (resizeCorner) {
          case 'bottom-right':
            newWidth = Math.max(MIN_WIDTH, startWidth + dx);
            newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
            el.style.width = newWidth + 'px';
            el.style.height = newHeight + 'px';
            break;

          case 'bottom-left':
            newWidth = Math.max(MIN_WIDTH, startWidth - dx);
            newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
            newLeft = startLeft + (startWidth - newWidth);
            el.style.width = newWidth + 'px';
            el.style.height = newHeight + 'px';
            el.style.left = newLeft + 'px';
            break;

          case 'top-right':
            newWidth = Math.max(MIN_WIDTH, startWidth + dx);
            newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
            newTop = startTop + (startHeight - newHeight);
            el.style.width = newWidth + 'px';
            el.style.height = newHeight + 'px';
            el.style.top = newTop + 'px';
            break;

          case 'top-left':
            newWidth = Math.max(MIN_WIDTH, startWidth - dx);
            newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
            newLeft = startLeft + (startWidth - newWidth);
            newTop = startTop + (startHeight - newHeight);
            el.style.width = newWidth + 'px';
            el.style.height = newHeight + 'px';
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
            break;
        }
      }
    });

    document.addEventListener('mouseup', function () {
      dragging = false;
      resizing = false;
      resizeCorner = null;
    });
  }

  return { attach: attach };
})();

window.MemeGen = MemeGen;
