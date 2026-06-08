/**
 * Inpaint.test.js
 * Verifies that Inpaint.coverRegion produces a background-matched blend and
 * writes it back with putImageData — never a destructive solid fill.
 *
 * Module under test: meme-app/js/Inpaint.js
 * Loaded globally via testing/setup.js
 */

// Build a mock 2D context whose surrounding pixels are a single uniform color.
// getImageData returns that color for every requested row/column; createImageData
// hands back a writable buffer; putImageData captures what was written.
function makeUniformCtx(r, g, b) {
  const fillLine = (w, h) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4]     = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    return { data, width: w, height: h };
  };

  return {
    canvas:          { width: 1000, height: 1000 },
    getImageData:    jest.fn((x, y, w, h) => fillLine(w, h)),
    createImageData: jest.fn((w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
    putImageData:    jest.fn()
  };
}

describe('Inpaint.coverRegion', () => {
  test('writes a w×h ImageData at the region origin', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    MemeGen.Inpaint.coverRegion(ctx, { x: 10, y: 20, width: 30, height: 15 });

    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    const [imageData, dx, dy] = ctx.putImageData.mock.calls[0];
    expect(imageData.data.length).toBe(30 * 15 * 4);
    expect(dx).toBe(10);
    expect(dy).toBe(20);
  });

  test('a uniform surround yields that exact color (opaque)', () => {
    const ctx = makeUniformCtx(120, 60, 200);
    MemeGen.Inpaint.coverRegion(ctx, { x: 0, y: 0, width: 8, height: 8 });

    const data = ctx.putImageData.mock.calls[0][0].data;
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(120);
      expect(data[i + 1]).toBe(60);
      expect(data[i + 2]).toBe(200);
      expect(data[i + 3]).toBe(255);
    }
  });

  test('does nothing for a zero-area region', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    MemeGen.Inpaint.coverRegion(ctx, { x: 0, y: 0, width: 0, height: 10 });
    expect(ctx.putImageData).not.toHaveBeenCalled();
  });

  test('does not call fillRect (non-destructive, no solid block)', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    ctx.fillRect = jest.fn();
    MemeGen.Inpaint.coverRegion(ctx, { x: 5, y: 5, width: 10, height: 10 });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  test('skips the off-canvas borders for a flush region (no text bleed)', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    ctx.canvas = { width: 100, height: 100 };
    // Region flush against the bottom-right corner: the bottom (y+h=100) and
    // right (x+w=100) borders don't exist. They must NOT be read — clamping them
    // back to 99 would sample the region's own (text) pixels and bleed them into
    // the blend. Only the existing top (y-1) and left (x-1) borders are read.
    MemeGen.Inpaint.coverRegion(ctx, { x: 90, y: 90, width: 10, height: 10 });

    // Two reads only: top row (x, y-1) and left column (x-1, y).
    expect(ctx.getImageData).toHaveBeenCalledTimes(2);
    const ys = ctx.getImageData.mock.calls.map(c => c[1]);
    const xs = ctx.getImageData.mock.calls.map(c => c[0]);
    // No read ever touches the region itself or beyond the canvas edge.
    expect(Math.max(...ys)).toBe(90);  // left column read at y=90
    expect(Math.max(...xs)).toBe(90);  // top row read at x=90
    expect(ctx.getImageData).toHaveBeenCalledWith(90, 89, 10, 1); // top border
    expect(ctx.getImageData).toHaveBeenCalledWith(89, 90, 1, 10); // left border
  });

  test('a flush region still blends to the surround color via mirroring', () => {
    const ctx = makeUniformCtx(120, 60, 200);
    ctx.canvas = { width: 100, height: 100 };
    // Bottom/right borders are missing but mirror from top/left, so a uniform
    // surround still collapses to that exact color.
    MemeGen.Inpaint.coverRegion(ctx, { x: 90, y: 90, width: 8, height: 8 });

    const data = ctx.putImageData.mock.calls[0][0].data;
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(120);
      expect(data[i + 1]).toBe(60);
      expect(data[i + 2]).toBe(200);
      expect(data[i + 3]).toBe(255);
    }
  });

  test('falls back to a soft gray fill when the canvas is tainted', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    ctx.fillRect = jest.fn();
    ctx.getImageData = jest.fn(() => { throw new Error('SecurityError'); });

    MemeGen.Inpaint.coverRegion(ctx, { x: 5, y: 5, width: 10, height: 10 });

    expect(ctx.fillRect).toHaveBeenCalledWith(5, 5, 10, 10);
    expect(ctx.putImageData).not.toHaveBeenCalled(); // bailed before the blend
  });
});
