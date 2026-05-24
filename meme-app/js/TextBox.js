var MemeGen = window.MemeGen || {};

MemeGen.TextBox = (function () {
  var idCounter = 0;
  var FONT_SIZE_STEP = 4;
  var FONT_SIZE_MIN  = 8;
  var FONT_SIZE_MAX  = 120;

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
    this.onDelete = null;
    this.onSelect = null;

    this._buildDOM();
    this._bindEvents();
  }

  TextBox.prototype._buildDOM = function () {
    var el = document.createElement('div');
    el.className = 'text-box';
    el.style.left = this.x + 'px';
    el.style.top = this.y + 'px';
    el.style.width = this.width + 'px';
    el.style.height = this.height + 'px';
    el.dataset.textboxId = this.id;

    var toolbar = document.createElement('div');
    toolbar.className = 'text-box-toolbar';

    // ✥ Move — first, easy to grab
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
    var fonts = [
      { label: 'Impact',    value: 'Impact' },
      { label: 'Arial',     value: 'Arial' },
      { label: 'Comic Sans', value: "'Comic Sans MS', cursive" },
      { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
      { label: 'Montserrat', value: "'Montserrat', sans-serif" }
    ];
    fonts.forEach(function (f) {
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

    this.container.appendChild(el);

    // Apply initial font size so the inline style matches this.fontSize from
    // the start — no dependency on the CSS value or offsetHeight formula.
    this.applyFontSize(this.fontSize);
  };

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

    this.el.addEventListener('mousedown', function (e) {
      if (self.onSelect) {
        self.onSelect(self);
      }
    });

    // --- Double-tap (touch shortcut): focus the textarea for quick editing.
    // Deliberately safe — does NOT delete. The visible "×" button stays the
    // only way to remove a box from the toolbar; the long-press menu also
    // offers a Delete that requires an explicit second tap.
    // Skips touchend events that ended a pinch (multi-touch) or that just
    // opened the quick-action menu, so finger-lifts can never be misread.
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

    // --- Quick-action menu (mobile long-press) ---
    // Edit → focus the textarea for typing.
    // Border → reuse the existing border-toggle handler so state stays in sync.
    // Delete → only fires after this explicit second tap; long-press alone
    // never deletes. Each action closes the menu (Delete via destroy()).
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

    // Tap anywhere outside the menu closes it. We attach to the document so
    // a tap on the canvas, header, body, etc. all dismiss the menu cleanly.
    // Stored on the instance so destroy() can detach it.
    this._outsideClickHandler = function (e) {
      if (!self.quickMenu.classList.contains('is-open')) return;
      if (self.quickMenu.contains(e.target)) return;
      self.hideQuickActions();
    };
    document.addEventListener('click', this._outsideClickHandler);
  };

  // Single source of truth for font size changes.
  // Updates this.fontSize, the textarea inline style, and the toolbar display.
  // Call this from DragResize during resize AND from A+/A− click handlers.
  TextBox.prototype.applyFontSize = function (size) {
    this.fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)));
    this.textarea.style.fontSize = this.fontSize + 'px';
    if (this.fontSizeDisplay) {
      this.fontSizeDisplay.textContent = this.fontSize + 'px';
    }
  };

  // Resize the box height to the natural proportion for the current font size.
  // Inverse of the resize formula: height = fontSize / 0.4 = fontSize * 2.5
  TextBox.prototype._fitBoxToFontSize = function () {
    var newHeight = Math.max(40, Math.round(this.fontSize * 2.5));
    this.el.style.height = newHeight + 'px';
  };

  TextBox.prototype.select = function () {
    this.selected = true;
    this.el.classList.add('selected');
  };

  TextBox.prototype.deselect = function () {
    this.selected = false;
    this.el.classList.remove('selected');
    this.hideQuickActions();
    // On mobile the unfocused textarea has pointer-events: none so taps
    // pass through to the .text-box parent for hold-to-move. Blurring on
    // deselect restores that gating once a different box (or no box) is
    // active. On desktop blur is harmless — focus would have been lost
    // anyway when the user clicked outside.
    if (document.activeElement === this.textarea) {
      this.textarea.blur();
    }
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

  // Call this once after the text box is fully created and selected.
  // Fires focus both synchronously (needed for mobile touch gesture) and
  // deferred (needed on desktop where the originating mousedown can steal
  // focus back after the event finishes).
  TextBox.prototype.focusTextarea = function () {
    var self = this;
    self.textarea.focus();
    setTimeout(function () { self.textarea.focus(); }, 0);
  };

  TextBox.prototype.destroy = function () {
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this.onDelete) {
      this.onDelete(this);
    }
    this.el.remove();
  };

  TextBox.prototype.getState = function () {
    return {
      x: this.el.offsetLeft,
      y: this.el.offsetTop,
      width: this.el.offsetWidth,
      height: this.el.offsetHeight,
      text: this.textarea.value,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,       // explicit state — read by Exporter directly
      borderEnabled: this.borderEnabled
    };
  };

  return TextBox;
})();

window.MemeGen = MemeGen;
