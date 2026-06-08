/**
 * font_settings.test.js
 * Verifies the global font-settings feature: a "font" dropdown that sets the font
 * for ALL text boxes — both the ones already on the canvas and any created
 * afterwards.
 *
 * Covers:
 *  - MemeGen.TextBox.FONTS is a shared list and the per-box dropdown is built
 *    from it (the settings menu in app.js reuses the same list).
 *  - TextBox.setFontFamily updates fontFamily, the textarea style, and the
 *    per-box dropdown value in sync.
 *  - TextBoxManager.setFontForAll re-fonts every existing box AND stores the
 *    choice so later-created boxes adopt it (current + future text).
 *
 * Modules under test: TextBox.js, TextBoxManager.js
 */

function makeContainer() {
  const div = document.createElement('div');
  div.style.position = 'relative';
  Object.defineProperty(div, 'offsetWidth', { get: () => 800, configurable: true });
  Object.defineProperty(div, 'offsetHeight', { get: () => 600, configurable: true });
  document.body.appendChild(div);
  return div;
}

// ── Shared font list ──────────────────────────────────────────────────────────

describe('Shared font list (MemeGen.TextBox.FONTS)', () => {
  it('exposes FONTS as a non-empty array of {label, value}', () => {
    expect(Array.isArray(MemeGen.TextBox.FONTS)).toBe(true);
    expect(MemeGen.TextBox.FONTS.length).toBeGreaterThan(0);
    MemeGen.TextBox.FONTS.forEach((f) => {
      expect(typeof f.label).toBe('string');
      expect(typeof f.value).toBe('string');
    });
  });

  it('builds each per-box dropdown from the shared list (values match in order)', () => {
    const container = makeContainer();
    const tb = new MemeGen.TextBox(0, 0, container);

    const optionValues = Array.from(tb.fontSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(MemeGen.TextBox.FONTS.map((f) => f.value));

    document.body.removeChild(container);
  });
});

// ── TextBox.setFontFamily ─────────────────────────────────────────────────────

describe('TextBox.setFontFamily', () => {
  let container;
  let tb;

  beforeEach(() => {
    container = makeContainer();
    tb = new MemeGen.TextBox(0, 0, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('updates fontFamily, textarea inline style, and the dropdown value together', () => {
    tb.setFontFamily('Bangers');
    expect(tb.fontFamily).toBe('Bangers');
    expect(tb.textarea.style.fontFamily).toBe('Bangers');
    expect(tb.fontSelect.value).toBe('Bangers');
  });

  it('is reflected in getState()', () => {
    tb.setFontFamily('Oswald');
    expect(tb.getState().fontFamily).toBe('Oswald');
  });
});

// ── TextBoxManager.setFontForAll ──────────────────────────────────────────────

describe('TextBoxManager.setFontForAll', () => {
  let container;
  let canvas;

  beforeEach(() => {
    container = makeContainer();
    canvas = document.createElement('canvas');
    container.appendChild(canvas);

    MemeGen.TextBoxManager.reset();
    MemeGen.TextBoxManager.init(container, canvas);
    MemeGen.TextBoxManager.setImageLoaded(true);
  });

  afterEach(() => {
    MemeGen.TextBoxManager.reset();
    document.body.removeChild(container);
  });

  it('applies the chosen font to every existing text box', () => {
    MemeGen.TextBoxManager.createTextBoxAt(10, 10);
    MemeGen.TextBoxManager.createTextBoxAt(20, 20);

    MemeGen.TextBoxManager.setFontForAll('Bangers');

    MemeGen.TextBoxManager.getAll().forEach((tb) => {
      expect(tb.fontFamily).toBe('Bangers');
      expect(tb.fontSelect.value).toBe('Bangers');
    });
  });

  it('makes text boxes created afterwards adopt the chosen font (future text)', () => {
    MemeGen.TextBoxManager.setFontForAll('Oswald');

    const tb = MemeGen.TextBoxManager.createTextBoxAt(30, 30);
    expect(tb.fontFamily).toBe('Oswald');
    expect(tb.fontSelect.value).toBe('Oswald');
  });

  it('updates both old and new boxes when changed twice', () => {
    const first = MemeGen.TextBoxManager.createTextBoxAt(10, 10);
    MemeGen.TextBoxManager.setFontForAll('Anton');

    const second = MemeGen.TextBoxManager.createTextBoxAt(40, 40);
    MemeGen.TextBoxManager.setFontForAll('Luckiest Guy');

    expect(first.fontFamily).toBe('Luckiest Guy');
    expect(second.fontFamily).toBe('Luckiest Guy');
  });

  it('reset() restores the default font for new boxes', () => {
    MemeGen.TextBoxManager.setFontForAll('Bangers');
    MemeGen.TextBoxManager.reset();
    MemeGen.TextBoxManager.init(container, canvas);
    MemeGen.TextBoxManager.setImageLoaded(true);

    const tb = MemeGen.TextBoxManager.createTextBoxAt(10, 10);
    expect(tb.fontFamily).toBe('Impact');
  });
});
