(() => {
  const page = document.querySelector('[data-playable-print]');
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('puzzle')?.padStart(3, '0');
  const record = window.puzzlePrints.find(([number]) => number === requested) ?? window.puzzlePrints[0];
  const [number, label] = record;
  const product = window.catalog.find(item => item[3] === (params.get('product') ?? params.get('colour'))) ?? window.catalog[0];
  const [name, , , id] = product;
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
  document.title = 'Puzzle ' + number + ' · ' + name + ' — ChessCo - My enterprise mwhahaha';
  page.querySelector('[data-puzzle-number]').textContent = 'Puzzle № ' + number;
  page.querySelector('#puzzle-title').textContent = 'Mate in ' + summary + '.';
  page.querySelector('[data-side-to-move]').textContent = side + '.';
})();
