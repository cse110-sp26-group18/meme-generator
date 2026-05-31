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
      // Manual corner-resize overrides auto-fit so typing won't shrink the box back.
      textBox.manuallyResized = true;
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

      var newWidth = startWidth;
      var newHeight = startHeight;
      var newLeft = startLeft;
      var newTop = startTop;

      var rightEdge = startLeft + startWidth;
      var bottomEdge = startTop + startHeight;

      switch (resizeCorner) {
        case 'bottom-right':
          newWidth = startWidth + dx;
          newHeight = startHeight + dy;
          break;

        case 'bottom-left':
          newLeft = startLeft + dx;

          // Do not let the left edge pass the right edge minus MIN_WIDTH
          newLeft = Math.min(newLeft, rightEdge - MIN_WIDTH);
          newLeft = Math.max(0, newLeft);

          newWidth = rightEdge - newLeft;
          newHeight = startHeight + dy;
          break;

        case 'top-right':
          newTop = startTop + dy;

          // Do not let the top edge pass the bottom edge minus MIN_HEIGHT
          newTop = Math.min(newTop, bottomEdge - MIN_HEIGHT);
          newTop = Math.max(0, newTop);

          newWidth = startWidth + dx;
          newHeight = bottomEdge - newTop;
          break;

        case 'top-left':
          newLeft = startLeft + dx;
          newTop = startTop + dy;

          // Do not let the left edge pass the right edge minus MIN_WIDTH
          newLeft = Math.min(newLeft, rightEdge - MIN_WIDTH);
          newLeft = Math.max(0, newLeft);

          // Do not let the top edge pass the bottom edge minus MIN_HEIGHT
          newTop = Math.min(newTop, bottomEdge - MIN_HEIGHT);
          newTop = Math.max(0, newTop);

          newWidth = rightEdge - newLeft;
          newHeight = bottomEdge - newTop;
          break;
      }

      // Keep right edge inside container
      if (newLeft + newWidth > container.offsetWidth) {
        newWidth = container.offsetWidth - newLeft;
      }

      // Keep bottom edge inside container
      if (newTop + newHeight > container.offsetHeight) {
        newHeight = container.offsetHeight - newTop;
      }

      // Final safety clamp
      newWidth = Math.max(MIN_WIDTH, newWidth);
      newHeight = Math.max(MIN_HEIGHT, newHeight);

      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
      el.style.width = newWidth + 'px';
      el.style.height = newHeight + 'px';

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
