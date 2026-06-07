/**
 * file_validator.test.js
 * Verifies the FileValidator utility for image uploads.
 */

beforeEach(() => {
  jest.resetModules();
  // Mock window.alert to capture error messages and prevent them from interrupting tests
  window.alert = jest.fn();
  // Load the validator module
  require('../meme-app/js/FileValidator.js');
});

describe('FileValidator.validate', () => {
  test('should return true for valid JPG images', () => {
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const result = MemeGen.FileValidator.validate(file);
    expect(result).toBe(true);
    expect(window.alert).not.toHaveBeenCalled();
  });

  test('should return true for valid PNG images', () => {
    const file = new File([''], 'test.png', { type: 'image/png' });
    const result = MemeGen.FileValidator.validate(file);
    expect(result).toBe(true);
  });

  test('should return true for valid GIF images', () => {
    const file = new File([''], 'test.gif', { type: 'image/gif' });
    const result = MemeGen.FileValidator.validate(file);
    expect(result).toBe(true);
  });

  test('should return false and alert for HEIC files by mime type', () => {
    const file = new File([''], 'photo.heic', { type: 'image/heic' });
    const result = MemeGen.FileValidator.validate(file);
    expect(result).toBe(false);
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('HEIC images are not supported')
    );
  });

  test('should return false and alert for HEIC files by file extension', () => {
    const file = new File([''], 'photo.heif', { type: '' });
    const result = MemeGen.FileValidator.validate(file);
    expect(result).toBe(false);
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('HEIC images are not supported')
    );
  });

  test('should return false and alert for non-image files (e.g. PDF)', () => {
    const file = new File([''], 'doc.pdf', { type: 'application/pdf' });
    const result = MemeGen.FileValidator.validate(file);
    expect(result).toBe(false);
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported file type')
    );
  });

  test('should return false for null or undefined input', () => {
    expect(MemeGen.FileValidator.validate(null)).toBe(false);
    expect(MemeGen.FileValidator.validate(undefined)).toBe(false);
  });
});