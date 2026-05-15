var MemeGen = window.MemeGen || {};

MemeGen.TextBox = (function () {
  var idCounter = 0;

  function TextBox(x, y, container) {
    this.id = ++idCounter;
    this.container = container;
    this.x = x;
    this.y = y;
    this.width = 200;
    this.height = 60;
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

    // Move handle is first so it is easy to grab on both desktop and mobile
    var moveBtn = document.createElement('button');
    moveBtn.className = 'move-handle';
    moveBtn.textContent = '✥ Move';
    moveBtn.title = 'Drag to move';
    toolbar.appendChild(moveBtn);

    var fontSelect = document.createElement('select');
    fontSelect.className = 'font-select';
    var fonts = [
      { label: 'Impact', value: 'Impact' },
      { label: 'Arial', value: 'Arial' },
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

    var borderBtn = document.createElement('button');
    borderBtn.className = 'border-toggle';
    borderBtn.textContent = 'Border: ON';
    toolbar.appendChild(borderBtn);

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
    this.toolbar = toolbar;

    this.container.appendChild(el);

    // Set initial font size via inline style so it matches the export formula
    // from the start and can be updated by syncFontSize() during resize.
    this.syncFontSize();
    // Focus is handled by TextBoxManager after full setup — see focusTextarea()
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

    this.el.addEventListener('mousedown', function (e) {
      if (self.onSelect) {
        self.onSelect(self);
      }
    });
  };

  TextBox.prototype.select = function () {
    this.selected = true;
    this.el.classList.add('selected');
  };

  TextBox.prototype.deselect = function () {
    this.selected = false;
    this.el.classList.remove('selected');
  };

  // Syncs the textarea's live font size to match the export formula:
  //   fontSize = max(12, floor(boxHeight * 0.4))
  // Call this once on creation and again after every resize step.
  TextBox.prototype.syncFontSize = function () {
    var fontSize = Math.max(12, Math.floor(this.el.offsetHeight * 0.4));
    this.textarea.style.fontSize = fontSize + 'px';
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
      borderEnabled: this.borderEnabled
    };
  };

  return TextBox;
})();

window.MemeGen = MemeGen;
