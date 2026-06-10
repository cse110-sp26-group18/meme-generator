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

  test('clamps the bottom/right sample reads to the canvas bounds', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    ctx.canvas = { width: 100, height: 100 };
    // Region flush against the bottom-right corner: y+h=100 and x+w=100 would be
    // off-canvas; reads must clamp to 99 so getImageData never goes out of bounds.
    MemeGen.Inpaint.coverRegion(ctx, { x: 90, y: 90, width: 10, height: 10 });

    const ys = ctx.getImageData.mock.calls.map(c => c[1]);
    const xs = ctx.getImageData.mock.calls.map(c => c[0]);
    expect(Math.max(...ys)).toBe(99); // bottomY clamped from 100 → 99
    expect(Math.max(...xs)).toBe(99); // rightX clamped from 100 → 99
  });

  test('clamps partially off-canvas regions before sampling and writing', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    ctx.canvas = { width: 100, height: 100 };

    MemeGen.Inpaint.coverRegion(ctx, { x: -5, y: -3, width: 15, height: 13 });

    const [imageData, dx, dy] = ctx.putImageData.mock.calls[0];
    expect(imageData.data.length).toBe(10 * 10 * 4);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
    ctx.getImageData.mock.calls.forEach(([x, y, w, h]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(100);
      expect(y + h).toBeLessThanOrEqual(100);
    });
  });

  test('falls back to a soft gray fill when the canvas is tainted', () => {
    const ctx = makeUniformCtx(0, 0, 0);
    ctx.fillRect = jest.fn();
    ctx.getImageData = jest.fn(() => { throw new Error('SecurityError'); });

    MemeGen.Inpaint.coverRegion(ctx, { x: -5, y: -5, width: 15, height: 15 });

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 10, 10);
    expect(ctx.putImageData).not.toHaveBeenCalled(); // bailed before the blend
  });
});
