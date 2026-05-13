var MemeGen = window.MemeGen || {};

MemeGen.Exporter = (function () {
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

  function exportMeme(canvas, ctx, image, textBoxes) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    textBoxes.forEach(function (tb) {
      var state = tb.getState();
      if (!state.text.trim()) return;

      ctx.save();

      var padding = 6;
      var boxInnerWidth = state.width - padding * 2;

      // Use the font size the user sees in the editor, not a re-derived formula.
      // state.fontSize is set and kept in sync by TextBox.applyFontSize(), so
      // the exported PNG always matches what was visible on screen.
      var fontSize = state.fontSize;
      var fontFamily = state.fontFamily || 'Impact';

      ctx.font = fontSize + 'px ' + fontFamily;
      ctx.textBaseline = 'top';
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

    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'meme.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return { exportMeme: exportMeme };
})();

window.MemeGen = MemeGen;
