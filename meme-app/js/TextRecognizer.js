/**
 * TextRecognizer — Phase 1 OCR layer.
 *
 * Wraps Tesseract.js (loaded globally as window.Tesseract via CDN) and returns
 * detected text regions for the given canvas or image.
 *
 * Public API:
 *   MemeGen.TextRecognizer.detectText(source) -> Promise<Region[]>
 *
 * Region shape:
 *   {
 *     text:       string,   // recognized line of text
 *     x:          number,   // bbox left,   in source-pixel space
 *     y:          number,   // bbox top,    in source-pixel space
 *     width:      number,   // bbox width
 *     height:     number,   // bbox height
 *     confidence: number    // 0..100, from Tesseract
 *   }
 */
var MemeGen = window.MemeGen || {};

MemeGen.TextRecognizer = (function () {
  // Compute the tight bounding box around a line's recognized words. Returns
  // null when the line has no usable word boxes so the caller can fall back to
  // the line-level bbox.
  function tightBoxFromWords(line) {
    var words = (line && line.words) || [];
    var x0, y0, x1, y1;

    words.forEach(function (w) {
      if (!w || !w.bbox || !w.text || !w.text.trim()) return;
      var b = w.bbox;
      if (x0 === undefined || b.x0 < x0) x0 = b.x0;
      if (y0 === undefined || b.y0 < y0) y0 = b.y0;
      if (x1 === undefined || b.x1 > x1) x1 = b.x1;
      if (y1 === undefined || b.y1 > y1) y1 = b.y1;
    });

    if (x0 === undefined) return null;
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function detectText(source) {
    var T = (typeof window !== 'undefined' && window.Tesseract) || (typeof Tesseract !== 'undefined' ? Tesseract : null);
    if (!T || typeof T.recognize !== 'function') {
      return Promise.reject(new Error('Tesseract is not loaded — include tesseract.min.js before TextRecognizer.js'));
    }

    return T.recognize(source, 'eng').then(function (result) {
      var lines = (result && result.data && result.data.lines) || [];
      return lines.map(function (line) {
        // Prefer the union of the line's word boxes — it hugs the actual glyphs.
        // Tesseract's line bbox often extends to the text block margin, making
        // it wider than and shifted left of the visible text. Fall back to the
        // line bbox when word-level boxes aren't available.
        var box = tightBoxFromWords(line) || line.bbox || {};
        return {
          text: line.text.trim(),
          x: box.x0,
          y: box.y0,
          width:  box.x1 - box.x0,
          height: box.y1 - box.y0,
          confidence: line.confidence
        };
      });
    });
  }

  return {
    detectText: detectText
  };
})();

window.MemeGen = MemeGen;