var MemeGen = window.MemeGen || {};

MemeGen.ImageLoader = (function () {
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 300;
  const FALLBACK = 16;
  let image = null;
  let canvas = null;
  let ctx = null;
  let onLoadCallback = null;

  /**
   * @param {HTMLCanvasElement} canvasEl - the canvas element images are drawn onto
   * @param {function(number, number)} callback - invoked with (width, height)
   *   after each image is successfully loaded and drawn
   */
  function init(canvasEl, callback) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onLoadCallback = callback;
  }

  /**
   * Scales dimensions to fit within the viewport while respecting min/max bounds.
   * Use root font size so offsets scale with typography settings.
   * 3rem ≈ page horizontal chrome (main padding + container borders).
   * 11rem ≈ vertical chrome (header + controls + gaps above the canvas).
   * @param {number} width - natural image width in px
   * @param {number} height - natural image height in px
   * @returns {{width: number, height: number}} display dimensions clamped
   *   to the viewport bounds
   */
  function fitWithinRange(width, height) {
    // getComputedStyle reads the browser's live font size, respecting user
    // zoom and OS text-size settings — a hardcoded px value would drift.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || FALLBACK;
    const maxW = Math.min(800, Math.max(200, window.innerWidth - 3 * rem));
    const maxH = Math.min(800, Math.max(150, window.innerHeight - 11 * rem));

    const downscale = Math.min(maxW / width, maxH / height, 1);
    width = width * downscale;
    height = height * downscale;

    if (width < MIN_WIDTH && height < MIN_HEIGHT) {
      let upscale = Math.max(MIN_WIDTH / width, MIN_HEIGHT / height);
      upscale = Math.min(upscale, maxW / width, maxH / height);
      width = width * upscale;
      height = height * upscale;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * @param {File|Blob} file - image file or blob to read and draw onto the canvas
   */
  function loadFromFile(file) {
    // FileReader asynchronously converts the File/Blob to a base64 data URL —
    // the only way to get a same-origin URL for a local file that can be
    // drawn to canvas without tainting it and blocking PNG export.
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        image = img;
        const size = fitWithinRange(img.width, img.height);
        const width = size.width;
        const height = size.height;

        canvas.width = width;
        canvas.height = height;
        // Clear any stale inline display dimensions from a previous load so
        // CSS (mobile 60vh / desktop 72vh + aspect-ratio) controls the
        // visible canvas size. removeProperty expects the CSS property NAME
        // as a STRING — passing the numeric `width`/`height` variables silently
        // no-ops, leaving stale inline values in place.
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
        ctx.drawImage(img, 0, 0, width, height);

        if (onLoadCallback) {
          onLoadCallback(width, height);
        }
      };
      // e.target.result is the data URL produced by readAsDataURL below.
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * @returns {HTMLImageElement|null} the currently loaded image, or null
   *   if no image has been loaded yet
   */
  function getImage() {
    return image;
  }

  /**
   * @returns {HTMLCanvasElement|null} the canvas element passed to init(),
   *   or null if init() has not been called
   */
  function getCanvas() {
    return canvas;
  }

  /**
   * @returns {CanvasRenderingContext2D|null} the 2D rendering context for the
   *   canvas, or null if init() has not been called
   */
  function getContext() {
    return ctx;
  }

  /**
   * Clears the canvas and redraws the current image at its display size.
   */
  function redraw() {
    if (!image || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  return {
    init: init,
    loadFromFile: loadFromFile,
    getImage: getImage,
    getCanvas: getCanvas,
    getContext: getContext,
    redraw: redraw
  };
})();

window.MemeGen = MemeGen;
