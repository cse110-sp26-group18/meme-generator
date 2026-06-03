var MemeGen = window.MemeGen || {};

MemeGen.DragResize = (function () {
  var MIN_WIDTH = 80;
  var MIN_HEIGHT = 40;

  /**
   * Attaches move and resize event listeners to a TextBox instance. Move is
   *   handled via pointer capture on the move handle; resize is handled via
   *   mouse events on the corner handles.
   * @param {MemeGen.TextBox} textBox - the text box instance to make
   *   draggable and resizable
   */
  function attach(textBox) {
    var el = textBox.el;
    var container = textBox.container;
    var moveBtn = textBox.moveBtn;

    var resizing = false;
    var resizeCorner = null;
    var startX, startY, startLeft, startTop, startWidth, startHeight;

    // --- Move via dedicated handle using pointer capture ---
    moveBtn.addEventListener('pointerdown', function (e) {
      // setPointerCapture routes all subsequent pointer events for this
      // pointerId to moveBtn, even when the cursor leaves the element —
      // this keeps the drag live when the user moves the mouse quickly.
      moveBtn.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.offsetLeft;
      startTop = el.offsetTop;
    });

    moveBtn.addEventListener('pointermove', function (e) {
      // hasPointerCapture guards against spurious pointermove events that
      // fire before setPointerCapture takes effect.
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
        // Release capture so the browser resumes normal pointer event routing.
        moveBtn.releasePointerCapture(e.pointerId);
      }
    });

    // --- Resize via corner handles using mouse events ---
    // Mouse events (rather than pointer events) are used here because resize
    // handles are small targets that need document-level tracking, and the
    // simpler mouse API is sufficient for this desktop-focused interaction.
    el.addEventListener('mousedown', function (e) {
      var target = e.target;
      if (!target.classList.contains('resize-handle')) return;

      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      // dataset.corner holds the corner identifier set as a data-corner attribute
      // on each handle element, used to determine the resize direction below.
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

    // mousemove is registered on document so the resize continues even when
    // the cursor moves outside the element during a fast drag.
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
