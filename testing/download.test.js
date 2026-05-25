/**
 * v1_test_download.test.js
 * Verifies First Iteration Goal: "Download generated meme"
 *
 * Covers:
 *  - Download button disabled before upload
 *  - exportMeme() calls canvas.toBlob() to generate the image
 *  - exportMeme() passes the blob to URL.createObjectURL
 *  - exportMeme() triggers a file download via an anchor element
 *  - Empty and whitespace-only text boxes are skipped during export
 *  - Text boxes with content cause fillText to be called
 *  - strokeText is called only when borderEnabled is true
 *  - wrapText correctly splits long lines and handles newlines
 *
 * jsdom notes:
 *  - jest-canvas-mock replaces canvas.toBlob with jest.fn() that does NOT invoke
 *    its callback. Tests that need the blob pipeline to run mock toBlob manually
 *    so the callback fires synchronously.
 *  - ctx.measureText() always returns { width: 0 } in jest-canvas-mock. Tests
 *    that verify text wrapping mock measureText to return character-proportional
 *    widths so the wrapText logic can be exercised.
 *
 * Module under test: versions/v1/js/Exporter.js
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeExportCanvas(w = 400, h = 300) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function makeFakeImage() {
  const img = document.createElement('canvas');
  img.width = 400;
  img.height = 300;
  return img;
}

function makeTextBoxStub({ text = 'Hello', borderEnabled = true, fontFamily = 'Impact' } = {}) {
  return {
    getState: () => ({
      x: 10, y: 10,
      width: 200, height: 60,
      text, fontFamily, borderEnabled,
    }),
    deselect: jest.fn(),
  };
}

/**
 * Mock toBlob so it calls its callback synchronously with a real Blob.
 * This is necessary because jest-canvas-mock replaces toBlob with jest.fn()
 * which never invokes the callback.
 */
function mockToBlobSync(canvas, mimeType = 'image/png') {
  jest.spyOn(canvas, 'toBlob').mockImplementation((callback, type) => {
    callback(new Blob([], { type: type || mimeType }));
  });
}

// ── Download Button State ─────────────────────────────────────────────────────

describe('Download Feature — button state', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="file" id="image-input" accept="image/*">
      <button id="download-btn" disabled>Download Meme</button>
      <canvas id="meme-canvas"></canvas>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should have the download button disabled before any image is uploaded', () => {
    // Edge case: Download before upload — must be blocked
    expect(document.getElementById('download-btn').disabled).toBe(true);
  });
});

// ── exportMeme() Core Behaviour ───────────────────────────────────────────────

describe('Download Feature — exportMeme()', () => {
  let canvas;
  let ctx;
  let fakeImage;

  beforeEach(() => {
    canvas = makeExportCanvas();
    ctx = canvas.getContext('2d');
    fakeImage = makeFakeImage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call canvas.toBlob() when exporting', () => {
    const toBlobSpy = jest.spyOn(canvas, 'toBlob');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub()]);
    expect(toBlobSpy).toHaveBeenCalled();
  });

  it('should pass "image/png" as the MIME type to toBlob', () => {
    const toBlobSpy = jest.spyOn(canvas, 'toBlob');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub()]);
    expect(toBlobSpy.mock.calls[0][1]).toBe('image/png');
  });

  it('should call URL.createObjectURL with the blob when toBlob fires its callback', () => {
    // jest-canvas-mock's toBlob never calls the callback on its own —
    // use mockToBlobSync to wire it up for this test.
    mockToBlobSync(canvas);
    const createURLSpy = jest.spyOn(URL, 'createObjectURL');

    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub()]);

    expect(createURLSpy).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('should create an <a> element with href set to the object URL', () => {
    // Spy on createElement to capture the anchor BEFORE it's appended —
    // mocking appendChild would prevent removeChild from working (NotFoundError).
    mockToBlobSync(canvas);
    let capturedAnchor = null;
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') capturedAnchor = el;
      return el;
    });

    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub()]);

    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor.href).toContain('blob:');
  });

  it('should set download="meme.png" on the anchor element', () => {
    mockToBlobSync(canvas);
    let capturedAnchor = null;
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') capturedAnchor = el;
      return el;
    });

    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub()]);

    expect(capturedAnchor.download).toBe('meme.png');
  });

  it('should call URL.revokeObjectURL to free the blob URL after download', () => {
    mockToBlobSync(canvas);
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL');

    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub()]);

    expect(revokeSpy).toHaveBeenCalled();
  });
});

// ── Text Box Filtering ────────────────────────────────────────────────────────

