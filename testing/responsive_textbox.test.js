/**
 * responsive_textbox.test.js
 * Covers the image-relative anchoring system that keeps text boxes pinned
 * to the same visual point on the meme when CSS resizes the canvas-
 * container (viewport change / desktop library panel drag).
 *
 * What's verified:
 *  - TextBox.prototype.captureRelativeState stores x/y/width/height as
 *    ratios of the current container display size.
 *  - TextBox.prototype.applyRelativeState writes back display px =
 *    ratio × new container display size.
 *  - TextBox.prototype.getState exposes containerWidth / containerHeight
 *    so Exporter can scale display coords to canvas-bitmap coords.
 *  - TextBoxManager.syncTextBoxesToCanvas applies ratios for every box.
 *  - Exporter draws at scaled coords when state has containerWidth.
 *
 * jsdom note: jsdom does not compute layout. We mock offsetWidth /
 * offsetHeight / offsetLeft / offsetTop on the container and text box
 * elements (same pattern as textbox_deselect_boundary.test.js).
 */

function mockOffsets() {
  const w = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  const l = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
  const t = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: function () {
      if (this.__mockOW != null) return this.__mockOW;
      if (this.classList && this.classList.contains('text-box')) {
        return parseInt(this.style.width, 10) || 200;
      }
      return 0;
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: function () {
      if (this.__mockOH != null) return this.__mockOH;
      if (this.classList && this.classList.contains('text-box')) {
        return parseInt(this.style.height, 10) || 80;
      }
      return 0;
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get: function () { return parseInt(this.style.left, 10) || 0; }
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get: function () { return parseInt(this.style.top, 10) || 0; }
  });

  return function restore() {
    if (w) Object.defineProperty(HTMLElement.prototype, 'offsetWidth',  w);
    if (h) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', h);
    if (l) Object.defineProperty(HTMLElement.prototype, 'offsetLeft',   l);
    if (t) Object.defineProperty(HTMLElement.prototype, 'offsetTop',    t);
  };
}

function makeContainer(w, h) {
  const div = document.createElement('div');
  div.style.position = 'relative';
  div.__mockOW = w;
  div.__mockOH = h;
  document.body.appendChild(div);
  return div;
}

describe('TextBox image-relative anchoring', () => {
  let restore;
  let container;
  let tb;

  beforeEach(() => {
    restore = mockOffsets();
    container = makeContainer(800, 600);
    tb = new window.MemeGen.TextBox(0, 0, container);
    // Position the box at a known display coordinate.
    tb.el.style.left = '200px';
    tb.el.style.top = '150px';
    tb.el.style.width = '160px';
    tb.el.style.height = '60px';
  });

  afterEach(() => {
    if (tb && tb.el && tb.el.parentNode) tb.el.parentNode.removeChild(tb.el);
    if (container && container.parentNode) container.parentNode.removeChild(container);
    restore();
  });

  it('captureRelativeState stores ratios = el offsets / container offsets', () => {
    tb.captureRelativeState();
    expect(tb.relativeState).not.toBeNull();
    expect(tb.relativeState.xRatio).toBeCloseTo(200 / 800, 4);
    expect(tb.relativeState.yRatio).toBeCloseTo(150 / 600, 4);
    expect(tb.relativeState.widthRatio).toBeCloseTo(160 / 800, 4);
    expect(tb.relativeState.heightRatio).toBeCloseTo(60 / 600, 4);
  });

  it('captureRelativeState is a no-op when the container has no measurable size', () => {
    container.__mockOW = 0;
    container.__mockOH = 0;
    const before = tb.relativeState;
    tb.captureRelativeState();
    expect(tb.relativeState).toBe(before); // unchanged
  });

  it('applyRelativeState rewrites el.style at ratios × new container size', () => {
    tb.captureRelativeState();
    // Shrink container — simulates viewport / library resize.
    container.__mockOW = 400;
    container.__mockOH = 300;
    tb.applyRelativeState();
    expect(parseInt(tb.el.style.left, 10)).toBe(Math.round(200 / 800 * 400));    // 100
    expect(parseInt(tb.el.style.top, 10)).toBe(Math.round(150 / 600 * 300));     // 75
    expect(parseInt(tb.el.style.width, 10)).toBe(Math.round(160 / 800 * 400));   // 80
    expect(parseInt(tb.el.style.height, 10)).toBe(Math.round(60 / 600 * 300));   // 30
  });

  it('round-trip: capture, shrink, apply, recapture — ratios stay consistent', () => {
    tb.captureRelativeState();
    const r1 = Object.assign({}, tb.relativeState);
    container.__mockOW = 400;
    container.__mockOH = 300;
    tb.applyRelativeState();
    tb.captureRelativeState();
    expect(tb.relativeState.xRatio).toBeCloseTo(r1.xRatio, 2);
    expect(tb.relativeState.yRatio).toBeCloseTo(r1.yRatio, 2);
    expect(tb.relativeState.widthRatio).toBeCloseTo(r1.widthRatio, 2);
    expect(tb.relativeState.heightRatio).toBeCloseTo(r1.heightRatio, 2);
  });

  it('applyRelativeState is a no-op when no ratios are stored yet', () => {
    tb.relativeState = null;
    const before = { L: tb.el.style.left, T: tb.el.style.top, W: tb.el.style.width, H: tb.el.style.height };
    tb.applyRelativeState();
    expect(tb.el.style.left).toBe(before.L);
    expect(tb.el.style.top).toBe(before.T);
    expect(tb.el.style.width).toBe(before.W);
    expect(tb.el.style.height).toBe(before.H);
  });
});

