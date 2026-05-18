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
