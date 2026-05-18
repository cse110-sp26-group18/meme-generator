document.addEventListener('DOMContentLoaded', function () {

  const canvas = document.getElementById('meme-canvas');
  const container = document.getElementById('container');
  const imageInput = document.getElementById('image-input');
  const downloadBtn = document.getElementById('download-btn');

  const placeholder = document.querySelector('.placeholder');
  const hint = document.querySelector('.hint');

  const browseTemplatesBtn =
    document.getElementById("browse-templates-btn");

  const modalOverlay =
    document.getElementById("modal-overlay");

  const closeModalBtn =
    document.getElementById("close-modal");

  const templateGrid =
    document.getElementById("template-grid");

  const templateSearch =
    document.getElementById("template-search");

  // =========================
  // IMAGE LOADER INIT
  // =========================
  MemeGen.ImageLoader.init(canvas, function (width, height) {

    container.style.width = width + 'px';
    container.style.height = height + 'px';

    container.classList.add('has-image');

    placeholder.hidden = true;
    hint.hidden = false;

    downloadBtn.disabled = false;

    MemeGen.TextBoxManager.setImageLoaded(true);
  });

  // =========================
  // TEXT BOX SYSTEM
  // =========================
  MemeGen.TextBoxManager.init(container, canvas);

  // =========================
  // TEMPLATE LIBRARY (FIXED)
  // =========================
  MemeGen.TemplateLibrary.init(
    templateGrid,
    templateSearch,
    function (template) {

      MemeGen.ImageLoader.loadFromUrl(template.blank);

      // IMPORTANT: re-enable text system state
      MemeGen.TextBoxManager.setImageLoaded(true);

      // ensure canvas is "active"
      document.querySelector('.placeholder').hidden = true;
      document.querySelector('.hint').hidden = false;

      // enable download again
      document.getElementById('download-btn').disabled = false;

      modalOverlay.style.display = "none";
    }
  );

  // =========================
  // IMAGE UPLOAD
  // =========================
  imageInput.addEventListener('change', function () {

    if (this.files && this.files[0]) {

      MemeGen.ImageLoader.loadFromFile(this.files[0]);
    }
  });

  // =========================
  // DOWNLOAD MEME
  // =========================
  downloadBtn.addEventListener('click', function () {

    const image = MemeGen.ImageLoader.getImage();
    const ctx = MemeGen.ImageLoader.getContext();
    const textBoxes = MemeGen.TextBoxManager.getAll();

    MemeGen.TextBoxManager.getAll().forEach(tb => tb.deselect());

    MemeGen.Exporter.exportMeme(
      canvas,
      ctx,
      image,
      textBoxes
    );

    setTimeout(() => {
      MemeGen.ImageLoader.redraw();
    }, 100);
  });

  // =========================
  // MODAL OPEN
  // =========================
  browseTemplatesBtn.addEventListener("click", () => {
    modalOverlay.style.display = "flex";
  });

  // CLOSE MODAL
  closeModalBtn.addEventListener("click", () => {
    modalOverlay.style.display = "none";
  });

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.style.display = "none";
    }
  });

});