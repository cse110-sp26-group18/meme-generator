/**
 * @jest-environment jsdom
 */

describe('TextBox selection and editing behavior', () => {
  let container;
  let TextBox;

  beforeEach(() => {
    jest.resetModules();

    document.body.innerHTML = '<div id="meme-container"></div>';
    container = document.getElementById('meme-container');

    window.MemeGen = {};

    // v3 branch path
    require('../meme-app/js/TextBox.js');

    TextBox = window.MemeGen.TextBox;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.MemeGen = {};
  });

  function createTextBox() {
    const textbox = new TextBox(50, 60, container);

    // Simulates TextBoxManager selecting this textbox.
    textbox.onSelect = function (box) {
      box.select();
    };

    return textbox;
  }

  test('first click on an unselected textbox selects it but does not enter editing mode', () => {
    const textbox = createTextBox();

    const firstClick = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    textbox.el.dispatchEvent(firstClick);

    expect(textbox.selected).toBe(true);
    expect(textbox.editing).toBe(false);
    expect(textbox.el.classList.contains('selected')).toBe(true);

    // First click should block the typing cursor.
    expect(firstClick.defaultPrevented).toBe(true);
  });

  test('second click on an already selected textbox enters editing mode', () => {
    const textbox = createTextBox();

    const firstClick = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    textbox.el.dispatchEvent(firstClick);

    expect(textbox.selected).toBe(true);
    expect(textbox.editing).toBe(false);
    expect(firstClick.defaultPrevented).toBe(true);

    const secondClick = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    textbox.el.dispatchEvent(secondClick);

    expect(textbox.selected).toBe(true);
    expect(textbox.editing).toBe(true);

    // Second click should allow normal textarea editing.
    expect(secondClick.defaultPrevented).toBe(false);
  });

  test('textarea focus sets editing mode to true', () => {
    const textbox = createTextBox();

    textbox.textarea.dispatchEvent(
      new FocusEvent('focus', {
        bubbles: true,
      })
    );

    expect(textbox.editing).toBe(true);
  });

  test('deselect clears selected state, editing state, and selected class', () => {
    const textbox = createTextBox();

    textbox.select();
    textbox.editing = true;

    textbox.deselect();

    expect(textbox.selected).toBe(false);
    expect(textbox.editing).toBe(false);
    expect(textbox.el.classList.contains('selected')).toBe(false);
  });

  test('Delete key removes selected textbox when not editing', () => {
    const textbox = createTextBox();
    const onDeleteMock = jest.fn();

    textbox.onDelete = onDeleteMock;
    textbox.select();
    textbox.editing = false;

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(onDeleteMock).toHaveBeenCalledWith(textbox);
    expect(container.contains(textbox.el)).toBe(false);
  });

  test('Delete key does not remove textbox while editing text', () => {
    const textbox = createTextBox();
    const onDeleteMock = jest.fn();

    textbox.onDelete = onDeleteMock;
    textbox.select();
    textbox.editing = true;

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(onDeleteMock).not.toHaveBeenCalled();
    expect(container.contains(textbox.el)).toBe(true);
  });

  test('Delete key does not remove textbox when textbox is not selected', () => {
    const textbox = createTextBox();
    const onDeleteMock = jest.fn();

    textbox.onDelete = onDeleteMock;
    textbox.selected = false;
    textbox.editing = false;

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(onDeleteMock).not.toHaveBeenCalled();
    expect(container.contains(textbox.el)).toBe(true);
  });

  test('Backspace does not delete the whole textbox', () => {
    const textbox = createTextBox();
    const onDeleteMock = jest.fn();

    textbox.onDelete = onDeleteMock;
    textbox.select();
    textbox.editing = false;

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(onDeleteMock).not.toHaveBeenCalled();
    expect(container.contains(textbox.el)).toBe(true);
  });

  test('delete button still removes textbox', () => {
    const textbox = createTextBox();
    const onDeleteMock = jest.fn();

    textbox.onDelete = onDeleteMock;

    textbox.deleteBtn.click();

    expect(onDeleteMock).toHaveBeenCalledWith(textbox);
    expect(container.contains(textbox.el)).toBe(false);
  });

  test('font size increase button updates font size and display', () => {
    const textbox = createTextBox();

    expect(textbox.fontSize).toBe(24);
    expect(textbox.fontSizeDisplay.textContent).toBe('24px');

    textbox.fontSizeIncBtn.click();

    expect(textbox.fontSize).toBe(28);
    expect(textbox.textarea.style.fontSize).toBe('28px');
    expect(textbox.fontSizeDisplay.textContent).toBe('28px');
  });

  test('font size decrease button updates font size and display', () => {
    const textbox = createTextBox();

    expect(textbox.fontSize).toBe(24);
    expect(textbox.fontSizeDisplay.textContent).toBe('24px');

    textbox.fontSizeDecBtn.click();

    expect(textbox.fontSize).toBe(20);
    expect(textbox.textarea.style.fontSize).toBe('20px');
    expect(textbox.fontSizeDisplay.textContent).toBe('20px');
  });

  test('border toggle turns border off and on', () => {
    const textbox = createTextBox();

    expect(textbox.borderEnabled).toBe(true);
    expect(textbox.borderBtn.textContent).toBe('Border: ON');

    textbox.borderBtn.click();

    expect(textbox.borderEnabled).toBe(false);
    expect(textbox.borderBtn.textContent).toBe('Border: OFF');
    expect(textbox.textarea.classList.contains('no-border')).toBe(true);

    textbox.borderBtn.click();

    expect(textbox.borderEnabled).toBe(true);
    expect(textbox.borderBtn.textContent).toBe('Border: ON');
    expect(textbox.textarea.classList.contains('no-border')).toBe(false);
  });
});