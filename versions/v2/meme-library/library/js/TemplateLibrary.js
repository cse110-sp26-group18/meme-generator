var MemeGen = window.MemeGen || {};

MemeGen.TemplateLibrary = (function () {

  var templates = [];
  var filtered = [];

  var grid, search, onSelect;

  async function init(gridEl, searchEl, callback) {

    grid = gridEl;
    search = searchEl;
    onSelect = callback;

    await loadTemplates();
    render();

    search.addEventListener("input", function () {
      filter(search.value);
    });
  }

  async function loadTemplates() {
    const res = await fetch("https://api.memegen.link/templates/");
    templates = await res.json();
    filtered = templates;
  }

  function filter(query) {
    query = query.toLowerCase();

    filtered = templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.id.toLowerCase().includes(query)
    );

    render();
  }

  function render() {
    grid.innerHTML = "";

    filtered.forEach(t => {
      const div = document.createElement("div");
      div.className = "template-item";

      div.innerHTML = `
        <img src="${t.blank}">
        <p>${t.name}</p>
      `;

      div.onclick = () => onSelect(t);

      grid.appendChild(div);
    });
  }

  return {
    init
  };

})();

window.MemeGen = MemeGen;