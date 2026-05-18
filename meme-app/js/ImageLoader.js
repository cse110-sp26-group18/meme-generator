var MemeGen = window.MemeGen || {};

MemeGen.ImageLoader = (function () {
  var MIN_WIDTH = 400;
  var MIN_HEIGHT = 300;
  var MAX_WIDTH = 800;
  var MAX_HEIGHT = 800;
  var image = null;
  var canvas = null;
  var ctx = null;
  var onLoadCallback = null;

  function init(canvasEl, callback) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onLoadCallback = callback;
  }

  function fitWithinRange(width, height) {
    var downscale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
    width = width * downscale;
    height = height * downscale;

    if (width < MIN_WIDTH && height < MIN_HEIGHT) {
      var upscale = Math.max(MIN_WIDTH / width, MIN_HEIGHT / height);
      upscale = Math.min(upscale, MAX_WIDTH / width, MAX_HEIGHT / height);
      width = width * upscale;
      height = height * upscale;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  function loadFromFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        image = img;
        var size = fitWithinRange(img.width, img.height);
        var width = size.width;
        var height = size.height;

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.drawImage(img, 0, 0, width, height);

        if (onLoadCallback) {
          onLoadCallback(width, height);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function getImage() {
    return image;
  }

  function getCanvas() {
    return canvas;
  }

  function getContext() {
    return ctx;
  }

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
