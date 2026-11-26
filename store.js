const storePath = document.currentScript?.src ? new URL('.', document.currentScript.src).href : '../';

const products = window.catalog;
const productDialog = document.querySelector('#product-dialog');
const bagDialog = document.querySelector('#bag-dialog');
const status = document.querySelector('#status');
const bagKey = 'chess-bag:postal-phase-2-puzzle-prints';
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const getProduct = id => products.find(product => product[3] === id);
const garmentOf = product => product[7] ?? 'tee';
const dyedTees = new Set(Object.keys(window.shirtFabrics).filter(id => id !== 'queen'));
const puzzlePrints = new Map(window.puzzlePrints.map(([id, label, file, position]) => [id, { label, file, position }]));
const printDesigns = new Map([
  ['classic', 'Classic board'],
  ['stamp', 'Postal stamp'],
  ['ledger', 'Puzzle ledger']
]);
let bag = [];

// Light ink on dark fabric needs a different mapping for board lines and for pieces.
const lightInkGarments = new Set([
  'queen', 'pawn', 'knight', 'forest', 'clay', 'coffee', 'petrol-teal',
  'brick-red', 'denim-blue', 'aubergine', 'hoodie-black', 'hoodie-oxblood', 'hoodie-forest'
]);
const hoodieFabrics = {
  'hoodie-black': 'knight', 'hoodie-oxblood': 'queen',
  'hoodie-forest': 'forest', 'hoodie-oatmeal': 'oatmeal'
};
const fabricOf = id => window.shirtFabrics[hoodieFabrics[id] ?? id];