describe('TextBox.getState exposes container display dimensions', () => {
  let restore, container, tb;

  beforeEach(() => {
    restore = mockOffsets();
    container = makeContainer(640, 480);
    tb = new window.MemeGen.TextBox(0, 0, container);
    tb.el.style.left = '100px';
    tb.el.style.top = '50px';
    tb.el.style.width = '180px';
    tb.el.style.height = '60px';
  });

  afterEach(() => {
    if (tb && tb.el && tb.el.parentNode) tb.el.parentNode.removeChild(tb.el);
    if (container && container.parentNode) container.parentNode.removeChild(container);
    restore();
  });

  it('includes containerWidth and containerHeight for Exporter scaling', () => {
    const state = tb.getState();
    expect(state.containerWidth).toBe(640);
    expect(state.containerHeight).toBe(480);
    expect(state.x).toBe(100);
    expect(state.width).toBe(180);
  });
});

describe('TextBoxManager.syncTextBoxesToCanvas', () => {
  let restore, container;

  beforeEach(() => {
    restore = mockOffsets();
    container = makeContainer(800, 600);
    document.body.appendChild(container);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    window.MemeGen.TextBoxManager.reset();
    window.MemeGen.TextBoxManager.init(container, canvas);
    window.MemeGen.TextBoxManager.setImageLoaded(true);
  });

  afterEach(() => {
    window.MemeGen.TextBoxManager.reset();
    if (container && container.parentNode) container.parentNode.removeChild(container);
    restore();
  });

  it('is exposed as a public method', () => {
    expect(typeof window.MemeGen.TextBoxManager.syncTextBoxesToCanvas).toBe('function');
  });

  it('applies stored ratios for every text box when container size changes', (done) => {
    // Create two boxes at known positions.
    const tb1 = window.MemeGen.TextBoxManager.createTextBoxAt(200, 150);
    const tb2 = window.MemeGen.TextBoxManager.createTextBoxAt(400, 300);
    expect(tb1).not.toBeNull();
    expect(tb2).not.toBeNull();
    // createTextBoxAt should have captured ratios after positioning.
    expect(tb1.relativeState).not.toBeNull();
    expect(tb2.relativeState).not.toBeNull();

    // Shrink container — observer would fire syncTextBoxesToCanvas.
    container.__mockOW = 400;
    container.__mockOH = 300;
    window.MemeGen.TextBoxManager.syncTextBoxesToCanvas();

    // syncTextBoxesToCanvas uses requestAnimationFrame; wait one frame.
    setTimeout(() => {
      expect(parseInt(tb1.el.style.left, 10)).toBe(Math.round(tb1.relativeState.xRatio * 400));
      expect(parseInt(tb1.el.style.top, 10)).toBe(Math.round(tb1.relativeState.yRatio * 300));
      expect(parseInt(tb2.el.style.left, 10)).toBe(Math.round(tb2.relativeState.xRatio * 400));
      expect(parseInt(tb2.el.style.top, 10)).toBe(Math.round(tb2.relativeState.yRatio * 300));
      done();
    }, 32);
  });
});

describe('Exporter scales state coords to canvas bitmap', () => {
  function makeTextBoxWithState(state) {
    return { getState: () => state, deselect: jest.fn() };
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function makeImage() {
    const i = document.createElement('canvas');
    i.width = 800;
    i.height = 600;
    return i;
  }

  it('scales x / y / fontSize when state.containerWidth differs from canvas.width', () => {
    // Bitmap: 800×600. Display container was 400×300 when captured (half size).
    const canvas = makeCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    const fillSpy = jest.spyOn(ctx, 'fillText');
    const image = makeImage();
    const tb = makeTextBoxWithState({
      x: 100, y: 75,
      width: 200, height: 80,
      text: 'Hi',
      fontFamily: 'Impact',
      fontSize: 24,
      borderEnabled: false,
      containerWidth: 400,
      containerHeight: 300
    });

    window.MemeGen.Exporter.getMemeBlob(canvas, ctx, image, [tb], jest.fn());

    // Display x=100 should land at bitmap x ≈ 200 (scale = 2).
    // Plus padding = 6 * 2 = 12. So fillText called at x = 200 + 12 = 212.
    expect(fillSpy).toHaveBeenCalled();
    const [, callX] = fillSpy.mock.calls[0];
    expect(callX).toBeCloseTo(212, 0);
  });

  it('falls back to scale = 1 when state has no containerWidth/Height', () => {
    const canvas = makeCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    const fillSpy = jest.spyOn(ctx, 'fillText');
    const image = makeImage();
    const tb = makeTextBoxWithState({
      x: 100, y: 75,
      width: 200, height: 80,
      text: 'Hi',
      fontFamily: 'Impact',
      fontSize: 24,
      borderEnabled: false
      // no containerWidth/containerHeight
    });

    window.MemeGen.Exporter.getMemeBlob(canvas, ctx, image, [tb], jest.fn());

    expect(fillSpy).toHaveBeenCalled();
    const [, callX] = fillSpy.mock.calls[0];
    // scale = 1 → x = state.x + padding = 100 + 6 = 106
    expect(callX).toBeCloseTo(106, 0);
  });
});
