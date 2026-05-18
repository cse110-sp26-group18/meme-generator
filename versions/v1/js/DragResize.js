var MemeGen = window.MemeGen || {};

MemeGen.DragResize = (function () {
  var MIN_WIDTH = 80;
  var MIN_HEIGHT = 40;

  function attach(textBox) {
    var el = textBox.el;
    var container = textBox.container;
    var moveBtn = textBox.moveBtn;

    var resizing = false;
    var resizeCorner = null;
    var startX, startY, startLeft, startTop, startWidth, startHeight;

    // --- Move via dedicated handle using pointer capture ---
    moveBtn.addEventListener('pointerdown', function (e) {
      moveBtn.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.offsetLeft;
      startTop = el.offsetTop;
    });

    moveBtn.addEventListener('pointermove', function (e) {
      if (!moveBtn.hasPointerCapture(e.pointerId)) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var newLeft = Math.max(0, Math.min(startLeft + dx, container.offsetWidth - el.offsetWidth));
      var newTop  = Math.max(0, Math.min(startTop  + dy, container.offsetHeight - el.offsetHeight));
      el.style.left = newLeft + 'px';
      el.style.top  = newTop  + 'px';
    });

    moveBtn.addEventListener('pointerup', function (e) {
      if (moveBtn.hasPointerCapture(e.pointerId)) {
        moveBtn.releasePointerCapture(e.pointerId);
      }
    });

    // --- Resize via corner handles using mouse events ---
    el.addEventListener('mousedown', function (e) {
      var target = e.target;
      if (!target.classList.contains('resize-handle')) return;

      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      resizeCorner = target.dataset.corner;
      startX = e.clientX;
      startY = e.clientY;
      startLeft   = el.offsetLeft;
      startTop    = el.offsetTop;
      startWidth  = el.offsetWidth;
      startHeight = el.offsetHeight;
    });

    document.addEventListener('mousemove', function (e) {
      if (!resizing) return;

      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var newWidth, newHeight, newLeft, newTop;

      switch (resizeCorner) {
        case 'bottom-right':
          newWidth  = Math.max(MIN_WIDTH,  startWidth  + dx);
          newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
          el.style.width  = newWidth  + 'px';
          el.style.height = newHeight + 'px';
          break;

        case 'bottom-left':
          newWidth  = Math.max(MIN_WIDTH,  startWidth  - dx);
          newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
          newLeft   = startLeft + (startWidth - newWidth);
          el.style.width  = newWidth  + 'px';
          el.style.height = newHeight + 'px';
          el.style.left   = newLeft   + 'px';
          break;

        case 'top-right':
          newWidth  = Math.max(MIN_WIDTH,  startWidth  + dx);
          newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
          newTop    = startTop + (startHeight - newHeight);
          el.style.width  = newWidth  + 'px';
          el.style.height = newHeight + 'px';
          el.style.top    = newTop    + 'px';
          break;

        case 'top-left':
          newWidth  = Math.max(MIN_WIDTH,  startWidth  - dx);
          newHeight = Math.max(MIN_HEIGHT, startHeight - dy);
          newLeft   = startLeft + (startWidth  - newWidth);
          newTop    = startTop  + (startHeight - newHeight);
          el.style.width  = newWidth  + 'px';
          el.style.height = newHeight + 'px';
          el.style.left   = newLeft   + 'px';
          el.style.top    = newTop    + 'px';
          break;
      }

      // Keep font size in sync with box height so live editor and exporter always match.
      textBox.applyFontSize(newHeight * 0.4);
    });

    document.addEventListener('mouseup', function () {
      resizing = false;
      resizeCorner = null;
    });
  }

  return { attach: attach };
})();

window.MemeGen = MemeGen;
