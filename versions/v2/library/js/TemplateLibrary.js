var MemeGen = window.MemeGen || {};

MemeGen.TemplateLibrary = (function () {
  function TemplateLibrary(onSelectTemplate) {
    this.onSelectTemplate = onSelectTemplate;
    this.templates = [];
    this.grid = document.getElementById('template-grid');
    this.search = document.getElementById('template-search');
    this.overlay = document.getElementById('modal-overlay');
    this.initListeners();
  }

  TemplateLibrary.prototype.fetchTemplates = async function () {
    try {
      this.grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">Loading templates...</p>';
      const response = await fetch('https://api.memegen.link/templates');
      this.templates = await response.json();
      this.render();
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      this.grid.innerHTML = '<p>Error loading templates. Please try again later.</p>';
    }
  };

  TemplateLibrary.prototype.initListeners = function () {
    this.search.addEventListener('input', (e) => this.render(e.target.value));
    
    document.getElementById('browse-templates-btn').addEventListener('click', () => {
      this.overlay.style.display = 'flex';
      if (this.templates.length === 0) this.fetchTemplates();
    });

    document.getElementById('close-modal').addEventListener('click', () => {
      this.overlay.style.display = 'none';
    });
  };

  TemplateLibrary.prototype.render = function (filter = '') {
    this.grid.innerHTML = '';
    const filtered = this.templates.filter(t => 
      t.name.toLowerCase().includes(filter.toLowerCase())
    );

    filtered.slice(0, 50).forEach(template => {
      const item = document.createElement('div');
      item.className = 'template-item';
      item.innerHTML = `
        <img src="${template.blank}" alt="${template.name}" loading="lazy">
        <p style="font-size: 11px; text-align: center; margin-top: 4px;">${template.name}</p>
      `;
      item.onclick = () => {
        this.onSelectTemplate(template.blank);
        this.overlay.style.display = 'none';
      };
      this.grid.appendChild(item);
    });
  };

  return TemplateLibrary;
})();

window.MemeGen = MemeGen;
