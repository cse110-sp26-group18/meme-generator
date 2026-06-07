var MemeGen = window.MemeGen || {};

MemeGen.Inpaint = (function () {
  // A neutral mid-gray border line of `count` RGBA pixels, used when a region is
  // flush against the canvas on both opposing sides and no real border exists.
  function neutralLine(count) {
    var line = new Uint8ClampedArray(count * 4);
    for (var i = 0; i < line.length; i++) line[i] = 128;
    return line;
  }

  // Cover a rectangular region by blending the pixels that surround it, so the
  // patch matches the background instead of showing as a flat solid block.
  //
  // For each interior pixel we bilinearly interpolate between the region's four
  // border lines: the horizontal blend (left↔right edge) and the vertical blend
  // (top↔bottom edge) are averaged together. On a uniform background this
  // collapses to the exact surrounding color; on a gradient it reproduces the
  // gradient. region = { x, y, width, height } in canvas pixel coordinates.
  function coverRegion(ctx, region) {
    var x = Math.round(region.x);
    var y = Math.round(region.y);
    var w = Math.round(region.width);
    var h = Math.round(region.height);
    if (w <= 0 || h <= 0) return;

    // Sample each border line just *outside* the region. When the region is
    // flush against a canvas edge there is no outside pixel there — clamping
    // back into the region would sample the very text we're covering and bleed
    // it into the blend. So only read a border that genuinely exists, fall back
    // to the opposite border when one side is missing, and use neutral gray if
    // both opposing borders are unavailable.
    var hasTop    = y - 1 >= 0;
    var hasBottom = y + h < ctx.canvas.height;
    var hasLeft   = x - 1 >= 0;
    var hasRight  = x + w < ctx.canvas.width;

    // A tainted canvas (e.g. a CORS-restricted meme template) makes getImageData
    // throw a SecurityError. Fall back to a soft gray fill instead of crashing.
    var topRow, bottomRow, leftCol, rightCol;
    try {
      topRow    = hasTop    ? ctx.getImageData(x, y - 1, w, 1).data : null;
      bottomRow = hasBottom ? ctx.getImageData(x, y + h, w, 1).data : null;
      leftCol   = hasLeft   ? ctx.getImageData(x - 1, y, 1, h).data : null;
      rightCol  = hasRight  ? ctx.getImageData(x + w, y, 1, h).data : null;
    } catch (e) {
      console.warn('Inpaint failed (canvas may be tainted):', e);
      ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
      ctx.fillRect(x, y, w, h);
      return;
    }

    // Mirror a present border onto its missing opposite; if neither exists, use
    // a neutral gray line so the blend stays well-defined.
    if (!topRow)    topRow    = bottomRow || neutralLine(w);
    if (!bottomRow) bottomRow = topRow;
    if (!leftCol)   leftCol   = rightCol || neutralLine(h);
    if (!rightCol)  rightCol  = leftCol;

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
