var MemeGen = window.MemeGen || {};

MemeGen.Exporter = (function () {
  /**
   * Splits text into lines that fit within maxWidth, preserving explicit
   *   newlines. Words are moved to the next line when the running width
   *   exceeds maxWidth.
   * @param {CanvasRenderingContext2D} ctx - canvas context used to measure
   *   text widths with the currently set font
   * @param {string} text - raw text to wrap; may contain newline characters
   * @param {number} maxWidth - maximum line width in px before wrapping
   * @returns {string[]} array of wrapped lines ready to render onto the canvas
   */
  function wrapText(ctx, text, maxWidth) {
    var paragraphs = text.split('\n');
    var lines = [];

    paragraphs.forEach(function (para) {
      if (para === '') {
        lines.push('');
        return;
      }
      var words = para.split(' ');
      var currentLine = '';

      words.forEach(function (word) {
        var testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) lines.push(currentLine);
    });

    return lines.length ? lines : [''];
  }

  /**
   * Renders all text boxes onto the canvas over the base image, then
   *   triggers a PNG download of the composed result.
   * @param {HTMLCanvasElement} canvas - the canvas to render into and export
   * @param {CanvasRenderingContext2D} ctx - 2D rendering context for the canvas
   * @param {HTMLImageElement} image - the base image drawn beneath the text
   * @param {MemeGen.TextBox[]} textBoxes - all text boxes whose state is
   *   read and rendered onto the canvas
   * @param {function} [callback] - optional callback invoked after the 
   * export is complete
   */
  function getMemeBlob(canvas, ctx, image, textBoxes, callback) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Checks image parameter to prevent ctx.drawImage from throwing a TypeError and crashing the application.
    if (!image) { if (callback) callback(null); return; }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    textBoxes.forEach(function (tb) {
      var state = tb.getState();
      if (!state.text.trim()) return;

      // save() pushes the current canvas state (font, styles, transforms)
      // onto a stack; restore() pops it after each text box so settings
      // from one box don't bleed into the next.
      ctx.save();

      var padding = 6;
      var boxInnerWidth = state.width - padding * 2;
      // Use the font size the user sees in the editor, not a re-derived formula.
      // state.fontSize is kept in sync by TextBox.applyFontSize(), so the
      // exported PNG always matches what was visible on screen.
      var fontSize = state.fontSize;
      var fontFamily = state.fontFamily || 'Impact';

      ctx.font = fontSize + 'px ' + fontFamily;
      // 'top' baseline anchors text at the top of the em box, matching the
      // CSS top-offset positioning used by the live textarea overlays.
      ctx.textBaseline = 'top';
      // 'round' join prevents sharp miter spikes at stroke corners, which
      // are especially visible on bold fonts at large sizes.
      ctx.lineJoin = 'round';

      var lines = wrapText(ctx, state.text, boxInnerWidth);
      var lineHeight = fontSize * 1.2;

      lines.forEach(function (line, i) {
        var textX = state.x + padding;
        var textY = state.y + padding + i * lineHeight;

        if (state.borderEnabled) {
          ctx.strokeStyle = 'black';
          ctx.lineWidth = Math.max(2, fontSize / 10);
          ctx.strokeText(line, textX, textY);
        }

        ctx.fillStyle = 'white';
        ctx.fillText(line, textX, textY);
      });

      ctx.restore();
    });

    // toBlob() is asynchronous — the callback fires once the browser has
    // finished encoding the canvas contents as a PNG Blob.
    canvas.toBlob(callback, 'image/png');
  }

  function exportMeme(canvas, ctx, image, textBoxes, callback) {
    getMemeBlob(canvas, ctx, image, textBoxes, function (blob) {
      if (!blob) return;
      // createObjectURL creates a temporary in-memory URL for the Blob;
      // it must be revoked after use to free the memory reference.
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'meme.png';
      document.body.appendChild(a);
      // Programmatically clicking a hidden <a download> triggers the
      // browser's native file-save dialog with the specified filename.
      a.click();
      document.body.removeChild(a);
      // Revoke after the click is queued so the browser can still access
      // the URL while initiating the download, then releases the memory.
      URL.revokeObjectURL(url);
      if (typeof callback === 'function') callback();
    });
  }

  function isMobileOrTablet() {
    var mq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)')
      : null;
    var smallOrTabletScreen = mq ? mq.matches : false;
    var hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    return smallOrTabletScreen && hasTouch;
  }

  function canUseNativeShare() {
    return isMobileOrTablet() && typeof navigator.share === 'function';
  }

  function shareMeme(canvas, ctx, image, textBoxes) {
    getMemeBlob(canvas, ctx, image, textBoxes, function (blob) {
      if (!blob) {
        exportMeme(canvas, ctx, image, textBoxes);
        return;
      }

      var file = new File([blob], 'meme.png', { type: 'image/png' });
      var shareData = { files: [file] };

      if (
        isMobileOrTablet() &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare(shareData)
      ) {
        navigator.share(shareData).then(function () {
          // share succeeded
        }).catch(function (err) {
          // AbortError = user cancelled — do nothing
          if (err && err.name !== 'AbortError') {
            exportMeme(canvas, ctx, image, textBoxes);
          }
        });
      } else {
        exportMeme(canvas, ctx, image, textBoxes);
      }
    });
  }

    return {
    exportMeme: exportMeme,
    getMemeBlob: getMemeBlob,
    shareMeme: shareMeme,
    isMobileOrTablet: isMobileOrTablet,
    canUseNativeShare: canUseNativeShare,
    wrapText: wrapText
  };
})();

window.MemeGen = MemeGen;
