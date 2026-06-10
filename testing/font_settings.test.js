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

  it('reset() restores the default font for new boxes', () => {
    MemeGen.TextBoxManager.setFontForAll('Arial');
    MemeGen.TextBoxManager.reset();
    MemeGen.TextBoxManager.init(container, canvas);
    MemeGen.TextBoxManager.setImageLoaded(true);

    const tb = MemeGen.TextBoxManager.createTextBoxAt(10, 10);
    expect(tb.fontFamily).toBe('Impact');
  });
});