function installGarmentFilters() {
  const defs = document.querySelector('.print-ink-definitions defs');
  if (!defs) return;
  const svg = 'http://www.w3.org/2000/svg';
  const bounds = { x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' };
  const channels = colour => [1, 3, 5].map(offset => parseInt(colour.slice(offset, offset + 2), 16) / 255);
  function element(tag, attributes) {
    const node = document.createElementNS(svg, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  for (const [id, colour] of Object.entries(window.teeInks)) {
    const filterId = 'print-ink-' + id;
    if (defs.querySelector('#' + filterId)) continue;
    const filter = element('filter', { id: filterId, ...bounds });
    const ink = channels(colour).map(value => '0 0 0 0 ' + value.toFixed(4));
    filter.append(element('feColorMatrix', { type: 'matrix', values: ink.join(' ') + ' -.2126 -.7152 -.0722 0 1' }));
    defs.append(filter);
  }

  for (const [id, ink] of Object.entries(window.teeInks)) {
    const fabric = fabricOf(id);
    const dark = lightInkGarments.has(id);
    const [shadow, highlight] = dark ? [fabric, ink] : [ink, fabric];
    const filter = element('filter', { id: 'piece-ink-' + id, ...bounds });
    const transfer = element('feComponentTransfer', { in: 'SourceGraphic' });
    const low = channels(shadow);
    const high = channels(highlight);
    for (const [index, channel] of ['R', 'G', 'B'].entries()) {
      transfer.append(element('feFunc' + channel, {
        type: 'table', tableValues: low[index] + ' ' + high[index]
      }));
    }
    filter.append(transfer);
    defs.append(filter);
  }

  // The original oxblood photo has a dark garment against a much brighter backdrop.
  // Isolate the cloth in its green channel and retain the original luminance variation.
  const weights = [.2126, .7152, .0722];
  const originalTone = channels(window.shirtFabrics.queen)
    .reduce((sum, component, index) => sum + component * weights[index], 0);
  for (const id of dyedTees) {
    const filterId = 'shirt-dye-' + id;
    const filter = element('filter', { id: filterId, ...bounds });
    const texture = 1.2;
    const coefficients = weights.map(weight => (weight * texture).toFixed(4)).join(' ');
    const dye = channels(window.shirtFabrics[id])
      .map(component => coefficients + ' 0 ' + (component - originalTone * texture).toFixed(4));
    filter.append(
      element('feColorMatrix', {
        in: 'SourceGraphic', result: 'cloth', type: 'matrix',
        values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -5 0 0 2'
      }),
      element('feColorMatrix', {
        in: 'SourceGraphic', result: 'dye', type: 'matrix',
        values: dye.join(' ') + ' 0 0 0 1 0'
      }),
      element('feComposite', { in: 'dye', in2: 'cloth', operator: 'in', result: 'colouredCloth' }),
      element('feComposite', { in: 'colouredCloth', in2: 'SourceGraphic', operator: 'over' })
    );
    defs.append(filter);
  }
}
installGarmentFilters();
for (const element of document.querySelectorAll?.('[data-puzzle-count]') ?? []) {
  element.textContent = String(puzzlePrints.size);
}

function garmentPhoto(id, cutout) {
  const dyed = dyedTees.has(id);
  const photo = dyed ? 'queen' : id;
  let file = photo + '-blank.webp';
  if (cutout) file = 'checker-product-' + photo + '.webp';
  else if (document.body?.classList.contains('streetwear')) file = 'streetwear-product-' + photo + '.webp';
  return { file, filter: dyed ? 'url(#shirt-dye-' + id + ')' : '' };
}

function designOptions(selected) {
  return [...printDesigns].map(([id, label]) =>
    `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`
  ).join('');
}

function printOptions(selected) {
  return [...puzzlePrints].map(([id, { label }]) =>
    `<option value="${id}" ${id === selected ? 'selected' : ''}>#${id} · ${label}</option>`
  ).join('');
}

const printBoxes = {
  classic: { x: 153.6, y: 138.24, size: 204.8 },
  stamp: { x: 166, y: 145, size: 180 },
  ledger: { x: 160, y: 144, size: 192 }
};
const hoodiePrint = { x: 256, y: 236, scale: .70 };

function printBox(product, design) {
  const box = printBoxes[design];
  if (garmentOf(product) !== 'hoodie') return box;
  const { x, y, scale } = hoodiePrint;
  return { x: x + (box.x - 256) * scale, y: y + (box.y - 240) * scale, size: box.size * scale };
}

function darkGarmentBoard(position, id, x, y, size) {
  const kinds = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  const artwork = [];
  for (const [row, rank] of position.split('/').entries()) {
    let column = 0;
    for (const char of rank) {
      if (/[1-8]/.test(char)) {
        column += Number(char);
        continue;
      }
      const type = char.toLowerCase();
      const side = type === char ? 'black' : 'white';
      artwork.push(`<image href="${storePath}assets/chess-template/${side}-${kinds[type]}.png" x="${column * 96}" y="${row * 96}" width="96" height="96" filter="url(#piece-ink-${id})"/>`);
      column++;
    }
  }
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 768 768" opacity=".9">
    <image href="${storePath}assets/chess-template/board.png" width="768" height="768" filter="url(#print-ink-${id})"/>
    ${artwork.join('')}
  </svg>`;
}

function teePreview(product, print, design = product[6] ?? 'classic', look, includeBoard = true, cutout = false) {
  const [, colour, , id] = product;
  const name = window.productName(product, print);
  const { file, label, position } = puzzlePrints.get(print);
  const ink = window.teeInks[id];
  const { x, y, size } = printBoxes[design];
  const fitted = look || (garmentOf(product) === 'hoodie' ? hoodiePrint : null);
  let ornament = '';
  if (design === 'stamp') {
    ornament = `<g fill="${ink}" opacity=".87">
      <rect x="146" y="125" width="220" height="220" rx="5" fill="none" stroke="${ink}" stroke-width="2.4" stroke-dasharray="2 5" stroke-linecap="round"/>
      <rect x="155" y="134" width="202" height="202" rx="2" fill="none" stroke="${ink}" stroke-width="1"/>
      <text x="256" y="361" text-anchor="middle" font-family="Georgia, serif" font-size="11" letter-spacing=".5">OffTheBoardClub</text>
    </g>`;
  }
  if (design === 'ledger') {
    const statement = label.replace(' · ', ' - ');
    ornament = `<g fill="${ink}" opacity=".9" text-anchor="middle" font-family="Georgia, serif">
      <text x="256" y="127" font-size="13" letter-spacing="2.7">PUZZLE № ${print}</text>
      <path d="M151 135H361M151 345H361" stroke="${ink}" stroke-width="1.1"/>
      <text x="256" y="362" font-size="9.5" letter-spacing=".85">${statement.toUpperCase()}</text>
    </g>`;
  }
  const transform = fitted ? `translate(${fitted.x} ${fitted.y}) scale(${fitted.scale}) translate(-256 -240)` : '';
  const photo = look ? { file: look.file, filter: '' } : garmentPhoto(id, cutout);
  const appearance = look ? 'Digital on-model mockup of ' : '';
  const diagram = !includeBoard ? ''
    : lightInkGarments.has(id) ? darkGarmentBoard(position, id, x, y, size)
      : `<image href="${storePath}assets/puzzles/${file}" x="${x}" y="${y}" width="${size}" height="${size}" filter="url(#print-ink-${id})" opacity=".9"/>`;
  return `<svg class="tee-preview" role="img" aria-label="${appearance}${name}, ${colour}: ${label}, ${printDesigns.get(design)}" viewBox="0 0 512 512" width="512" height="512">
    <image href="${storePath}assets/${photo.file}${cutout ? '?v=2' : ''}" width="512" height="512"${photo.filter ? ` filter="${photo.filter}"` : ''}/>
    <g transform="${transform}">
      ${diagram}
      ${ornament}
    </g>
  </svg>`;
}

try {
  const saved = JSON.parse(localStorage.getItem(bagKey) || '[]');
  if (Array.isArray(saved)) {
    bag = saved.filter(line => getProduct(line?.id) && puzzlePrints.has(line.print) && sizes.includes(line.size)
      && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99)
      .map(line => ({ ...line, design: printDesigns.has(line.design) ? line.design : 'classic' }));
  }
} catch {
  // The bag also works without browser storage.
}

function saveBag() {
  try {
    localStorage.setItem(bagKey, JSON.stringify(bag));
  } catch {
    // Keep the current bag in memory.
  }
  document.querySelector('#bag-count').textContent = bag.reduce((count, line) => count + line.quantity, 0);
}

const closeButton = '<form method="dialog"><button class="close" aria-label="Close" autofocus>×</button></form>';

const productGrid = document.querySelector('#products');
const hoodieGrid = document.querySelector('#hoodie-products');
const lookbook = document.querySelector('.lookbook');
const featuredProduct = productGrid.getAttribute('data-featured-product');

function puzzlePhoto(product, print, preview, className, design = product[6] ?? 'ledger') {
  const [, colour, , id] = product;
  const name = window.productName(product, print);
  return `<a class="${className} puzzle-photo-link" href="${storePath}puzzle/index.html?puzzle=${print}&amp;product=${id}&amp;style=${design}" aria-label="View ${name}, ${colour}">${preview}</a>`;
}

function productCard(product, print = product[5], featured = false, hidden = false) {
  const [, colour, price, id] = product;
  const title = window.productName(product, print);
  const detail = featured ? puzzlePrints.get(print).label : colour;
  const cutout = productGrid.hasAttribute('data-checker-products');
  const preview = teePreview(product, print, undefined, undefined, true, cutout);
  const photo = puzzlePhoto(product, print, preview, 'product-photo');
  return `
  <article class="product" data-item="${id}"${hidden ? ' hidden' : ''}>
    ${photo}
    <div class="product-info"><h3>${title}</h3><span>${money.format(price)}</span><p>${detail}</p>${featured ? `<p>${colour}</p>` : ''}</div>
  </article>`;
}

if (productGrid.hasAttribute('data-ledger-collection')) {
  const collection = window.ledgerCollection;
  const perPage = 10;
  const pageCount = Math.ceil(collection.length / perPage);
  const previous = document.querySelector('#ledger-previous');
  const next = document.querySelector('#ledger-next');
  const current = document.querySelector('#ledger-page');
  let page = 0;

  function showPage() {
    const start = page * perPage;
    productGrid.innerHTML = collection.slice(start, start + perPage)
      .map(([print, colour]) => productCard(getProduct(colour), print, true)).join('');
    current.textContent = `Page ${page + 1} of ${pageCount} · ${start + 1}–${Math.min(start + perPage, collection.length)} of ${collection.length} tees`;
    previous.disabled = page === 0;
    next.disabled = page + 1 === pageCount;
  }

  previous.addEventListener('click', () => {
    if (page === 0) return;
    page--;
    showPage();
    if (previous.disabled) next.focus();
  });
  next.addEventListener('click', () => {
    if (page + 1 === pageCount) return;
    page++;
    showPage();
    if (next.disabled) previous.focus();
  });
  showPage();
} else if (featuredProduct) {
  const base = getProduct(featuredProduct);
  const print = productGrid.getAttribute('data-featured-print') ?? base[5];
  const design = productGrid.getAttribute('data-featured-design') ?? base[6];
  const colourControls = document.querySelector('[data-shirt-colours]');
  function displayPurchase(product) {
    const [, colour, price, id] = product;
    const name = window.productName(product, print);
    const size = productGrid.querySelector('input[name="size"]:checked')?.value;
    productGrid.innerHTML = `<form class="purchase-summary" data-inline-purchase data-product="${id}" data-print="${print}" data-design="${design}">
      <div><h2>${name}</h2><p>${money.format(price)} · ${colour}</p></div>
      <div class="purchase-options">
        ${sizeFields(size)}
        <button class="button" type="submit">Add to cart <span aria-hidden="true">+</span></button>
      </div>
      <p id="size-status" role="status"></p>
    </form>`;
  }
  if (colourControls) {
    const kind = garmentOf(base);
    const surface = document.querySelector('[data-shirt-colour-surface]');
    const artwork = surface.querySelector('[data-shirt-art]');
    const board = surface.querySelector('.puzzle-board');
    const available = products.filter(product => garmentOf(product) === kind);
    const { x, y, size } = printBox(base, design);
    surface.style.setProperty('--print-left', x / 512 * 100 + '%');
    surface.style.setProperty('--print-top', y / 512 * 100 + '%');
    surface.style.setProperty('--print-width', size / 512 * 100 + '%');
    surface.style.setProperty('--print-zoom', String(384 / size));
    surface.style.setProperty('--print-centre-x', (x + size / 2) / 512 * 100 + '%');
    surface.style.setProperty('--print-centre-y', (y + size / 2) / 512 * 100 + '%');
    colourControls.querySelector('[data-colour-label]').textContent =
      (kind === 'tee' ? 'T-shirt' : 'Hoodie') + ' colour · ' + available.length + ' options';
    colourControls.querySelector('.shirt-swatches').innerHTML = available
      .map(([, colour, , id]) => `<label title="${colour}">
        <input type="radio" name="shirt-colour" value="${id}" ${id === featuredProduct ? 'checked' : ''}>
        <span class="shirt-swatch" aria-hidden="true" style="--swatch: ${fabricOf(id)}"></span>
        <span class="sr-only">${colour}</span>
      </label>`).join('');

    const cutout = document.body?.classList.contains('streetwear');
    function displayColour(id) {
      const product = getProduct(id);
      artwork.innerHTML = teePreview(product, print, design, null, false, cutout);
      surface.style.setProperty('--shirt-ink', window.teeInks[id]);
      surface.style.setProperty('--shirt-fabric', fabricOf(id));
      surface.style.setProperty('--piece-ink', 'url(#piece-ink-' + id + ')');
      board.setAttribute('aria-label', 'Chessboard printed on the ' + product[0] +
        '. Tap a piece and its destination, or use arrow keys to move between squares and Enter or Space to select.');
      displayPurchase(product);
    }

    colourControls.addEventListener('change', event => {
      if (event.target.name === 'shirt-colour' && available.some(product => product[3] === event.target.value)) {
        displayColour(event.target.value);
      }
    });
    displayColour(featuredProduct);
  } else {
    displayPurchase(base);
  }
} else if (productGrid.hasAttribute('data-puzzle-catalogue')) {
  const tees = products.filter(product => garmentOf(product) === 'tee');
  const teeByPrint = new Map(window.ledgerCollection.map(([print, id]) => [print, getProduct(id)]));
  for (const tee of tees) teeByPrint.set(tee[5], tee);

  const teeCards = [...puzzlePrints.keys()].map((print, index) =>
    productCard(teeByPrint.get(print) ?? tees[index % tees.length], print));
  const hoodieCards = products.filter(product => garmentOf(product) === 'hoodie')
    .map(product => productCard(product, product[5], false, true));
  productGrid.innerHTML = [...teeCards, ...hoodieCards].join('');
} else {
  const displayed = hoodieGrid ? products.filter(product => garmentOf(product) === 'tee') : products;
  productGrid.innerHTML = displayed.map(product => productCard(product)).join('');
}
if (hoodieGrid) {
  hoodieGrid.innerHTML = products.filter(product => garmentOf(product) === 'hoodie').map(product => productCard(product)).join('');
}

if (lookbook) {
  for (const figure of lookbook.querySelectorAll('[data-worn-look]')) {
    const look = window.garmentLooks[figure.dataset.wornLook];
    const product = getProduct(look.product);
    const [, colour, , , , print] = product;
    const name = window.productName(product, print);
    const preview = teePreview(product, print, 'ledger', look);
    figure.innerHTML = `${puzzlePhoto(product, print, preview, 'lookbook-photo', 'ledger')}
      <figcaption>
        <span>${name} · ${colour}</span>
      </figcaption>`;
  }
}

function sizeFields(selected) {
  return `<fieldset><legend>Select a size</legend><div class="sizes">${sizes.map(size => `
    <label><input required type="radio" name="size" value="${size}" ${size === selected ? 'checked' : ''}><span>${size}</span></label>
  `).join('')}</div></fieldset>`;
}

function addToBag(id, print, design, size, feedback, afterAdd) {
  if (!getProduct(id) || !sizes.includes(size) || !puzzlePrints.has(print) || !printDesigns.has(design)) return;
  const existing = bag.find(line => line.id === id && line.size === size && line.print === print && line.design === design);
  if (existing?.quantity === 99) {
    feedback.textContent = 'This size is already at the cart limit of 99.';
    return;
  }
  if (existing) existing.quantity++;
  else bag.push({ id, size, print, design, quantity: 1 });
  feedback.textContent = '';
  saveBag();
  afterAdd?.();
  showBag();
  status.textContent = `${window.productName(getProduct(id), print)}, ${printDesigns.get(design)}, size ${size}, added to your cart.`;
}

productGrid.addEventListener('submit', event => {
  const form = event.target;
  if (!form.hasAttribute('data-inline-purchase')) return;
  event.preventDefault();
  const { product, print, design } = form.dataset;
  addToBag(product, print, design, new FormData(form).get('size'), form.querySelector('#size-status'));
});

function showProduct(id, requestedPrint) {
  const product = getProduct(id);
  const [, colour, price, , , defaultPrint] = product;
  const print = puzzlePrints.has(requestedPrint) ? requestedPrint : defaultPrint;
  const name = window.productName(product, print);
  const design = 'ledger';
  productDialog.innerHTML = `${closeButton}
    <div class="product-visual">${teePreview(product, print, design)}</div>
    <div class="product-detail"><p class="eyebrow">${colour}</p><h2 id="product-title">${name}</h2>
      <p>${money.format(price)}</p>
      <form id="add-form">
        ${sizeFields()}
        <p id="size-status" role="status"></p>
        <button type="submit" class="button">Add to cart <span aria-hidden="true">+</span></button>
      </form>
    </div>`;
  productDialog.querySelector('#add-form').addEventListener('submit', event => {
    event.preventDefault();
    const size = new FormData(event.currentTarget).get('size');
    addToBag(id, print, design, size, productDialog.querySelector('#size-status'), () => productDialog.close());
  });
  productDialog.showModal();
}

function showBag(checkout = false) {
  const total = bag.reduce((sum, line) => sum + getProduct(line.id)[2] * line.quantity, 0);
  const lines = bag.map((line, index) => {
    const product = getProduct(line.id);
    const [, colour, price, id] = product;
    const name = window.productName(product, line.print);
    return `<li class="bag-line" data-item="${id}" data-size="${line.size}">
      ${teePreview(product, line.print, line.design)}
      <div><strong>${name}</strong><p>${colour} / ${line.size}</p><p>${puzzlePrints.get(line.print).label} · ${printDesigns.get(line.design)}</p>
      ${checkout ? `<p>Qty ${line.quantity}</p>` : `<div class="quantity">
        <button data-index="${index}" data-step="-1" aria-label="${line.quantity === 1 ? 'Remove' : 'Decrease quantity of'} ${name}, ${colour}, ${printDesigns.get(line.design)}, size ${line.size}">−</button>
        <span>${line.quantity}</span>
        <button data-index="${index}" data-step="1" aria-label="Increase quantity of ${name}, ${colour}, ${printDesigns.get(line.design)}, size ${line.size}" ${line.quantity >= 99 ? 'disabled' : ''}>+</button>
      </div>`}</div>
      <span>${money.format(price * line.quantity)}</span>
    </li>`;
  }).join('');
  bagDialog.innerHTML = `${closeButton}<h2 id="bag-title">${checkout ? 'Demo checkout' : 'Your cart'}</h2>
    ${bag.length ? `<ul class="bag-list">${lines}</ul><p class="subtotal"><strong>Subtotal</strong><strong>${money.format(total)}</strong></p>
      ${checkout ? '<p>This storefront is a preview. Orders and payments are disabled.</p><button class="button" id="back-bag">Back to cart</button>' : '<button class="button" id="checkout">Preview checkout <span aria-hidden="true">→</span></button>'}`
      : '<p>Your cart is empty.</p><form method="dialog"><button class="button">Continue shopping</button></form>'}`;
  if (!bagDialog.open) bagDialog.showModal();
}

document.querySelector('#open-bag').addEventListener('click', () => showBag());
bagDialog.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'checkout' || button.id === 'back-bag') {
    showBag(button.id === 'checkout');
    bagDialog.querySelector('.close').focus();
  }
  if (button.dataset.step) {
    const index = Number(button.dataset.index);
    const line = bag[index];
    line.quantity += Number(button.dataset.step);
    if (line.quantity === 0) bag.splice(index, 1);
    saveBag();
    showBag();
    const nextButton = bagDialog.querySelector(`[data-index="${index}"][data-step="${button.dataset.step}"]:not(:disabled)`);
    (nextButton || bagDialog.querySelector('.close')).focus();
    status.textContent = 'Cart updated.';
  }
});

for (const dialog of [productDialog, bagDialog]) {
  dialog?.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
saveBag();
