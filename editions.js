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

  const garment = document.querySelector('#filter-garment');
  if (garment) {
    const colour = document.querySelector('#filter-colour');
    const mate = document.querySelector('#filter-mate');
    const grid = document.querySelector('#products');
    const count = document.querySelector('#catalog-count');
    const codedCatalogue = grid.hasAttribute('data-puzzle-catalogue');
    const hoodieLook = document.querySelector('[data-hoodie-look]');
    let cards = [...grid.querySelectorAll('.product')];
    if (colour) {
      for (const label of new Set(products.map(product => product[1]))) colour.add(new Option(label, label));
    }

    function updateCatalog() {
      let available = 0;
      let sold = 0;
      for (const card of cards) {
        const product = getProduct(card.dataset.item);
        const label = puzzlePrints.get(card.dataset.print).label;
        card.hidden = Boolean((colour?.value && colour.value !== product[1])
          || (garment.value && garment.value !== garmentOf(product))
          || (mate.value && !label.endsWith('mate in ' + mate.value)));
        if (!card.hidden) {
          if (card.hasAttribute('data-sold')) sold++;
          else available++;
        }
      }
      if (sold) {
        count.textContent = available === 1 ? '1 Item remains' : available + ' Items remain';
      } else {
        count.textContent = available === 1 ? '1 Item available' : available + ' Items available';
      }
      if (hoodieLook) hoodieLook.hidden = garment.value !== 'hoodie';
    }

    garment.addEventListener('change', updateCatalog);
    colour?.addEventListener('change', updateCatalog);
    mate.addEventListener('change', updateCatalog);
    if (codedCatalogue) {
      const desktop = matchMedia('(width > 920px)');
      const forest = getProduct('forest');
      const washedBlack = getProduct('knight');
      const hoodies = ['hoodie-forest', 'hoodie-black'].map(getProduct);

      function renderCatalogue() {
        const columns = desktop.matches ? 5 : 2;
        const tees = [...puzzlePrints.keys()].map((print, index) => {
          const darkSquare = (Math.floor(index / columns) + index % columns) % 2 === 1;
          return productCard(darkSquare ? washedBlack : forest, print);
        });
        grid.innerHTML = [...tees, ...hoodies.map(product => productCard(product))].join('');
        cards = [...grid.querySelectorAll('.product')];
        updateCatalog();
      }

      const soldPicker = document.querySelector('#preview-sold');
      if (soldPicker) {
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
          renderCatalogue();
        });
      }

      desktop.addEventListener('change', renderCatalogue);
      renderCatalogue();
    } else {
      updateCatalog();
    }
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
