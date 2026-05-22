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
 *     text:       string,   // recognized word
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
    return Promise.reject(new Error('TextRecognizer.detectText not implemented'));
  }

  return {
    detectText: detectText
  };
})();

window.MemeGen = MemeGen;
