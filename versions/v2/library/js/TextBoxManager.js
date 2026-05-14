var MemeGen = window.MemeGen || {};

MemeGen.TextBoxManager = (function () {
  var textBoxes = [];
  var container = null;
  var canvas = null;
  var imageLoaded = false;

  function init(containerEl, canvasEl) {
    container = containerEl;
    canvas = canvasEl;

    container.addEventListener('mousedown', function (e) {
      if (e.target === canvas && imageLoaded) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        createTextBox(x, y);
      } else if (e.target === canvas) {
        deselectAll();
      }
    });

    document.addEventListener('mousedown', function (e) {
      if (!container.contains(e.target)) {
        deselectAll();
      }
    });
  }

  function setImageLoaded(loaded) {
    imageLoaded = loaded;
  }

  function createTextBox(x, y) {
    var tb = new MemeGen.TextBox(x, y, container);

    tb.onDelete = function (box) {
      var idx = textBoxes.indexOf(box);
      if (idx !== -1) textBoxes.splice(idx, 1);
    };

    tb.onSelect = function (box) {
      deselectAll();
      box.select();
    };

    MemeGen.DragResize.attach(tb);
    textBoxes.push(tb);
    deselectAll();
    tb.select();
  }

  function deselectAll() {
    textBoxes.forEach(function (tb) {
      tb.deselect();
    });
  }

  function getAll() {
    return textBoxes;
  }

  return {
    init: init,
    setImageLoaded: setImageLoaded,
    getAll: getAll
  };
})();

window.MemeGen = MemeGen;
