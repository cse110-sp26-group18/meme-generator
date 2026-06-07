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

  // Prevent ctx.drawImage from throwing when no image is loaded.
  if (!image) {
    if (callback) callback(null);
    return;
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  textBoxes.forEach(function (tb) {
    var state = tb.getState();
    if (!state.text.trim()) return;

    ctx.save();

    // Responsive scaling: text box state is stored in display pixels.
    // The canvas bitmap may be larger than the displayed canvas, so scale
    // display coordinates into bitmap coordinates for export.
    var scaleX = state.containerWidth > 0 ? canvas.width / state.containerWidth : 1;
    var scaleY = state.containerHeight > 0 ? canvas.height / state.containerHeight : 1;
    var scale = (scaleX + scaleY) / 2;

    var padding = 6 * scale;
    var boxInnerWidth = (state.width * scaleX) - padding * 2;
    var fontSize = state.fontSize * scale;
    var fontFamily = state.fontFamily || 'Impact';

    ctx.font = fontSize + 'px ' + fontFamily;
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';

    var lines = wrapText(ctx, state.text, boxInnerWidth);
    var lineHeight = fontSize * 1.2;

    lines.forEach(function (line, i) {
      var textX = state.x * scaleX + padding;
      var textY = state.y * scaleY + padding + i * lineHeight;

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

  /**
   * Browser support probe for image clipboard copy. Both
   * navigator.clipboard.write AND the ClipboardItem constructor must
   * exist — Safari has had clipboard.write but no ClipboardItem in
   * older versions, and Firefox shipped ClipboardItem behind a flag for
   * a stretch. Checking both is the safest gate before attempting copy.
   */
  function canCopyImageToClipboard() {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem === 'function'
    );
  }

  /**
   * Renders the meme PNG via the SAME pipeline as exportMeme / shareMeme
   *   (getMemeBlob) and writes the resulting blob to the system clipboard.
   *   On success or any failure, the callback receives `(err)` — `null` on
   *   success, an Error on any failure path. The callback is OPTIONAL so
   *   the function can be called fire-and-forget.
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLImageElement} image
   * @param {MemeGen.TextBox[]} textBoxes
   * @param {function} [callback]
   */
  function copyMeme(canvas, ctx, image, textBoxes, callback) {
    function done(err) {
      if (typeof callback === 'function') callback(err || null);
    }

    // Gate first so we never burn a render when copy is impossible.
    if (!canCopyImageToClipboard()) {
      done(new Error('Image clipboard copy is not supported in this browser.'));
      return;
    }

    try {
      var blobPromise = new Promise(function (resolve, reject) {
        getMemeBlob(canvas, ctx, image, textBoxes, function (blob) {
          if (!blob) {
            reject(new Error('Could not create meme image.'));
          } else {
            resolve(blob);
          }
        });
      });

      var item = new ClipboardItem({ 'image/png': blobPromise });
      // calling the line in Safari results in a NotAllowedError because the browser considers the user gesture context to be lost
      navigator.clipboard.write([item])
        .then(function () { done(null); })
        .catch(function (err) { done(err); });
    } catch (err) {
      done(err);
    }
  }

    return {
    exportMeme: exportMeme,
    getMemeBlob: getMemeBlob,
    shareMeme: shareMeme,
    copyMeme: copyMeme,
    canCopyImageToClipboard: canCopyImageToClipboard,
    isMobileOrTablet: isMobileOrTablet,
    canUseNativeShare: canUseNativeShare,
    wrapText: wrapText
  };
})();

window.MemeGen = MemeGen;
