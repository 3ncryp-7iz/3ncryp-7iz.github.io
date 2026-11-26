(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const puzzle = document.querySelector('.chess-puzzle');
  const stamp = puzzle?.querySelector('.puzzle-stamp');
  if (stamp) {
    puzzle.addEventListener('puzzle:solved', () => { stamp.hidden = false; });
    puzzle.addEventListener('puzzle:reset', () => { stamp.hidden = true; });
  }

  const menu = document.querySelector('.edition-menu');
  if (menu) {
    menu.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault();
      menu.open = false;
      menu.querySelector('summary').focus();
    });
    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  }

  const sectionNav = document.querySelector('.section-nav');
  if (sectionNav) {
    const links = sectionNav.querySelectorAll('a[href^="#"]');
    function showCurrentSection() {
      for (const link of links) {
        if (link.hash === window.location.hash) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
    showCurrentSection();
    window.addEventListener('hashchange', showCurrentSection);
  }

  const postcard = document.querySelector('[data-postcard]');
  if (postcard) {
    const front = postcard.querySelector('.postcard-front');
    const back = postcard.querySelector('.postcard-back');
    const button = postcard.querySelector('[data-flip]');
    const faces = postcard.querySelector('.postcard-faces');
    const position = { angle: 0 };
    button.addEventListener('click', () => {
      const opening = back.hidden;
      front.hidden = opening;
      back.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      button.textContent = opening ? 'See the front ↻' : 'Read the postcard ↻';

      if (!reduceMotion.matches && window.createjs?.Tween) {
        createjs.Tween.removeTweens(position);
        position.angle = opening ? -24 : 24;
        const draw = () => { faces.style.transform = 'perspective(650px) rotateY(' + position.angle + 'deg)'; };
        draw();
        createjs.Tween.get(position, { onChange: draw }).to({ angle: 0 }, 380, createjs.Ease.quadOut);
      } else {
        faces.style.removeProperty('transform');
      }
    });
  }

  const grid = document.querySelector('[data-puzzle-catalogue]');
  if (grid) {
    const mate = document.querySelector('#filter-mate');
    const pageSize = document.querySelector('#catalog-page-size');
    const count = document.querySelector('#catalog-count');
    const heading = document.querySelector('#catalogue-title');
    const catalogue = document.querySelector('#collection');
    const pagers = [...catalogue.querySelectorAll('[data-catalog-pages]')].map(nav => ({
      nav,
      previous: nav.querySelector('[data-page-step="-1"]'),
      next: nav.querySelector('[data-page-step="1"]'),
      status: nav.querySelector('[data-catalog-page-status]')
    }));
    const soldPicker = document.querySelector('#preview-sold');
    const desktop = matchMedia('(width > 920px)');
    const forest = getProduct('forest');
    const washedBlack = getProduct('knight');
    const tees = [...puzzlePrints.keys()];
    let page = 0;

    function renderCatalogue(revealPreview = false) {
      const items = tees.filter(print =>
        !mate.value || puzzlePrints.get(print).label.endsWith('mate in ' + mate.value));
      const limit = Number(pageSize.value);
      const pageCount = Math.max(1, Math.ceil(items.length / limit));
      if (revealPreview && soldPicker.value) {
        const index = items.indexOf(soldPicker.value);
        if (index >= 0) page = Math.floor(index / limit);
      }
      page = Math.min(page, pageCount - 1);
      const start = page * limit;
      const columns = desktop.matches ? 5 : 2;
      grid.innerHTML = items.slice(start, start + limit).map((print, index) => {
        const darkSquare = (Math.floor(index / columns) + index % columns) % 2 === 1;
        return productCard(darkSquare ? washedBlack : forest, print);
      }).join('');

      const remaining = items.filter(print => !previewSold.has(print)).length;
      count.textContent = remaining === 1 ? '1 shirt remaining' : remaining + ' shirts remaining';
      for (const { nav, previous, next, status } of pagers) {
        nav.hidden = pageCount === 1;
        previous.disabled = page === 0;
        next.disabled = page === pageCount - 1;
        status.textContent = 'Page ' + (page + 1) + ' of ' + pageCount;
      }
    }

    for (const control of [mate, pageSize]) {
      control.addEventListener('change', () => {
        page = 0;
        renderCatalogue();
      });
    }
    function changePage(step) {
      page += step;
      renderCatalogue();
      heading.focus({ preventScroll: true });
      catalogue.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    for (const { previous, next } of pagers) {
      previous.addEventListener('click', () => changePage(-1));
      next.addEventListener('click', () => changePage(1));
    }

    for (const print of puzzlePrints.keys()) soldPicker.add(new Option('No. ' + print, print));
    soldPicker.value = [...previewSold].find(print => puzzlePrints.has(print)) ?? '';
    soldPicker.addEventListener('change', () => {
      previewSold.clear();
      if (soldPicker.value) previewSold.add(soldPicker.value);
      try {
        const url = new URL(window.location.href);
        if (soldPicker.value) url.searchParams.set('sold', soldPicker.value);
        else url.searchParams.delete('sold');
        window.history.replaceState(window.history.state, '', url);
      } catch {
        // The preview also works when local file history cannot be updated.
      }
      renderCatalogue(true);
    });

    desktop.addEventListener('change', () => renderCatalogue());
    renderCatalogue(true);
  }

  const proof = document.querySelector('#proof-select');
  if (proof) {
    const image = document.querySelector('#proof-image');
    const caption = document.querySelector('#proof-caption');
    const print = document.querySelector('#proof-print');
    const design = document.querySelector('#proof-design');
    for (const [name, , , id] of products) proof.add(new Option(name, id));
    const initialProduct = getProduct(proof.value);
    print.innerHTML = printOptions(initialProduct[5]);
    design.innerHTML = designOptions(initialProduct[6] ?? 'classic');
    const zoom = document.querySelector('#proof-zoom');
    const shop = document.querySelector('#proof-shop');

    function setZoom(enlarged) {
      image.classList.toggle('enlarged', enlarged);
      zoom.setAttribute('aria-pressed', String(enlarged));
      zoom.textContent = enlarged ? 'Show full garment −' : 'Enlarge print +';
    }

    function updateProof() {
      const product = getProduct(proof.value);
      const [, , price] = product;
      const preview = teePreview(product, print.value, design.value);
      image.innerHTML = puzzlePhoto(product, print.value, preview, 'proof-photo', design.value);
      caption.textContent = 'Puzzle #' + print.value + ' · ' + puzzlePrints.get(print.value).label + ' · ' + printDesigns.get(design.value) + ' · ' + money.format(price);
      setZoom(false);
    }

    proof.addEventListener('change', updateProof);
    print.addEventListener('change', updateProof);
    design.addEventListener('change', updateProof);
    zoom.addEventListener('click', () => setZoom(zoom.getAttribute('aria-pressed') !== 'true'));
    shop.addEventListener('click', () => showProduct(proof.value, print.value, design.value));
    updateProof();
  }

  const score = document.querySelector('.scorecard');
  if (score) {
    const cells = [...score.querySelectorAll('[data-ply]')];
    puzzle.addEventListener('puzzle:move', ({ detail }) => {
      cells[detail.ply - 1].textContent = detail.notation;
    });
    puzzle.addEventListener('puzzle:reset', () => {
      for (const cell of cells) cell.textContent = '—';
    });
  }

  const fit = document.querySelector('#fit-form');
  if (fit) {
    const width = document.querySelector('#fit-width');
    const units = document.querySelector('#fit-units');
    const rows = document.querySelector('#fit-measurements');
    const label = document.querySelector('#fit-width-label');
    const result = document.querySelector('#fit-result');
    const garment = document.querySelector('#fit-garment');
    const chart = () => sizes.map((size, index) => ({ size, cm: (garment.value === 'hoodie' ? 50 : 46) + index * 4 }));
    const inches = 2.54;
    const format = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
    let previousUnit = units.value;

    const displayWidth = cm => format.format(units.value === 'in' ? cm / inches : cm);
    function renderChart() {
      label.textContent = 'Flat width (' + units.value + ')';
      rows.innerHTML = chart().map(({ size, cm }) => '<tr><th scope="row">' + size + '</th><td>' + displayWidth(cm) + '</td></tr>').join('');
    }

    units.addEventListener('change', () => {
      const previousWidth = width.valueAsNumber;
      if (Number.isFinite(previousWidth)) {
        const nextWidth = previousUnit === 'cm' ? previousWidth / inches : previousWidth * inches;
        width.value = nextWidth.toFixed(2);
      }
      previousUnit = units.value;
      result.textContent = '';
      renderChart();
    });
    garment.addEventListener('change', () => {
      result.textContent = '';
      renderChart();
    });
    width.addEventListener('input', () => { result.textContent = ''; });
    fit.addEventListener('submit', event => {
      event.preventDefault();
      const cm = width.valueAsNumber * (units.value === 'in' ? inches : 1);
      if (!Number.isFinite(cm) || cm <= 0) return;
      const measurements = chart();
      if (cm < measurements[0].cm - 2 || cm > measurements.at(-1).cm + 2) {
        result.textContent = 'That width falls outside this sample size range.';
        return;
      }
      const closest = measurements.reduce((best, item) => Math.abs(item.cm - cm) < Math.abs(best.cm - cm) ? item : best);
      result.textContent = 'Closest sample size: ' + closest.size + ' (' + displayWidth(closest.cm) + ' ' + units.value + ' laid flat).';
    });
    renderChart();
  }
})();
