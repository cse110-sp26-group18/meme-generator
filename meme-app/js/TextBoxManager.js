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

    // Support tap-to-create on touch devices
    container.addEventListener('touchend', function (e) {
      if (e.target === canvas && imageLoaded) {
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var touch = e.changedTouches[0];
        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;
        createTextBox(x, y);
      }
    });

    document.addEventListener('mousedown', function (e) {
      if (!container.contains(e.target)) {
        deselectAll();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') {
        return;
      }

      var activeEl = document.activeElement;

      if (
        activeEl &&
        (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable
        )
      ) {
        return;
      }

      deleteSelectedTextBox();
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
    tb.focusTextarea();
  }

  function deleteSelectedTextBox() {
    var selectedBox = textBoxes.find(function (tb) {
      return tb.selected;
    });

    if (selectedBox) {
      selectedBox.destroy();
    }
  }

  function deselectAll() {
    textBoxes.forEach(function (tb) {
      tb.deselect();
    });
  }

  function getAll() {
    return textBoxes;
  }

function loadDetectedBoxes(regions) {
  var scaleX = canvas.offsetWidth  / canvas.width;
  var scaleY = canvas.offsetHeight / canvas.height;
  var ctx = canvas.getContext('2d');

  regions.forEach(function (region) {
    // Skip regions with no real alphanumeric content
    if ((region.text.match(/[a-zA-Z0-9]/g) || []).length < 3) return;
    
    // Save original pixels before erasing so delete can restore them
    var savedPixels = ctx.getImageData(region.x, region.y, region.width, region.height);

    // Auto-erase using 4-edge color sampling
    var totalR = 0, totalG = 0, totalB = 0, count = 0;
    [
      ctx.getImageData(region.x, region.y, region.width, 1),
      ctx.getImageData(region.x, region.y + region.height - 1, region.width, 1),
      ctx.getImageData(region.x, region.y, 1, region.height),
      ctx.getImageData(region.x + region.width - 1, region.y, 1, region.height)
    ].forEach(function (imgData) {
      for (var i = 0; i < imgData.data.length; i += 4) {
        totalR += imgData.data[i];
        totalG += imgData.data[i + 1];
        totalB += imgData.data[i + 2];
        count++;
      }
    });
    ctx.fillStyle = 'rgb(' + Math.round(totalR/count) + ',' + Math.round(totalG/count) + ',' + Math.round(totalB/count) + ')';
    ctx.fillRect(region.x, region.y, region.width, region.height);

    var tb = new MemeGen.TextBox(
      region.x * scaleX,
      region.y * scaleY,
      container
    );

    tb.el.style.width  = Math.round(region.width  * scaleX) + 'px';
    tb.el.style.height = Math.round(region.height * scaleY) + 'px';
    tb.textarea.value  = region.text;
    tb.applyFontSize(Math.round(region.height * scaleY * 0.4));

    tb.onDelete = (function (r, saved) {
      return function (box) {
        // Restore original canvas pixels
        ctx.putImageData(saved, r.x, r.y);
        var idx = textBoxes.indexOf(box);
        if (idx !== -1) textBoxes.splice(idx, 1);
      };
    }(region, savedPixels));

    tb.onSelect = function (box) {
      deselectAll();
      box.select();
    };

    tb.onErase = (function (r) {
      return function () {
        var totalR = 0, totalG = 0, totalB = 0, count = 0;
        [
          ctx.getImageData(r.x, r.y, r.width, 1),
          ctx.getImageData(r.x, r.y + r.height - 1, r.width, 1),
          ctx.getImageData(r.x, r.y, 1, r.height),
          ctx.getImageData(r.x + r.width - 1, r.y, 1, r.height)
        ].forEach(function (imgData) {
          for (var i = 0; i < imgData.data.length; i += 4) {
            totalR += imgData.data[i];
            totalG += imgData.data[i + 1];
            totalB += imgData.data[i + 2];
            count++;
          }
        });
        ctx.fillStyle = 'rgb(' + Math.round(totalR/count) + ',' + Math.round(totalG/count) + ',' + Math.round(totalB/count) + ')';
        ctx.fillRect(r.x, r.y, r.width, r.height);
      };
    }(region));

    MemeGen.DragResize.attach(tb);
    textBoxes.push(tb);
  });

  deselectAll();
}

  return {
    init: init,
    setImageLoaded: setImageLoaded,
    getAll: getAll,
    loadDetectedBoxes: loadDetectedBoxes
  };
})();

window.MemeGen = MemeGen;