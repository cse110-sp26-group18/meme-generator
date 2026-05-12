(function () {
  const MAX_WIDTH = 800;

  const canvas = document.getElementById('meme-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('canvas-container');
  const placeholder = document.getElementById('placeholder');
  const imageUpload = document.getElementById('image-upload');
  const fontSelect = document.getElementById('font-select');
  const borderToggle = document.getElementById('border-toggle');
  const downloadBtn = document.getElementById('download-btn');

  let loadedImage = null;
  let activeOverlay = null;

  imageUpload.addEventListener('change', handleImageUpload);
  container.addEventListener('click', handleCanvasClick);
  fontSelect.addEventListener('change', handleFontChange);
  borderToggle.addEventListener('change', handleBorderToggle);
  downloadBtn.addEventListener('click', handleDownload);

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        let w = img.width;
        let h = img.height;

        if (w > MAX_WIDTH) {
          h = (h / w) * MAX_WIDTH;
          w = MAX_WIDTH;
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        loadedImage = img;
        placeholder.style.display = 'none';

        removeAllOverlays();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleCanvasClick(e) {
    if (!loadedImage) return;
    if (e.target !== canvas) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    createOverlay(x, y);
  }

  function createOverlay(x, y) {
    const overlay = document.createElement('div');
    overlay.classList.add('text-overlay');
    overlay.contentEditable = 'true';
    overlay.innerText = 'Your text';
    overlay.style.left = x + 'px';
    overlay.style.top = y + 'px';
    overlay.style.fontFamily = fontSelect.value;

    if (!borderToggle.checked) {
      overlay.classList.add('no-border');
    }

    container.appendChild(overlay);
    makeDraggable(overlay);
    setActiveOverlay(overlay);

    overlay.addEventListener('focus', function () {
      setActiveOverlay(overlay);
    });

    overlay.addEventListener('dblclick', function () {
      overlay.classList.add('editing');
    });

    overlay.addEventListener('blur', function () {
      overlay.classList.remove('editing');
    });

    const range = document.createRange();
    range.selectNodeContents(overlay);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    overlay.focus();
  }

  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, origLeft, origTop;
    const DRAG_THRESHOLD = 3;

    el.addEventListener('mousedown', function (e) {
      if (el.classList.contains('editing')) return;

      const elRect = el.getBoundingClientRect();
      const handleSize = 16;
      const relX = e.clientX - elRect.left;
      const relY = e.clientY - elRect.top;
      if (relX > elRect.width - handleSize && relY > elRect.height - handleSize) {
        return;
      }

      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = parseInt(el.style.left) || 0;
      origTop = parseInt(el.style.top) || 0;
      isDragging = false;

      function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!isDragging && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        isDragging = true;

        el.style.left = (origLeft + dx) + 'px';
        el.style.top = (origTop + dy) + 'px';
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  function setActiveOverlay(overlay) {
    if (activeOverlay) {
      activeOverlay.style.outline = 'none';
    }
    activeOverlay = overlay;
    if (overlay) {
      overlay.style.outline = '2px solid #e94560';
    }
  }

  function handleFontChange(e) {
    if (activeOverlay) {
      activeOverlay.style.fontFamily = e.target.value;
    }
  }

  function handleBorderToggle(e) {
    document.querySelectorAll('.text-overlay').forEach(function (overlay) {
      overlay.classList.toggle('no-border', !e.target.checked);
    });
  }

  function handleDownload() {
    if (!loadedImage) return;

    let w = loadedImage.width;
    let h = loadedImage.height;

    if (w > MAX_WIDTH) {
      h = (h / w) * MAX_WIDTH;
      w = MAX_WIDTH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loadedImage, 0, 0, w, h);

    const overlays = document.querySelectorAll('.text-overlay');
    overlays.forEach(function (overlay) {
      const text = overlay.innerText;
      if (!text.trim()) return;

      const x = parseInt(overlay.style.left) || 0;
      const y = parseInt(overlay.style.top) || 0;
      const computed = getComputedStyle(overlay);
      const fontSize = parseFloat(computed.fontSize);
      const fontFamily = computed.fontFamily;
      const hasBorder = !overlay.classList.contains('no-border');
      const maxWidth = overlay.offsetWidth - 16;

      ctx.font = fontSize + 'px ' + fontFamily;
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'white';

      if (hasBorder) {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = fontSize / 12;
        ctx.lineJoin = 'round';
      }

      wrapText(ctx, text, x + 8, y + 4, maxWidth, fontSize * 1.2, hasBorder);
    });

    const link = document.createElement('a');
    link.download = 'meme.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, stroke) {
    const lines = text.split('\n');
    let curY = y;

    lines.forEach(function (line) {
      const words = line.split(' ');
      let currentLine = '';

      words.forEach(function (word, i) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          if (stroke) ctx.strokeText(currentLine, x, curY);
          ctx.fillText(currentLine, x, curY);
          currentLine = word;
          curY += lineHeight;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        if (stroke) ctx.strokeText(currentLine, x, curY);
        ctx.fillText(currentLine, x, curY);
        curY += lineHeight;
      }
    });
  }

  function removeAllOverlays() {
    document.querySelectorAll('.text-overlay').forEach(function (el) {
      el.remove();
    });
    activeOverlay = null;
  }
})();
