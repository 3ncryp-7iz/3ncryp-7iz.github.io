(() => {
  const page = document.querySelector('[data-playable-print]');
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('puzzle')?.padStart(3, '0');
  // Older print URLs had no batch and still point at the original collection.
  const batch = requested?.startsWith('b2-') || params.get('batch') === '1' ? '1' : '2';
  const batchPrints = window.puzzlePrints.filter(([key]) => window.puzzleBatch(key) === batch);
  const record = batchPrints.find(([key]) => key === requested || window.puzzleNumber(key) === requested)
    ?? batchPrints[0];
  const [number, label] = record;
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
  page.querySelector('[data-puzzle-number]').textContent = 'Puzzle № ' + window.puzzleNumber(number);
  page.querySelector('#puzzle-title').textContent = 'Mate in ' + summary + '.';
  page.querySelector('[data-side-to-move]').textContent = side + '.';
})();
