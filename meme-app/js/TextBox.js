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
    this.editing = false;
    this._handleKeyDown = null;
    this.onDelete = null;
    this.onSelect = null;
    this.onErase = null;
    // Once the user drags a corner handle, auto-fit is disabled for this box
    // so their explicit sizing isn't overwritten by subsequent typing.
    this.manuallyResized = false;

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

    // Erase
    var eraseBtn = document.createElement('button');
    eraseBtn.className = 'erase-btn';
    eraseBtn.textContent = 'Erase';
    eraseBtn.title = 'Erase text from image';
    toolbar.appendChild(eraseBtn);

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

    this.el = el;
    this.textarea = textarea;
    this.fontSelect = fontSelect;
    this.borderBtn = borderBtn;
    this.eraseBtn = eraseBtn;
    this.deleteBtn = deleteBtn;
    this.moveBtn = moveBtn;
    this.fontSizeDecBtn = fontSizeDecBtn;
    this.fontSizeIncBtn = fontSizeIncBtn;
    this.fontSizeDisplay = fontSizeDisplay;
    this.toolbar = toolbar;

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

    this.eraseBtn.addEventListener('click', function () {
      if (self.onErase) {
        self.onErase(self);
      }
      self.destroy();
    });

    this.deleteBtn.addEventListener('click', function () {
      self.destroy();
    });

    this.textarea.addEventListener('input', function () {
      if (!self.manuallyResized) {
        self.fitToText();
      }
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

        // Remove typing cursor from any previous textbox.
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }

        // Stop this first click from placing the cursor in this textarea.
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
    this._handleKeyDown = function (e) {
      if (e.key !== 'Delete') {
        return;
      }

      if (!self.selected || self.editing) {
        return;
      }

      e.preventDefault();
      self.destroy();
    };

    document.addEventListener('keydown', this._handleKeyDown);
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

  // Shrink/grow the box so it hugs the textarea content with no extra slack.
  // Measures each line's width using a canvas 2d context (consistent with
  // Exporter), then sets el width/height to match. Horizontal chrome = 16px
  // (textarea padding 6px*2 + border 2px*2); vertical chrome = 12px
  // (padding 4px*2 + border 2px*2). Floored at the CSS min sizes (80x40).
  TextBox.prototype.fitToText = function () {
    var text = this.textarea.value;
    var lines = text.length ? text.split('\n') : [''];

    var ctx = (TextBox._measureCanvas || (TextBox._measureCanvas = document.createElement('canvas'))).getContext('2d');
    ctx.font = this.fontSize + 'px ' + this.fontFamily;

    var maxWidth = 0;
    for (var i = 0; i < lines.length; i++) {
      var w = ctx.measureText(lines[i]).width;
      if (w > maxWidth) maxWidth = w;
    }

    var lineHeight = this.fontSize * 1.2;
    var textHeight = lines.length * lineHeight;

    var HORIZ_CHROME = 16;
    var VERT_CHROME = 12;

    var newWidth = Math.max(80, Math.ceil(maxWidth + HORIZ_CHROME));
    var newHeight = Math.max(40, Math.ceil(textHeight + VERT_CHROME));

    this.el.style.width = newWidth + 'px';
    this.el.style.height = newHeight + 'px';
  };

  TextBox.prototype.select = function () {
    this.selected = true;
    this.el.classList.add('selected');
  };

  TextBox.prototype.deselect = function () {
    this.selected = false;
    this.editing = false;

    // Important: remove the typing cursor when clicking away or selecting another textbox.
    this.textarea.blur();

    this.el.classList.remove('selected');
  };

  // Call this once after the text box is fully created and selected.
  // Fires focus both synchronously (needed for mobile touch gesture) and
  // deferred (needed on desktop where the originating mousedown can steal
  // focus back after the event finishes).
  TextBox.prototype.focusTextarea = function () {
    var self = this;
    self.editing = true;
    self.textarea.focus();
    setTimeout(function () { self.textarea.focus(); }, 0);
  };

  TextBox.prototype.destroy = function () {
    if (this._handleKeyDown) {
      document.removeEventListener('keydown', this._handleKeyDown);
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