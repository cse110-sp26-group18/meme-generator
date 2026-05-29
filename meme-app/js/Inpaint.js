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
    var x = Math.round(region.x);
    var y = Math.round(region.y);
    var w = Math.round(region.width);
    var h = Math.round(region.height);
    if (w <= 0 || h <= 0) return;

    // Sample the border lines just outside the region, clamped so the read
    // stays on-canvas. Falling back to the region edge keeps it well-defined at
    // the canvas boundary.
    var topY    = Math.max(0, y - 1);
    var bottomY = y + h;
    var leftX   = Math.max(0, x - 1);
    var rightX  = x + w;

    var topRow    = ctx.getImageData(x, topY, w, 1).data;
    var bottomRow = ctx.getImageData(x, bottomY, w, 1).data;
    var leftCol   = ctx.getImageData(leftX, y, 1, h).data;
    var rightCol  = ctx.getImageData(rightX, y, 1, h).data;

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
