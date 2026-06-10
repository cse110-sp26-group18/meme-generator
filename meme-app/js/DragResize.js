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
    var resizing = false;
    var resizeCorner = null;
    var startX, startY, startLeft, startTop, startWidth, startHeight;

    //delete??
    // --- Move via dedicated handle using pointer capture ---
    // body.is-moving-text-box is a per-drag flag that lets CSS take any
    // overlay (e.g. the copy button at the canvas's top-right) out of
    // the hit-test while the drag is live. Without it, the overlay
    // intercepts the pointer the moment the text box passes underneath
    // and the move stutters or stops.
    // function endMoveDrag(e) {
    //   if (e && e.pointerId !== undefined && moveBtn.hasPointerCapture(e.pointerId)) {
    //     moveBtn.releasePointerCapture(e.pointerId);
    //   }
    //   document.body.classList.remove('is-moving-text-box');
    // }

    el.addEventListener('pointercancel', function (e) {
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    });

    // --- Move selected textbox directly, like Google Slides ---
    // body.is-moving-text-box lets CSS disable overlays during drag so
    // they do not intercept the pointer and make movement stutter.
    var moving = false;
    var movePointerId = -1;

    function endMoveDrag(e) {
      if (e && e.pointerId !== undefined && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }

      moving = false;
      movePointerId = -1;
      document.body.classList.remove('is-moving-text-box');

      if (typeof textBox.captureRelativeState === 'function') {
        textBox.captureRelativeState();
      }
    }

    el.addEventListener('pointerdown', function (e) {
      var target = e.target;

      if (target.classList.contains('resize-handle')) return;
      if (target.closest('.text-box-toolbar')) return;
      if (target.closest('.text-box-delete-btn')) return;
      if (!textBox.selected) return;

      // Only track the first pointer — ignore additional fingers so they
      // don't overwrite startX/Y and cause position glitching during pinch.
      if (moving) return;

      moving = true;
      movePointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);

      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.offsetLeft;
      startTop = el.offsetTop;

      document.body.classList.add('is-moving-text-box');
    });

    el.addEventListener('pointermove', function (e) {
      if (!moving || e.pointerId !== movePointerId || !el.hasPointerCapture(e.pointerId)) {
        return;
      }

      // Pinch takes over positioning — don't fight it with the pointer handler.
      if (pinchActive) return;

      var dx = e.clientX - startX;
      var dy = e.clientY - startY;

      var maxLeft = Math.max(0, container.offsetWidth - el.offsetWidth);
      var maxTop = Math.max(0, container.offsetHeight - el.offsetHeight);

      var newLeft = Math.max(0, Math.min(startLeft + dx, maxLeft));
      var newTop = Math.max(0, Math.min(startTop + dy, maxTop));

      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
    });

    el.addEventListener('pointerup', endMoveDrag);
    el.addEventListener('pointercancel', endMoveDrag);
    el.addEventListener('lostpointercapture', endMoveDrag);

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

      // Rescale the font to the largest size that fits the new box dimensions,
      // so the text fills the box without overflowing (and the exporter matches).
      textBox.fitToText();
    });

    document.addEventListener('mouseup', function () {
      if (resizing && typeof textBox.captureRelativeState === 'function') {
        textBox.captureRelativeState();
      }
      resizing = false;
      resizeCorner = null;
    });

    // --- Pinch-to-resize (touch shortcut) ---
    // Two-finger pinch on the selected text box scales the font size via the
    // same applyFontSize path used by the A−/A+ buttons and corner-resize
    // drag — so export, the live editor, and the toolbar size display all
    // stay in sync automatically. Single-finger touches inside the textarea
    // are untouched so typing still works.
    var pinchActive = false;
    var pinchStartDist = 0;
    var pinchStartFontSize = 0;
    var pinchStartMidX = 0;
    var pinchStartMidY = 0;
    var pinchStartElLeft = 0;
    var pinchStartElTop = 0;

    function touchDistance(t1, t2) {
      var dx = t1.clientX - t2.clientX;
      var dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    el.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length !== 2) return;
      pinchActive = true;
      pinchStartDist = touchDistance(e.touches[0], e.touches[1]);
      pinchStartFontSize = textBox.fontSize;
      pinchStartMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      pinchStartMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchStartElLeft = el.offsetLeft;
      pinchStartElTop = el.offsetTop;
      el.dataset.pinchAt = String(Date.now());
      resetHold();
      if (typeof textBox.hideQuickActions === 'function') {
        textBox.hideQuickActions();
      }
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }, { passive: false });

    el.addEventListener('touchmove', function (e) {
      if (!pinchActive) return;
      if (!e.touches || e.touches.length < 2) return;
      if (pinchStartDist <= 0) return;
      if (typeof e.preventDefault === 'function') e.preventDefault();

      // Scale font size.
      var newDist = touchDistance(e.touches[0], e.touches[1]);
      var scale = newDist / pinchStartDist;
      textBox.applyFontSize(pinchStartFontSize * scale);
      if (typeof textBox.fitBoxToText === 'function') {
        textBox.fitBoxToText();
      }

      // Translate: keep the box centered on the midpoint of the two fingers.
      var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      var maxLeft = Math.max(0, container.offsetWidth - el.offsetWidth);
      var maxTop = Math.max(0, container.offsetHeight - el.offsetHeight);
      el.style.left = Math.max(0, Math.min(pinchStartElLeft + midX - pinchStartMidX, maxLeft)) + 'px';
      el.style.top  = Math.max(0, Math.min(pinchStartElTop  + midY - pinchStartMidY, maxTop))  + 'px';
    }, { passive: false });

    el.addEventListener('touchend', function (e) {
      if (!pinchActive) return;
      if (e.touches && e.touches.length >= 2) return;
      pinchActive = false;
      pinchStartDist = 0;
      el.dataset.pinchAt = String(Date.now());
      if (typeof textBox.fitBoxToText === 'function') {
        textBox.fitBoxToText();
      }
      if (typeof textBox.captureRelativeState === 'function') {
        textBox.captureRelativeState();
      }
      textBox.deselect();
    });

    // --- Hold-to-move + long-press menu (touch only) ---
    // Replaces the mobile Move button. State machine on a single touch:
    //   1. touchstart on .text-box (not on toolbar / handles / focused
    //      textarea / quick-action menu) starts a HOLD_MS timer.
    //   2. Movement >DRAG_THRESHOLD_PX BEFORE the timer fires cancels the
    //      gesture entirely (user is scrolling).
    //   3. When the timer fires we set holdComplete and add .hold-active
    //      for visual confirmation.
    //   4. Movement AFTER the timer fires drags the box, clamped to the
    //      canvas, identical math to the existing move-handle handler.
    //   5. Release without movement opens the quick-action menu.
    // Pinch (2nd finger) wins outright: resetHold() clears all state.
    var HOLD_MS = 300;
    var DRAG_THRESHOLD_PX = 8;
    var holdTimer = null;
    var holdComplete = false;
    var holdMoved = false;
    var holdDragging = false;
    var holdStartX = 0;
    var holdStartY = 0;
    var holdElStartLeft = 0;
    var holdElStartTop = 0;
    var wasSelected = false;

    function resetHold() {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      holdComplete = false;
      holdMoved = false;
      holdDragging = false;
      el.classList.remove('hold-active');
    }

    function isInteractiveTarget(target) {
      if (!target || typeof target.closest !== 'function') return false;
      return !!(
        target.closest('.text-box-toolbar') ||
        target.closest('.resize-handle') ||
        target.closest('.quick-action-menu') ||
        // The textarea only blocks the hold when it is the active element
        // (i.e. typing). Otherwise CSS pointer-events: none routes touches
        // to the .text-box parent and e.target is the box, not the textarea.
        (target.closest('.text-content') && document.activeElement === target.closest('.text-content'))
      );
    }

    el.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length >= 2) {
        resetHold();
        return;
      }
      if (!e.touches || e.touches.length !== 1) return;
      if (isInteractiveTarget(e.target)) return;

      wasSelected = textBox.selected;
      if (typeof textBox.hideQuickActions === 'function') {
        textBox.hideQuickActions();
      }
      var t = e.touches[0];
      holdStartX = t.clientX;
      holdStartY = t.clientY;
      holdElStartLeft = el.offsetLeft;
      holdElStartTop = el.offsetTop;
      holdComplete = false;
      holdMoved = false;
      holdDragging = false;
      if (holdTimer) clearTimeout(holdTimer);
      if (textBox.selected) {
        holdTimer = setTimeout(function () {
          holdComplete = true;
          holdTimer = null;
          el.classList.add('hold-active');
        }, HOLD_MS);
      } else {
        // Unselected: any movement immediately drags; tap triggers edit on touchend.
        holdComplete = true;
      }
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      // Pinch takes over — already handled above; clear our state too.
      if (e.touches && e.touches.length >= 2) {
        resetHold();
        return;
      }
      if (!e.touches || e.touches.length !== 1) return;

      var t = e.touches[0];
      var dx = t.clientX - holdStartX;
      var dy = t.clientY - holdStartY;
      var distSq = dx * dx + dy * dy;

      if (!holdComplete) {
        if (distSq > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          // User is scrolling or scratching — abandon the gesture.
          resetHold();
        }
        return;
      }

      if (holdDragging || distSq > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        if (!holdDragging) {
          if (!wasSelected && typeof textBox.onSelect === 'function') {
            textBox.onSelect(textBox);
          }
          if (typeof textBox.hideQuickActions === 'function') {
            textBox.hideQuickActions();
          }
        }
        holdDragging = true;
        holdMoved = true;
        var newLeft = Math.max(0, Math.min(holdElStartLeft + dx, container.offsetWidth - el.offsetWidth));
        var newTop  = Math.max(0, Math.min(holdElStartTop  + dy, container.offsetHeight - el.offsetHeight));
        el.style.left = newLeft + 'px';
        el.style.top  = newTop  + 'px';
      }
    }, { passive: false });

    el.addEventListener('touchend', function (e) {
      // Multi-touch is still in progress (e.g. lifting one finger of a
      // pinch) — let the other handlers finish first.
      if (e.touches && e.touches.length > 0) return;

      if (holdComplete && holdMoved) {
        // Drag ended — suppress synthetic mouse events, save position, deselect.
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof textBox.fitBoxToText === 'function') {
          textBox.fitBoxToText();
        }
        if (typeof textBox.captureRelativeState === 'function') {
          textBox.captureRelativeState();
        }
        textBox.deselect();
      } else if (holdComplete && !holdMoved) {
        // preventDefault suppresses the synthetic mousedown/click that follows
        // touchend — needed for both branches below.
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (!wasSelected) {
          // Tap on unselected textbox → select and enter edit mode.
          if (typeof textBox.onSelect === 'function') textBox.onSelect(textBox);
          textBox.focusTextarea();
        } else {
          // Hold without drag on selected textbox → enter edit mode.
          textBox.focusTextarea();
        }
      }
      resetHold();
    });

    // In order to handle an interrupted touch gesture (i.e. incoming call, scrolling out of bounds, or system alert), the pinch state can get stuck, leaving the text box in a .hold-active state, preventing futher interactions. This resets the hold and pinch states to make gesture handling more robust.
    el.addEventListener('touchcancel', function () {
      resetHold();
      pinchActive = false;
      pinchStartDist = 0;
    });
  }

  return { attach: attach };
})();

window.MemeGen = MemeGen;
