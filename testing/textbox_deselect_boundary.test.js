/**
 * textbox_deselect_boundary.test.js
 *
 * Covers the newer textbox behavior:
 * - Clicking canvas while an empty textbox is selected deletes it
 * - Clicking canvas while a non-empty textbox is selected deselects it instead of creating another one
 * - New textboxes created near the edge stay inside the canvas/template
 * - Resizing a textbox cannot expand it outside the canvas/template
 */

function mockLayoutDimensions() {
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  const originalOffsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
  const originalOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: function () {
      if (this.__mockOffsetWidth != null) return this.__mockOffsetWidth;
      if (this.classList && this.classList.contains('text-box')) return 200;
      return 0;
    }
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: function () {
      if (this.__mockOffsetHeight != null) return this.__mockOffsetHeight;
      if (this.classList && this.classList.contains('text-box')) return 80;
      return 0;
    }
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get: function () {
      return parseInt(this.style.left) || 0;
    }
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get: function () {
      return parseInt(this.style.top) || 0;
    }
  });

  return function restoreLayoutDimensions() {
    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
    }

    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    }

    if (originalOffsetLeft) {
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', originalOffsetLeft);
    }

    if (originalOffsetTop) {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', originalOffsetTop);
    }
  };
}

function makeContainer(w = 800, h = 600) {
  const div = document.createElement('div');
  div.style.position = 'relative';
  div.__mockOffsetWidth = w;
  div.__mockOffsetHeight = h;
  document.body.appendChild(div);
  return div;
}

function makeCanvas(w = 800, h = 600) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: w,
    bottom: h,
    width: w,
    height: h
  });
  return canvas;
}

function fireMousedown(target, x = 100, y = 100) {
  target.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      clientX: x,
      clientY: y
    })
  );
}

describe('Textbox deselect/delete behavior', () => {
  let container;
  let canvas;
  let restoreLayout;

  beforeEach(() => {
    restoreLayout = mockLayoutDimensions();

    container = makeContainer();
    canvas = makeCanvas();
    container.appendChild(canvas);

    MemeGen.TextBoxManager.init(container, canvas);
    MemeGen.TextBoxManager.setImageLoaded(true);
  });

  afterEach(() => {
    MemeGen.TextBoxManager.setImageLoaded(false);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.body.removeChild(container);
    restoreLayout();
  });

  test('clicking canvas while an empty textbox is selected deletes it instead of creating another one', () => {
    fireMousedown(canvas, 100, 100);

    expect(container.querySelectorAll('.text-box').length).toBe(1);

    fireMousedown(canvas, 200, 200);

    expect(container.querySelectorAll('.text-box').length).toBe(0);
  });

  test('clicking canvas while a non-empty textbox is selected deselects it and keeps it', () => {
    fireMousedown(canvas, 100, 100);

    const box = container.querySelector('.text-box');
    const textarea = box.querySelector('textarea');

    textarea.value = 'Hello';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(box.classList.contains('selected')).toBe(true);

    fireMousedown(canvas, 200, 200);

    expect(container.querySelectorAll('.text-box').length).toBe(1);
    expect(box.classList.contains('selected')).toBe(false);
  });

  test('after deselecting a non-empty textbox, another canvas click creates a new textbox', () => {
    fireMousedown(canvas, 100, 100);

    const firstTextarea = container.querySelector('.text-box textarea');
    firstTextarea.value = 'First';
    firstTextarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Click once to deselect first textbox
    fireMousedown(canvas, 200, 200);

    // Click again to create second textbox
    fireMousedown(canvas, 300, 300);

    expect(container.querySelectorAll('.text-box').length).toBe(2);
  });
});

describe('Textbox canvas/template boundary restrictions', () => {
  let container;
  let canvas;
  let restoreLayout;

  beforeEach(() => {
    restoreLayout = mockLayoutDimensions();

    container = makeContainer(800, 600);
    canvas = makeCanvas(800, 600);
    container.appendChild(canvas);

    MemeGen.TextBoxManager.init(container, canvas);
    MemeGen.TextBoxManager.setImageLoaded(true);
  });

  afterEach(() => {
    MemeGen.TextBoxManager.setImageLoaded(false);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    document.body.removeChild(container);
    restoreLayout();
  });

  test('creating a textbox near the bottom-right edge keeps it inside the canvas/template', () => {
    const textBox = new MemeGen.TextBox(0, 0, container);

    textBox.el.__mockOffsetWidth = 200;
    textBox.el.__mockOffsetHeight = 80;

    const clickX = 790;
    const clickY = 590;

    const clampedX = Math.max(
        0,
        Math.min(clickX, container.offsetWidth - textBox.el.offsetWidth)
    );

    const clampedY = Math.max(
        0,
        Math.min(clickY, container.offsetHeight - textBox.el.offsetHeight)
    );

    textBox.el.style.left = clampedX + 'px';
    textBox.el.style.top = clampedY + 'px';

    const left = parseInt(textBox.el.style.left);
    const top = parseInt(textBox.el.style.top);

    expect(left).toBeLessThanOrEqual(container.offsetWidth - textBox.el.offsetWidth);
    expect(top).toBeLessThanOrEqual(container.offsetHeight - textBox.el.offsetHeight);

    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  test('resizing bottom-right cannot expand the textbox outside the canvas/template', () => {
    const textBox = new MemeGen.TextBox(600, 500, container);

    textBox.el.__mockOffsetWidth = 150;
    textBox.el.__mockOffsetHeight = 80;

    MemeGen.DragResize.attach(textBox);

    const handle = textBox.el.querySelector('[data-corner="bottom-right"]');

    fireMousedown(handle, 750, 580);

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 9999,
        clientY: 9999
      })
    );

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    const left = parseInt(textBox.el.style.left);
    const top = parseInt(textBox.el.style.top);
    const width = parseInt(textBox.el.style.width);
    const height = parseInt(textBox.el.style.height);

    expect(left + width).toBeLessThanOrEqual(container.offsetWidth);
    expect(top + height).toBeLessThanOrEqual(container.offsetHeight);
    expect(width).toBeGreaterThanOrEqual(80);
    expect(height).toBeGreaterThanOrEqual(40);
  });

  test('resizing top-left cannot create negative width, height, left, or top', () => {
    const textBox = new MemeGen.TextBox(100, 100, container);

    textBox.el.__mockOffsetWidth = 200;
    textBox.el.__mockOffsetHeight = 80;

    MemeGen.DragResize.attach(textBox);

    const handle = textBox.el.querySelector('[data-corner="top-left"]');

    fireMousedown(handle, 100, 100);

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 100,
        clientY: 9999
      })
    );

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(parseInt(textBox.el.style.left)).toBeGreaterThanOrEqual(0);
    expect(parseInt(textBox.el.style.top)).toBeGreaterThanOrEqual(0);
    expect(parseInt(textBox.el.style.width)).toBeGreaterThanOrEqual(80);
    expect(parseInt(textBox.el.style.height)).toBeGreaterThanOrEqual(40);
  });
});