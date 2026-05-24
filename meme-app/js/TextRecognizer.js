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
  function detectText(source) {
    var T = (typeof window !== 'undefined' && window.Tesseract) || (typeof Tesseract !== 'undefined' ? Tesseract : null);
    if (!T || typeof T.recognize !== 'function') {
      return Promise.reject(new Error('Tesseract is not loaded — include tesseract.min.js before TextRecognizer.js'));
    }

    return T.recognize(source, 'eng').then(function (result) {
      var lines = (result && result.data && result.data.lines) || [];
      return lines.map(function (line) {
        var box = line.bbox || {};
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