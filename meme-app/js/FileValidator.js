(function () {
  var MemeGen = window.MemeGen || {};

  MemeGen.FileValidator = {
    /**
     * Checks if a file is a supported image type for the generator.
     * @param {File} file - The file to validate.
     * @returns {boolean} - Returns true if the file is a supported image.
     */
    validate: function (file) {
      if (!file) return false;

      var fileName = file.name ? file.name.toLowerCase() : '';
      
      // Explicitly check for HEIC/HEIF as browsers often fail to render them 
      // in canvas without external libraries, leading to silent failures.
      var isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                   fileName.endsWith('.heic') || fileName.endsWith('.heif');
      
      if (isHeic) {
        window.alert('HEIC images are not supported yet. Please use JPG, PNG, or GIF.');
        return false;
      }

      // Check for generic image MIME types.
      if (file.type && file.type.indexOf('image/') !== 0) {
        window.alert('Unsupported file type. Please upload an image file (JPG, PNG, GIF).');
        return false;
      }

      return true;
    }
  };

  window.MemeGen = MemeGen;
})();