(() => {
  const page = document.querySelector('[data-playable-print]');
  const params = new URLSearchParams(window.location.search);
  const rawNumber = params.get('puzzle');
  const requested = params.get('batch') === '2' && /^\d+$/.test(rawNumber ?? '')
    ? 'b2-' + rawNumber.padStart(3, '0')
    : rawNumber?.padStart(3, '0');
  const record = window.puzzlePrints.find(([number]) => number === requested) ?? window.puzzlePrints[0];
  const [number, label, , , difficulty] = record;
  const requestedId = params.get('product') ?? params.get('colour');
  const requestedProduct = window.catalog.find(item => item[3] === requestedId);
  const tees = window.catalog.filter(item => item[7] !== 'hoodie');
  const product = tees.find(item => item[3] === requestedId)
    ?? tees.find(item => item[1] === requestedProduct?.[1])
    ?? tees[0];
  const id = product[3];
  const [fen, moves] = window.puzzlePositions[number];
  const [side, mate] = label.split(' · ');
  const count = Number(mate.split(' ').at(-1));
  const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
  const summary = words[count] ?? String(count);
  const grid = document.querySelector('#products');
  page.dataset.position = fen;
  page.dataset.solution = moves;
  const setup = window.puzzleSetups?.[number];
  if (setup) {
    page.setAttribute('data-setup-moves', setup.moves);
    page.setAttribute('data-setup-keep', setup.keep);
  }
  page.classList.toggle('has-promotion', moves.split(' ').some(move => move.length === 5));
  grid.dataset.featuredProduct = id;
  grid.dataset.featuredPrint = number;
  grid.dataset.featuredDesign = 'ledger';
  document.title = window.productName(product, number) + ' — OffTheBoardClub';
  if (window.puzzleBatch(number) === '2') {
    document.querySelector('[data-shop-back]')?.setAttribute('href', '../index.html?batch=2#collection');
  }
  page.querySelector('[data-puzzle-number]').textContent =
    'Puzzle № ' + window.puzzleNumber(number) + (difficulty ? ' · ' + difficulty : '');
  page.querySelector('#puzzle-title').textContent = 'Mate in ' + summary + '.';
  page.querySelector('[data-side-to-move]').textContent = side + '.';
})();
