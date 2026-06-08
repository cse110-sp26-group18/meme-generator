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
  // Long-edge target (px) the source is upscaled toward before OCR. Tesseract
  // recognizes far better on larger text; ~2000px is a reliable sweet spot.
  var OCR_TARGET_LONG_EDGE = 2000;

  // Grayscale + linear contrast stretch over an RGBA buffer, mutated in place.
  // Pure (no canvas) so it can be unit-tested directly. OCR is far more reliable
  // on high-contrast grayscale input than on raw color photos.
  function enhancePixels(data) {
    var min = 255, max = 0;

    // Pass 1: luminance grayscale, tracking the gray range.
    for (var i = 0; i < data.length; i += 4) {
      var g = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
      data[i] = data[i + 1] = data[i + 2] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }

    // Pass 2: stretch [min,max] → [0,255]. Skip when there's nothing to gain.
    var range = max - min;
    if (range > 0 && range < 255) {
      var scale = 255 / range;
      for (var j = 0; j < data.length; j += 4) {
        var v = Math.round((data[j] - min) * scale);
        data[j] = data[j + 1] = data[j + 2] = v;
      }
    }

    return data;
  }

  // Render the source onto an offscreen canvas, upscale small sources, and
  // enhance contrast. Returns { canvas, scale } where scale maps source pixels
  // to preprocessed pixels (so OCR coordinates can be divided back out).
  function preprocess(source) {
    var w = source.width || source.naturalWidth || source.videoWidth || 0;
    var h = source.height || source.naturalHeight || source.videoHeight || 0;
    if (w <= 0 || h <= 0) {
      return { canvas: document.createElement('canvas'), scale: 1 };
    }

    // Upscale small images toward the target; never downscale (uncapped factor).
    var scale = Math.max(1, OCR_TARGET_LONG_EDGE / Math.max(w, h));

    var off = document.createElement('canvas');
    off.width = Math.round(w * scale);
    off.height = Math.round(h * scale);

    // getContext can return null in headless/low-memory environments; bail out
    // with an un-enhanced canvas rather than crashing on a null context.
    var ctx = off.getContext('2d');
    if (!ctx) {
      return { canvas: off, scale: scale };
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, off.width, off.height);

    var imageData = ctx.getImageData(0, 0, off.width, off.height);
    enhancePixels(imageData.data);
    ctx.putImageData(imageData, 0, 0);

    return { canvas: off, scale: scale };
  }

  // Strip characters OCR sometimes hallucinates (©, ®, ™, box glyphs, …) so they
  // don't leak into text boxes. Keeps letters, digits, whitespace, and everyday
  // punctuation; collapses whitespace runs and trims. A line that was only noise
  // becomes empty here and is then dropped by the caller's content filter.
  function sanitizeText(text) {
    if (!text) return '';
    var cleaned = text
      .replace(/[^A-Za-z0-9\s.,!?'"():;%&\/\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return fixOneTouchingLetters(cleaned);
  }

  // OCR confuses the digit "1" with the letters "I"/"l" because the glyphs are
  // nearly identical (especially in Impact and other sans-serif fonts). A "1"
  // that touches a letter is almost certainly a letter, so convert it — uppercase
  // neighbor → "I", lowercase → "l". Standalone "1" and real numbers ("100",
  // "2021") are left untouched.
  function fixOneTouchingLetters(text) {
    return text.replace(/1/g, function (m, offset, str) {
      var prev = str.charAt(offset - 1);
      var next = str.charAt(offset + 1);
      var prevLetter = /[A-Za-z]/.test(prev);
      var nextLetter = /[A-Za-z]/.test(next);
      if (!prevLetter && !nextLetter) return '1';
      var ref = prevLetter ? prev : next;
      return /[A-Z]/.test(ref) ? 'I' : 'l';
    });
  }

  // A line splits into separate regions wherever the horizontal gap between two
  // consecutive words exceeds (median word height × this ratio). 1.5× height is
  // far wider than a normal inter-word space (~0.3× height), so phrases stay
  // intact while genuinely separated captions on the same row break apart.
  var WORD_GAP_SPLIT_RATIO = 1.5;

  // Tight bounding box around a list of words → { x0, y0, x1, y1 } or null.
  function unionBox(words) {
    var x0, y0, x1, y1;
    words.forEach(function (w) {
      var b = w.bbox;
      if (x0 === undefined || b.x0 < x0) x0 = b.x0;
      if (y0 === undefined || b.y0 < y0) y0 = b.y0;
      if (x1 === undefined || b.x1 > x1) x1 = b.x1;
      if (y1 === undefined || b.y1 > y1) y1 = b.y1;
    });
    if (x0 === undefined) return null;
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function median(nums) {
    var sorted = nums.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Split a Tesseract line into one or more segments { text, box }. Words on the
  // same row but separated by a large horizontal gap (two distinct captions)
  // become distinct segments, each with its own tight box. Falls back to a
  // single segment from the line bbox when word-level boxes aren't available.
  function splitLineByGaps(line) {
    var words = ((line && line.words) || [])
      .filter(function (w) { return w && w.bbox && w.text && w.text.trim(); })
      .sort(function (a, b) { return a.bbox.x0 - b.bbox.x0; });

    if (!words.length) {
      var lb = (line && line.bbox) || {};
      return [{ text: (line && line.text) || '', box: lb }];
    }

    var threshold = median(words.map(function (w) {
      return w.bbox.y1 - w.bbox.y0;
    })) * WORD_GAP_SPLIT_RATIO;

    var groups = [[words[0]]];
    for (var i = 1; i < words.length; i++) {
      var gap = words[i].bbox.x0 - words[i - 1].bbox.x1;
      if (gap > threshold) {
        groups.push([words[i]]);
      } else {
        groups[groups.length - 1].push(words[i]);
      }
    }

    return groups.map(function (group) {
      return {
        text: group.map(function (w) { return w.text; }).join(' '),
        box: unionBox(group)
      };
    });
  }

  function detectText(source) {
    // A null/undefined source (e.g. ImageLoader.getCanvas() before an image is
    // loaded) would throw inside preprocess; reject up front instead.
    if (!source) {
      return Promise.reject(new Error('Invalid or missing source element for text recognition.'));
    }

    var T = (typeof window !== 'undefined' && window.Tesseract) || (typeof Tesseract !== 'undefined' ? Tesseract : null);
    if (!T || typeof T.recognize !== 'function') {
      return Promise.reject(new Error('Tesseract is not loaded — include tesseract.min.js before TextRecognizer.js'));
    }

    // Recognize on an upscaled, contrast-enhanced copy; coordinates come back in
    // that preprocessed space and are divided by `scale` to return to source px.
    var pre = preprocess(source);
    var s = pre.scale;

    return T.recognize(pre.canvas, 'eng').then(function (result) {
      var lines = (result && result.data && result.data.lines) || [];
      var regions = [];

      lines.forEach(function (line) {
        // One Tesseract line may hold several captions on the same row; split it
        // wherever a big horizontal gap appears so each becomes its own region.
        // Word boxes hug the actual glyphs (the line bbox often runs to the text
        // block margin, wider than and left of the visible text).
        splitLineByGaps(line).forEach(function (seg) {
          var box = seg.box || {};
          // Skip segments with incomplete boxes — dividing undefined by `s`
          // yields NaN coordinates that break downstream rendering.
          if (box.x0 === undefined || box.y0 === undefined ||
              box.x1 === undefined || box.y1 === undefined) {
            return;
          }
          regions.push({
            text: sanitizeText(seg.text),
            x: Math.round(box.x0 / s),
            y: Math.round(box.y0 / s),
            width:  Math.round((box.x1 - box.x0) / s),
            height: Math.round((box.y1 - box.y0) / s),
            confidence: line.confidence
          });
        });
      });

      return regions;
    });
  }

  return {
    detectText: detectText,
    preprocess: preprocess,
    enhancePixels: enhancePixels,
    sanitizeText: sanitizeText
  };
})();

window.MemeGen = MemeGen;