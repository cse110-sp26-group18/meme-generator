var MemeGen = window.MemeGen || {};

MemeGen.TextBox = (function () {
  var idCounter = 0;
  var FONT_SIZE_STEP = 4;
  var FONT_SIZE_MIN  = 8;
  var FONT_SIZE_MAX  = 120;

  // Single source of truth for the font list — shared by each text box's own
  // dropdown (below) and the global font-settings menu in app.js, so the two
  // never drift out of sync. Exposed as MemeGen.TextBox.FONTS.
  var FONTS = [
    { label: 'Impact',       value: 'Impact' },
    // ── Meme-style display fonts used by the "fonts" cycle button in app.js.
    // Loaded via Google Fonts in index.html; browsers without network
    // access fall back to the system default sans-serif.
    { label: 'Anton',        value: 'Anton' },
    { label: 'Bangers',      value: 'Bangers' },
    { label: 'Luckiest Guy', value: 'Luckiest Guy' },
    { label: 'Oswald',       value: 'Oswald' },
    { label: 'Arial',        value: 'Arial' },
    { label: 'Comic Sans', value: "'Comic Sans MS', cursive" },
    { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
    { label: 'Montserrat', value: "'Montserrat', sans-serif" }
  ];

  /**
   * @constructor
   * @param {number} x - initial left offset in px relative to the container
   * @param {number} y - initial top offset in px relative to the container
   * @param {HTMLElement} container - element the text box DOM node is appended to
   */
  function TextBox(x, y, container) {
    this.id = ++idCounter;
    this.container = container;
    this.x = x;
    this.y = y;
    this.width = 200;
    this.height = 60;
    this.fontSize = 24;        // authoritative font size in px — shared by live editor and exporter
    this.fontFamily = 'Impact';
    this.borderEnabled = true;
    this.selected = false;
    this.editing = false;
    this._handleKeyDown = null;
    this.onDelete = null;
    this.onSelect = null;
    // Image-relative position/size ratios, populated by captureRelativeState
    // every time the box is placed / moved / resized. ResizeObserver in
    // app.js calls TextBoxManager.syncTextBoxesToCanvas → applyRelativeState
    // on each box so positions follow the container when CSS scales the
    // canvas with the viewport / library panel.
    this.relativeState = null;

    this._buildDOM();
    this._bindEvents();
  }

  /**
   * Creates and appends all DOM elements for the text box (toolbar, textarea,
   *   resize handles). Stores references to interactive elements on `this`.
   * @private
   */
  TextBox.prototype._buildDOM = function () {
    var el = document.createElement('div');
    el.className = 'text-box';
    el.style.left = this.x + 'px';
    el.style.top = this.y + 'px';
    el.style.width = this.width + 'px';
    el.style.height = this.height + 'px';
    // dataset writes a data-textbox-id HTML attribute, usable as a DOM hook
    // for tests and for disambiguating which box triggered an event.
    el.dataset.textboxId = this.id;

    var toolbar = document.createElement('div');
    toolbar.className = 'text-box-toolbar';

    // ✥ Move — kept in DOM for desktop drag and existing tests; hidden on
    // mobile via CSS (the whole toolbar is display:none on mobile).
    var moveBtn = document.createElement('button');
    moveBtn.className = 'move-handle';
    moveBtn.textContent = '✥ Move';
    moveBtn.title = 'Drag to move';
    toolbar.appendChild(moveBtn);

    // Separator
    var sep = document.createElement('span');
    sep.className = 'toolbar-sep';
    toolbar.appendChild(sep);

    // A− / size display / A+
    var fontSizeDecBtn = document.createElement('button');
    fontSizeDecBtn.className = 'font-size-btn';
    fontSizeDecBtn.textContent = 'A−';
    fontSizeDecBtn.title = 'Decrease text size';
    toolbar.appendChild(fontSizeDecBtn);

    var fontSizeDisplay = document.createElement('span');
    fontSizeDisplay.className = 'font-size-display';
    fontSizeDisplay.textContent = this.fontSize + 'px';
    toolbar.appendChild(fontSizeDisplay);

    var fontSizeIncBtn = document.createElement('button');
    fontSizeIncBtn.className = 'font-size-btn';
    fontSizeIncBtn.textContent = 'A+';
    fontSizeIncBtn.title = 'Increase text size';
    toolbar.appendChild(fontSizeIncBtn);

    // Separator
    var sep2 = document.createElement('span');
    sep2.className = 'toolbar-sep';
    toolbar.appendChild(sep2);

    // Font family dropdown
    var fontSelect = document.createElement('select');
    fontSelect.className = 'font-select';

    FONTS.forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      fontSelect.appendChild(opt);
    });

    toolbar.appendChild(fontSelect);

    // Border toggle
    var borderBtn = document.createElement('button');
    borderBtn.className = 'border-toggle';
    borderBtn.textContent = 'Border: ON';
    toolbar.appendChild(borderBtn);

    // Delete
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete text box';
    toolbar.appendChild(deleteBtn);

    el.appendChild(toolbar);

    var textarea = document.createElement('textarea');
    textarea.className = 'text-content';
    textarea.placeholder = 'Enter text...';
    el.appendChild(textarea);

    var corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    corners.forEach(function (corner) {
      var handle = document.createElement('div');
      handle.className = 'resize-handle ' + corner;
      handle.dataset.corner = corner;
      el.appendChild(handle);
    });

    // --- Mobile long-press quick-action menu ---
    // Hidden by default. DragResize.js opens it after a hold-without-drag.
    // CSS hides this on desktop. Same DOM lives on every text box.
    var quickMenu = document.createElement('div');
    quickMenu.className = 'quick-action-menu';
    quickMenu.setAttribute('role', 'menu');

    var qEditBtn = document.createElement('button');
    qEditBtn.type = 'button';
    qEditBtn.className = 'quick-action-btn quick-action-edit';
    qEditBtn.textContent = 'Edit';
    quickMenu.appendChild(qEditBtn);

    var qBorderBtn = document.createElement('button');
    qBorderBtn.type = 'button';
    qBorderBtn.className = 'quick-action-btn quick-action-border';
    qBorderBtn.textContent = 'Border';
    quickMenu.appendChild(qBorderBtn);

    var qDeleteBtn = document.createElement('button');
    qDeleteBtn.type = 'button';
    qDeleteBtn.className = 'quick-action-btn quick-action-delete';
    qDeleteBtn.textContent = 'Delete';
    quickMenu.appendChild(qDeleteBtn);

    el.appendChild(quickMenu);

    // Mobile-only X delete button — shown on the right of selected text boxes
    // on mobile. Replaces the need for the bottom toolbar just for deletion.
    var mobileDeleteBtn = document.createElement('button');
    mobileDeleteBtn.type = 'button';
    mobileDeleteBtn.className = 'mobile-delete-btn';
    mobileDeleteBtn.textContent = '×';
    mobileDeleteBtn.setAttribute('aria-label', 'Delete text box');
    el.appendChild(mobileDeleteBtn);

    this.el = el;
    this.textarea = textarea;
    this.fontSelect = fontSelect;
    this.borderBtn = borderBtn;
    this.deleteBtn = deleteBtn;
    this.moveBtn = moveBtn;
    this.fontSizeDecBtn = fontSizeDecBtn;
    this.fontSizeIncBtn = fontSizeIncBtn;
    this.fontSizeDisplay = fontSizeDisplay;
    this.toolbar = toolbar;
    this.quickMenu = quickMenu;
    this.qEditBtn = qEditBtn;
    this.qBorderBtn = qBorderBtn;
    this.qDeleteBtn = qDeleteBtn;
    this.mobileDeleteBtn = mobileDeleteBtn;

    this.container.appendChild(el);

    // Apply initial font size so the inline style matches this.fontSize from
    // the start — no dependency on the CSS value or offsetHeight formula.
    this.applyFontSize(this.fontSize);
  };

  /**
   * Wires up all DOM event listeners for the text box (font controls, border
   *   toggle, delete, selection, and keyboard delete).
   * @private
   */
  TextBox.prototype._bindEvents = function () {
    var self = this;

    this.fontSelect.addEventListener('change', function () {
      self.fontFamily = this.value;
      self.textarea.style.fontFamily = this.value;
    });

    this.borderBtn.addEventListener('click', function () {
      self.borderEnabled = !self.borderEnabled;
      this.textContent = self.borderEnabled ? 'Border: ON' : 'Border: OFF';

      if (self.borderEnabled) {
        self.textarea.classList.remove('no-border');
      } else {
        self.textarea.classList.add('no-border');
      }
    });

    this.deleteBtn.addEventListener('click', function () {
      self.destroy();
    });

    this.textarea.addEventListener('input', function () {
      // The box is the fixed boundary; keep the text fitting inside it by
      // shrinking the font when it would overflow and growing it back when
      // there is spare room.
      self.fitToText();
    });

    // A− decreases font size and shrinks the box to match
    this.fontSizeDecBtn.addEventListener('click', function () {
      var newSize = self.fontSize - FONT_SIZE_STEP;
      self.applyFontSize(newSize);
      self._fitBoxToFontSize();
    });

    // A+ increases font size and grows the box to match
    this.fontSizeIncBtn.addEventListener('click', function () {
      var newSize = self.fontSize + FONT_SIZE_STEP;
      self.applyFontSize(newSize);
      self._fitBoxToFontSize();
    });

    // Existing textbox click behavior:
    // First click on an unselected textbox = select only.
    // Second click on the already-selected textbox = normal textarea edit.
    this.el.addEventListener('mousedown', function (e) {
      var wasSelected = self.selected;

      if (self.onSelect) {
        self.onSelect(self);
      }

      if (!wasSelected) {
        // First click: select this textbox, but do not edit yet.
        self.editing = false;

        // Blur the currently focused element so the previous text box loses its
        // caret — document.activeElement is the element that currently has focus.
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }

        // preventDefault stops the mousedown from placing the browser's text
        // cursor inside the textarea on this first click.
        e.preventDefault();
        self.textarea.blur();
      } else {
        // Second click on the same selected textbox: allow browser to edit normally.
        self.editing = true;
      }
    });

    // If the textarea receives focus naturally, we are editing text.
    this.textarea.addEventListener('focus', function () {
      self.editing = true;
    });

    // Delete key removes selected textbox only when not editing text.
    // Registered on document so it fires regardless of which element has focus.
    this._handleKeyDown = function (e) {
      if (e.key !== 'Delete' || !self.selected || self.editing) {
        return;
      }

      // Do not delete if the user is typing in another input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      e.preventDefault();
      self.destroy();
    };

    document.addEventListener('keydown', this._handleKeyDown);

    // --- Quick-action menu wiring (mobile long-press output) ---
    // Edit → focus the textarea for typing.
    // Border → reuse the existing border-toggle handler so the toolbar
    //          label / state stay in sync; no behaviour duplication.
    // Delete → only fires after this explicit second tap; the long-press
    //          itself never destroys.
    this.qEditBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.hideQuickActions();
      self.focusTextarea();
    });
    this.qBorderBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.borderBtn.click();
      self.hideQuickActions();
    });
    this.qDeleteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.destroy();
    });

    this.mobileDeleteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.destroy();
    });

    // Tap anywhere outside the menu closes it. Stored on the instance so
    // destroy() can detach it.
    this._outsideClickHandler = function (e) {
      if (!self.quickMenu.classList.contains('is-open')) return;
      if (self.quickMenu.contains(e.target)) return;
      self.hideQuickActions();
    };
    document.addEventListener('click', this._outsideClickHandler);

    // --- Mobile double-tap → focus textarea ---
    // Two single-finger touchend events within 300 ms call focusTextarea(),
    // which puts the textarea into :focus and (via the mobile pointer-events
    // gate in styles.css) makes it interactive for typing. Guards:
    //   • Pinch suppression — if DragResize.js just set el.dataset.pinchAt,
    //     skip for 500 ms so a 2-finger lift can't be misread.
    //   • Menu open — if the quick-action menu is open, taps belong to it.
    //   • Multi-touch — only single-finger ends count.
    // Never deletes — Delete remains gated behind the visible × button or
    // the long-press menu's Delete action.
    var lastTapAt = 0;
    this.el.addEventListener('touchend', function (e) {
      if (self.quickMenu && self.quickMenu.classList.contains('is-open')) return;
      if (e.touches && e.touches.length > 0) return;
      if (e.changedTouches && e.changedTouches.length !== 1) return;
      var pinchAt = parseInt(self.el.dataset.pinchAt || '0', 10);
      if (pinchAt && Date.now() - pinchAt < 500) return;
      var now = Date.now();
      if (now - lastTapAt < 300) {
        self.focusTextarea();
        if (typeof e.preventDefault === 'function') e.preventDefault();
        lastTapAt = 0;
      } else {
        lastTapAt = now;
      }
    });
  };

  /**
   * Programmatically sets the font family. Updates this.fontFamily, the
   *   textarea inline style, and the per-box dropdown so its selected value
   *   stays in sync. Mirrors the fontSelect 'change' handler — used by the
   *   global font-settings menu to re-font every box at once.
   * @param {string} value - a font value from MemeGen.TextBox.FONTS
   */
  TextBox.prototype.setFontFamily = function (value) {
    this.fontFamily = value;
    this.textarea.style.fontFamily = value;
    if (this.fontSelect) {
      this.fontSelect.value = value;
    }
  };

  /**
   * Single source of truth for font size changes. Updates this.fontSize,
   *   the textarea inline style, and the toolbar display. Called from
   *   DragResize during resize and from the A+/A− click handlers.
   * @param {number} size - desired font size in px, clamped to
   *   FONT_SIZE_MIN–FONT_SIZE_MAX
   */
  TextBox.prototype.applyFontSize = function (size) {
    this.fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)));
    this.textarea.style.fontSize = this.fontSize + 'px';

    if (this.fontSizeDisplay) {
      this.fontSizeDisplay.textContent = this.fontSize + 'px';
    }
  };

  /**
   * Resizes box height to a natural proportion for the current font size.
   *   Inverse of the resize formula: height = fontSize / 0.4 = fontSize * 2.5.
   * @private
   */
  TextBox.prototype._fitBoxToFontSize = function () {
    var newHeight = Math.max(40, Math.round(this.fontSize * 2.5));
    this.el.style.height = newHeight + 'px';
    // Box height changed via A+/A− or pinch-resize — refresh ratios so the
    // next viewport/library resize re-applies the new proportional height.
    this.captureRelativeState();
  };

  /**
   * Shrinks or grows the box to hug the textarea content with no extra slack.
   *   Measures each line's width using a canvas 2D context (consistent with
   *   Exporter). Horizontal chrome = 16px; vertical chrome = 12px.
   *   Floored at the CSS min sizes (80×40 px).
   */
  TextBox.prototype.fitToText = function () {
    var text = this.textarea.value;
    var boxWidth  = parseInt(this.el.style.width, 10)  || this.el.offsetWidth  || this.width;
    var boxHeight = parseInt(this.el.style.height, 10) || this.el.offsetHeight || this.height;

    var innerWidth  = Math.max(1, boxWidth  - 16);
    var innerHeight = Math.max(1, boxHeight - 12);

    // A single off-screen canvas is reused across all TextBox instances for
    // text measurement — canvas ctx measurement matches what Exporter draws,
    // and reusing it avoids allocating a new canvas element on every keystroke.
    var ctx = (TextBox._measureCanvas || (TextBox._measureCanvas = document.createElement('canvas'))).getContext('2d');

    var best = FONT_SIZE_MIN;
    for (var size = FONT_SIZE_MIN; size <= FONT_SIZE_MAX; size++) {
      ctx.font = size + 'px ' + this.fontFamily;

      var lines = MemeGen.Exporter.wrapText(ctx, text, innerWidth);
      var totalHeight = lines.length * size * 1.2;

      var widest = 0;
      for (var i = 0; i < lines.length; i++) {
        var w = ctx.measureText(lines[i]).width;
        if (w > widest) widest = w;
      }

      if (totalHeight <= innerHeight && widest <= innerWidth) {
        best = size;
      }
    }

    this.applyFontSize(best);
  };

  /**
   * Marks the text box as selected and adds the selected CSS class.
   */
  TextBox.prototype.select = function () {
    this.selected = true;
    this.el.classList.add('selected');
  };

  /**
   * Marks the text box as deselected, blurs the textarea, and removes
   *   the selected CSS class.
   */
  TextBox.prototype.deselect = function () {
    this.selected = false;
    this.editing = false;

    // Important: remove the typing cursor when clicking away or selecting another textbox.
    this.textarea.blur();

    this.el.classList.remove('selected');
    this.hideQuickActions();
    // On mobile the unfocused textarea has pointer-events: none so taps
    // pass through to the .text-box parent for hold-to-move. Blurring on
    // deselect restores that gating once a different box (or no box) is
    // active. On desktop blur is harmless — focus would have been lost
    // anyway when the user clicked outside.
  };

  TextBox.prototype.showQuickActions = function () {
    if (!this.quickMenu) return;
    this.quickMenu.classList.add('is-open');
    this.el.classList.add('menu-open');
  };

  TextBox.prototype.hideQuickActions = function () {
    if (!this.quickMenu) return;
    this.quickMenu.classList.remove('is-open');
    this.el.classList.remove('menu-open');
  };

  /**
   * Focuses the textarea both synchronously and deferred to handle both
   *   mobile touch gestures and desktop mousedown focus-stealing.
   */
  TextBox.prototype.focusTextarea = function () {
    var self = this;
    self.editing = true;
    self.textarea.focus();
    // setTimeout 0 defers the second focus call to after the current event
    // finishes — needed on desktop where the originating mousedown can
    // steal focus back before the synchronous focus() takes effect.
    setTimeout(function () { self.textarea.focus(); }, 0);
  };

  /**
   * Removes the text box from the DOM, cleans up the keydown listener,
   *   and fires the onDelete callback if set.
   */
  TextBox.prototype.destroy = function () {
    if (this._handleKeyDown) {
      document.removeEventListener('keydown', this._handleKeyDown);
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }

    if (this.onDelete) {
      this.onDelete(this);
    }

    this.el.remove();
  };

  /**
   * @returns {Object} snapshot of the text box's current position, size, and
   *   styling for use by the Exporter — contains x, y, width, height, text,
   *   fontFamily, fontSize, and borderEnabled
   */
  TextBox.prototype.getState = function () {
    const c = this.container;
    return {
      x: this.el.offsetLeft,
      y: this.el.offsetTop,
      width: this.el.offsetWidth,
      height: this.el.offsetHeight,
      text: this.textarea.value,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,       // explicit state — read by Exporter directly
      borderEnabled: this.borderEnabled,
      // Responsive-export hints. When the canvas BITMAP size (canvas.width)
      // differs from the container DISPLAY size, Exporter scales x/y/width/
      // fontSize by canvas.width / containerWidth so text lands at the same
      // visual position on the exported PNG as on screen. Defaults to 0
      // when the container isn't measurable (jsdom test stubs); Exporter
      // treats that as "scale = 1" for backward-compat.
      containerWidth:  c ? c.offsetWidth  || 0 : 0,
      containerHeight: c ? c.offsetHeight || 0 : 0
    };
  };

  /**
   * Reads the box's current pixel position/size against the container's
   * current display dimensions and stores image-relative ratios on
   * `this.relativeState`. Called after every user-initiated move / resize
   * / create so the latest authoritative position is recorded.
   * No-op if the container hasn't been measured yet (offsetWidth = 0).
   */
  TextBox.prototype.captureRelativeState = function () {
    const c = this.container;
    if (!c) return;
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    if (!cw || !ch) return;
    this.relativeState = {
      xRatio:      this.el.offsetLeft   / cw,
      yRatio:      this.el.offsetTop    / ch,
      widthRatio:  this.el.offsetWidth  / cw,
      heightRatio: this.el.offsetHeight / ch
    };
  };

  /**
   * Reapplies the stored ratios × current container display size, so the
   * box visually tracks the canvas when CSS resizes it (viewport change /
   * desktop library panel drag). Triggers fitToText so the font scales
   * proportionally with the new box dimensions. No-op without ratios or
   * a measurable container.
   */
  TextBox.prototype.applyRelativeState = function () {
    const r = this.relativeState;
    if (!r) return;
    const c = this.container;
    if (!c) return;
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    if (!cw || !ch) return;
    this.el.style.left   = (r.xRatio      * cw) + 'px';
    this.el.style.top    = (r.yRatio      * ch) + 'px';
    this.el.style.width  = (r.widthRatio  * cw) + 'px';
    this.el.style.height = (r.heightRatio * ch) + 'px';
    if (typeof this.fitToText === 'function') this.fitToText();
  };

  TextBox.prototype.keepInsideContainer = function () {
    var maxLeft = Math.max(0, this.container.offsetWidth - this.el.offsetWidth);
    var maxTop = Math.max(0, this.container.offsetHeight - this.el.offsetHeight);

    var newLeft = Math.max(0, Math.min(this.el.offsetLeft, maxLeft));
    var newTop = Math.max(0, Math.min(this.el.offsetTop, maxTop));

    this.el.style.left = newLeft + 'px';
    this.el.style.top = newTop + 'px';
  };

  // Static font list — read by app.js to build the global font-settings menu.
  TextBox.FONTS = FONTS;

  return TextBox;
})();

window.MemeGen = MemeGen;