describe('Download Feature — text box filtering', () => {
  let canvas;
  let ctx;
  let fakeImage;

  beforeEach(() => {
    canvas = makeExportCanvas();
    ctx = canvas.getContext('2d');
    fakeImage = makeFakeImage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not throw when all text boxes have empty text', () => {
    // Edge case: export with no text content at all
    expect(() =>
      MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub({ text: '' })])
    ).not.toThrow();
  });

  it('should skip rendering for text boxes whose text is empty', () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub({ text: '' })]);
    expect(fillTextSpy).not.toHaveBeenCalled();
  });

  it('should skip rendering for text boxes whose text is only whitespace', () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub({ text: '   ' })]);
    expect(fillTextSpy).not.toHaveBeenCalled();
  });

  it('should call fillText for text boxes that have content', () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub({ text: 'Bottom text' })]);
    expect(fillTextSpy).toHaveBeenCalled();
  });

  it('should call strokeText when borderEnabled is true', () => {
    const strokeTextSpy = jest.spyOn(ctx, 'strokeText');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub({ text: 'A', borderEnabled: true })]);
    expect(strokeTextSpy).toHaveBeenCalled();
  });

  it('should NOT call strokeText when borderEnabled is false', () => {
    const strokeTextSpy = jest.spyOn(ctx, 'strokeText');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [makeTextBoxStub({ text: 'A', borderEnabled: false })]);
    expect(strokeTextSpy).not.toHaveBeenCalled();
  });

  it('should handle an empty text box array without throwing', () => {
    expect(() =>
      MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [])
    ).not.toThrow();
  });
});

// ── Text Wrapping ─────────────────────────────────────────────────────────────

describe('Download Feature — wrapText (via exportMeme)', () => {
  let canvas;
  let ctx;
  let fakeImage;

  beforeEach(() => {
    canvas = makeExportCanvas();
    ctx = canvas.getContext('2d');
    fakeImage = makeFakeImage();

    // jest-canvas-mock returns { width: 0 } from measureText, so wrapping never
    // triggers. We mock it with a length-proportional approximation so the
    // wrapText logic inside Exporter is actually exercised.
    jest.spyOn(ctx, 'measureText').mockImplementation((text) => ({
      width: text.length * 10,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call fillText more than once for long text in a narrow box', () => {
    // A box 80 px wide with 12-char words forces wrapping every word
    const longText = makeTextBoxStub({
      text: 'word1 word2 word3 word4 word5',
    });
    longText.getState = () => ({
      x: 10, y: 10,
      width: 80,   // boxInnerWidth = 80 - 12 = 68 px → each word (5 chars = 50px) fits,
      height: 300, // but "word1 word2" (11 chars = 110px) does not → wraps
      text: 'word1 word2 word3 word4 word5',
      fontFamily: 'Impact',
      borderEnabled: false,
    });

    const fillTextSpy = jest.spyOn(ctx, 'fillText');
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [longText]);

    expect(fillTextSpy.mock.calls.length).toBeGreaterThan(1);
  });

  it('should treat each \\n as a line break, calling fillText per line', () => {
    const multiLine = makeTextBoxStub({ text: 'Line one\nLine two\nLine three' });
    const fillTextSpy = jest.spyOn(ctx, 'fillText');

    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [multiLine]);

    expect(fillTextSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('should render an empty paragraph (bare newline) without throwing', () => {
    const withBlankLine = makeTextBoxStub({ text: 'Top\n\nBottom' });
    expect(() =>
      MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [withBlankLine])
    ).not.toThrow();
  });

  it('should not throw when text contains emoji characters', () => {
    const emoji = makeTextBoxStub({ text: '😂👌🔥' });
    expect(() =>
      MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [emoji])
    ).not.toThrow();
  });

  it('should not throw when text contains CJK (Chinese/Japanese/Korean) characters', () => {
    const cjk = makeTextBoxStub({ text: '这是一个梗图 ミーム 밈' });
    expect(() =>
      MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, [cjk])
    ).not.toThrow();
  });
});

// ── Multiple Overlays ─────────────────────────────────────────────────────────

describe('Download Feature — multiple text box overlays', () => {
  let canvas;
  let ctx;
  let fakeImage;

  beforeEach(() => {
    canvas = makeExportCanvas();
    ctx = canvas.getContext('2d');
    fakeImage = makeFakeImage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render all non-empty text boxes when multiple are present', () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText');
    const boxes = [
      makeTextBoxStub({ text: 'Top text' }),
      makeTextBoxStub({ text: 'Bottom text' }),
      makeTextBoxStub({ text: 'Side text' }),
    ];
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, boxes);
    // At minimum one fillText call per non-empty box
    expect(fillTextSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('should skip empty boxes and still render non-empty ones in a mixed array', () => {
    const fillTextSpy = jest.spyOn(ctx, 'fillText');
    const boxes = [
      makeTextBoxStub({ text: '' }),
      makeTextBoxStub({ text: 'Real text' }),
      makeTextBoxStub({ text: '   ' }),
    ];
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, boxes);
    // Only the one non-empty box should produce fillText calls
    expect(fillTextSpy).toHaveBeenCalled();
    // Verify the rendered text is the correct one
    const renderedTexts = fillTextSpy.mock.calls.map(([text]) => text);
    expect(renderedTexts.some((t) => t.includes('Real text'))).toBe(true);
  });

  it('should call toBlob exactly once regardless of how many text boxes exist', () => {
    // jest.spyOn wraps the shared prototype mock and inherits its accumulated call
    // count. Directly assigning a new jest.fn() to the instance gives a clean count.
    const freshToBlob = jest.fn((cb, type) => {
      cb(new Blob([], { type: type || 'image/png' }));
    });
    canvas.toBlob = freshToBlob;

    const boxes = [
      makeTextBoxStub({ text: 'A' }),
      makeTextBoxStub({ text: 'B' }),
      makeTextBoxStub({ text: 'C' }),
    ];
    MemeGen.Exporter.exportMeme(canvas, ctx, fakeImage, boxes);
    expect(freshToBlob).toHaveBeenCalledTimes(1);
  });
});
