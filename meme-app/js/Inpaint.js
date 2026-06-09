var MemeGen = window.MemeGen || {};

MemeGen.Inpaint = (function () {
  // Cover a rectangular region by blending the pixels that surround it, so the
  // patch matches the background instead of showing as a flat solid block.
  //
  // For each interior pixel we bilinearly interpolate between the region's four
  // border lines: the horizontal blend (left↔right edge) and the vertical blend
  // (top↔bottom edge) are averaged together. On a uniform background this
  // collapses to the exact surrounding color; on a gradient it reproduces the
  // gradient. region = { x, y, width, height } in canvas pixel coordinates.
  function coverRegion(ctx, region) {
    var canvasW = ctx.canvas.width;
    var canvasH = ctx.canvas.height;
    var x0 = Math.max(0, Math.min(canvasW, Math.round(region.x)));
    var y0 = Math.max(0, Math.min(canvasH, Math.round(region.y)));
    var x1 = Math.max(0, Math.min(canvasW, Math.round(region.x + region.width)));
    var y1 = Math.max(0, Math.min(canvasH, Math.round(region.y + region.height)));

    var x = x0;
    var y = y0;
    var w = x1 - x0;
    var h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    // Sample the border lines just outside the region, clamped to the canvas on
    // every side so the read never goes out of bounds — an out-of-bounds read
    // returns transparent black and bleeds black edges into the blend.
    var topY    = Math.max(0, y - 1);
    var bottomY = Math.min(canvasH - 1, y + h);
    var leftX   = Math.max(0, x - 1);
    var rightX  = Math.min(canvasW - 1, x + w);

    // A tainted canvas (e.g. a CORS-restricted meme template) makes getImageData
    // throw a SecurityError. Fall back to a soft gray fill instead of crashing.
    var topRow, bottomRow, leftCol, rightCol;
    try {
      topRow    = ctx.getImageData(x, topY, w, 1).data;
      bottomRow = ctx.getImageData(x, bottomY, w, 1).data;
      leftCol   = ctx.getImageData(leftX, y, 1, h).data;
      rightCol  = ctx.getImageData(rightX, y, 1, h).data;
    } catch (e) {
      console.warn('Inpaint failed (canvas may be tainted):', e);
      ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
      ctx.fillRect(x, y, w, h);
      return;
    }

    var out = ctx.createImageData(w, h);
    var data = out.data;

    for (var j = 0; j < h; j++) {
      var vt = h > 1 ? j / (h - 1) : 0;            // vertical blend factor
      var rowOff = j * 4;
      for (var i = 0; i < w; i++) {
        var ht = w > 1 ? i / (w - 1) : 0;          // horizontal blend factor
        var colOff = i * 4;
        var di = (j * w + i) * 4;

        for (var c = 0; c < 3; c++) {
          var horizontal = leftCol[rowOff + c] * (1 - ht) + rightCol[rowOff + c] * ht;
          var vertical   = topRow[colOff + c] * (1 - vt) + bottomRow[colOff + c] * vt;
          data[di + c] = Math.round((horizontal + vertical) / 2);
        }
        data[di + 3] = 255;
      }
    }

    ctx.putImageData(out, x, y);
  }

  return { coverRegion: coverRegion };
})();

window.MemeGen = MemeGen;
