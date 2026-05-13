var MemeGen = window.MemeGen || {};

MemeGen.ImageLoader = (function () {
  var MAX_WIDTH = 800;
  var image = null;
  var canvas = null;
  var ctx = null;
  var onLoadCallback = null;

  function init(canvasEl, callback) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onLoadCallback = callback;
  }

  function loadFromFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        image = img;
        var width = img.width;
        var height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }

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
