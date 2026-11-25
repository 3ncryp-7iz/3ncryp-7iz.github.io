(() => {
  const section = document.querySelector('.chess-puzzle');
  const board = section.querySelector('.puzzle-board');
  const feedback = section.querySelector('.puzzle-feedback');
  const hintButton = section.querySelector('[data-hint]');
  const showButton = section.querySelector('[data-solution]');
  const resetButton = section.querySelector('[data-reset]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const shirtView = section.querySelector('[data-shirt-view]');
  const shirtZoom = section.querySelector('[data-shirt-zoom]');
  const replaySetup = section.querySelector('[data-replay-setup]');
  const setupMoves = section.getAttribute('data-setup-moves');
  const keep = new Set((section.getAttribute('data-setup-keep') ?? '').split(' '));
  const animateSetup = shirtView && Boolean(setupMoves);

  const defaultOpening = { 'white-king': 'e8', 'white-rook': 'e7', 'black-king': 'h8' };
  const defaultPieces = {
    'white-king': ['♚', 'White king'],
    'white-rook': ['♜', 'White rook'],
    'black-king': ['♚', 'Black king']
  };
  const defaultLine = [
    ['white-king', 'e8', 'f7', 'Kf7', 'The king needs to take away Black’s escape squares.'],
    ['black-king', 'h8', 'h7', 'Kh7'],
    ['white-rook', 'e7', 'e6', 'Re6', 'Move the rook down one rank and prepare to swing it across.'],
    ['black-king', 'h7', 'h8', 'Kh8'],
    ['white-rook', 'e6', 'h6', 'Rh6#', 'Bring the rook to the h-file.']
  ];
  const files = 'abcdefgh';
  const setup = section.getAttribute('data-position');
  const startingSide = setup?.split(' ')[1] === 'b' ? 'Black' : 'White';
  const playerPrefix = startingSide.toLowerCase() + '-';
  const promotionChoices = section.querySelector('[data-promotion]');
  const { opening, pieces, line } = setup
    ? readArchivedPuzzle(setup, section.getAttribute('data-solution'))
    : { opening: defaultOpening, pieces: defaultPieces, line: defaultLine };

  function readArchivedPuzzle(fen, solution, mateAtEnd = true, keepSquares) {
    const kinds = {
      k: ['♚', 'king'], q: ['♛', 'queen'], r: ['♜', 'rook'],
      b: ['♝', 'bishop'], n: ['♞', 'knight'], p: ['♟', 'pawn']
    };
    const opening = {};
    const pieces = {};
    const squares = new Map();
    for (const [row, rank] of fen.split(' ')[0].split('/').entries()) {
      let col = 0;
      for (const symbol of rank) {
        if (/[1-8]/.test(symbol)) {
          col += Number(symbol);
          continue;
        }
        const kind = symbol.toLowerCase();
        const side = symbol === kind ? 'Black' : 'White';
        const square = files[col++] + (8 - row);
        if (keepSquares && !keepSquares.has(square)) continue;
        const id = side.toLowerCase() + '-' + square;
        const [glyph, name] = kinds[kind];
        opening[id] = square;
        pieces[id] = [glyph, side + ' ' + name];
        squares.set(square, { id, kind, side });
      }
    }
    const moves = solution.trim() ? solution.trim().split(/\s+/) : [];
    const line = moves.map((uci, index) => {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promote = uci[4];
      const piece = squares.get(from);
      const isCastle = piece.kind === 'k' && Math.abs(files.indexOf(from[0]) - files.indexOf(to[0])) === 2;
      // A setup may position a displaced pawn diagonally without replaying its capture.
      const isEnPassant = !keepSquares && piece.kind === 'p' && from[0] !== to[0] && !squares.has(to);
      const captureSquare = isEnPassant ? to[0] + from[1] : to;
      const captured = squares.get(captureSquare);
      const end = mateAtEnd && index === moves.length - 1 ? '#' : '';
      let rook;
      let notation;
      if (isCastle) {
        const kingSide = to[0] === 'g';
        const rookFrom = (kingSide ? 'h' : 'a') + from[1];
        const rookTo = (kingSide ? 'f' : 'd') + from[1];
        const rookPiece = squares.get(rookFrom);
        rook = { id: rookPiece.id, to: rookTo };
        squares.delete(rookFrom);
        squares.set(rookTo, rookPiece);
        notation = (kingSide ? 'O-O' : 'O-O-O') + end;
      } else {
        const prefix = piece.kind === 'p' ? (captured ? from[0] : '') : piece.kind.toUpperCase();
        notation = prefix + (captured ? 'x' : '') + to + (promote ? '=' + promote.toUpperCase() : '') + end;
      }
      const hint = 'Try the ' + piece.side.toLowerCase() + ' ' + kinds[piece.kind][1] + ' on ' + from + '.';
      squares.delete(from);
      if (captured) squares.delete(captureSquare);
      squares.set(to, promote ? { ...piece, kind: promote } : piece);
      const promotion = promote ? [kinds[promote][0], piece.side + ' ' + kinds[promote][1]] : null;
      return [piece.id, from, to, notation, hint, { captured: captured?.id, rook, promote, promotion }];
    });
    return { opening, pieces, line };
  }
  const squares = new Map();
  const tokens = new Map();
  let position = { ...opening };
  let appearances = { ...pieces };
  let pendingPromotion = false;
  let selected = null;
  let ply = 0;
  let busy = false;
  let timer;
  let setupPlayed = false;
  const setupTokens = [];
  const startingSquare = line[0][1];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = files[col] + (8 - row);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.tabIndex = square === startingSquare ? 0 : -1;
      cell.className = (row + col) % 2 ? 'puzzle-square dark' : 'puzzle-square';
      cell.dataset.square = square;
      if (col === 0) cell.dataset.rank = 8 - row;
      if (row === 7) cell.dataset.file = files[col];
      squares.set(square, cell);
      board.append(cell);
    }
  }

  function showPiece(piece, [symbol, label]) {
    if (!shirtView) {
      piece.textContent = symbol;
      return;
    }
    let image = piece.firstElementChild;
    if (!image) {
      image = document.createElement('img');
      image.alt = '';
      image.draggable = false;
      piece.append(image);
    }
    image.src = '../assets/chess-template/' + label.toLowerCase().replace(' ', '-') + '.png';
  }

  for (const [id, appearance] of Object.entries(pieces)) {
    const piece = document.createElement('span');
    piece.className = 'puzzle-piece ' + id.split('-')[0];
    showPiece(piece, appearance);
    piece.setAttribute('aria-hidden', 'true');
    tokens.set(id, piece);
  }

  function updateLabels() {
    for (const [square, cell] of squares) {
      const piece = Object.keys(position).find(id => position[id] === square);
      cell.setAttribute('aria-label', piece ? square + ', ' + appearances[piece][1] : square);
      cell.setAttribute('aria-pressed', String(square === selected));
      if (shirtView) cell.draggable = ply < line.length && Boolean(piece?.startsWith(playerPrefix));
    }
  }

  function animate(piece, frames, delay = 0, duration = 410) {
    if (reduceMotion.matches || !piece.animate) return;
    piece.getAnimations().forEach(animation => animation.cancel());
    piece.animate(frames, { duration, delay, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  }

  function layOut(entrance) {
    let index = 0;
    for (const [id, square] of Object.entries(position)) {
      const piece = tokens.get(id);
      piece.getAnimations?.().forEach(animation => animation.cancel());
      showPiece(piece, appearances[id]);
      squares.get(square).append(piece);
      if (entrance) {
        const offset = id.startsWith('black-') ? '1.4rem' : '-1.4rem';
        animate(piece, [
          { transform: 'translate(' + offset + ', 2rem) scale(.78)', opacity: 0 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 }
        ], index * (setup ? 45 : 120));
      }
      index++;
    }
    updateLabels();
  }

  function reset(entrance) {
    clearTimeout(timer);
    for (const token of setupTokens.splice(0)) token.remove();
    if (animateSetup) board.setAttribute('aria-busy', 'false');
    position = { ...opening };
    appearances = { ...pieces };
    pendingPromotion = false;
    if (promotionChoices) promotionChoices.hidden = true;
    selected = null;
    ply = 0;
    busy = false;
    hintButton.disabled = false;
    showButton.disabled = false;
    feedback.textContent = '';
    layOut(entrance);
    section.dispatchEvent(new Event('puzzle:reset'));
  }

  function slidePiece(piece, from, to, duration = 410, knight = false) {
    const source = squares.get(from);
    const destination = squares.get(to);
    const old = source.getBoundingClientRect();
    const next = destination.getBoundingClientRect();
    const scale = shirtView && old.width && source.offsetWidth ? old.width / source.offsetWidth : 1;
    destination.append(piece);
    if (from === to) return;
    const x = (old.left - next.left) / scale;
    const y = (old.top - next.top) / scale;
    const frames = [{ transform: `translate(${x}px, ${y}px)` }];
    if (knight) {
      const [legX, legY] = Math.abs(x) > Math.abs(y) ? [0, y] : [x, 0];
      frames.push({ transform: `translate(${legX}px, ${legY}px)`, offset: 2 / 3 });
    }
    frames.push({ transform: 'translate(0, 0)' });
    animate(piece, frames, 0, duration);
  }

  function playSetup() {
    setupPlayed = true;
    reset(false);
    if (reduceMotion.matches) return;

    busy = true;
    hintButton.disabled = true;
    showButton.disabled = true;
    board.setAttribute('aria-busy', 'true');
    for (const token of tokens.values()) token.remove();
    for (const [square, cell] of squares) {
      cell.setAttribute('aria-label', square);
      cell.draggable = false;
    }

    const standard = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
    const fullBoard = readArchivedPuzzle(standard, '', false);
    const start = readArchivedPuzzle(standard, setupMoves, false, keep);
    const active = new Map();
    let waveEnd = 0;
    for (const [id, square] of Object.entries(fullBoard.opening)) {
      const appearance = fullBoard.pieces[id];
      const token = document.createElement('span');
      token.className = 'puzzle-piece ' + id.split('-')[0];
      token.setAttribute('aria-hidden', 'true');
      showPiece(token, appearance);
      setupTokens.push(token);
      active.set(id, { token, square, appearance });
      const cell = squares.get(square);
      cell.append(token);
      cell.setAttribute('aria-label', square + ', ' + appearance[1]);
      if (token.animate) {
        const file = files.indexOf(square[0]);
        const row = 8 - Number(square[1]);
        const delay = (file * 2 + row) * 29;
        const duration = 460;
        const tilt = file % 2 ? 13 : -13;
        token.animate([
          { transform: `translateY(-155%) rotate(${tilt}deg) scale(.87)`, opacity: 0, easing: 'cubic-bezier(.55,.05,.85,.45)' },
          { transform: 'translateY(7%) rotate(0deg) scale(1.06,.94)', opacity: 1, offset: .72, easing: 'ease-out' },
          { transform: 'translateY(-8%) scale(.99,1.01)', offset: .87, easing: 'ease-in' },
          { transform: 'translateY(0) scale(1)' }
        ], { delay, duration, fill: 'backwards' });
        waveEnd = Math.max(waveEnd, delay + duration);
      }
    }

    function playPly(index) {
      const [id, from, to, , , changes] = start.line[index];
      const piece = active.get(id);
      const captured = active.get(changes.captured);
      const duration = 180;
      slidePiece(piece.token, from, to, duration, piece.appearance[1].endsWith('knight'));
      piece.square = to;
      if (changes.rook) {
        const rook = active.get(changes.rook.id);
        slidePiece(rook.token, rook.square, changes.rook.to, duration);
        rook.square = changes.rook.to;
      }
      timer = setTimeout(() => {
        if (captured) {
          captured.token.remove();
          active.delete(changes.captured);
          squares.get(captured.square).setAttribute('aria-label', captured.square);
        }
        if (changes.promotion) {
          piece.appearance = changes.promotion;
          showPiece(piece.token, piece.appearance);
        }
        squares.get(from).setAttribute('aria-label', from);
        squares.get(to).setAttribute('aria-label', to + ', ' + piece.appearance[1]);

        if (index + 1 === start.line.length) {
          reset(false);
          return;
        }
        // White moves, Black responds, then pause briefly before the next pair.
        timer = setTimeout(() => playPly(index + 1), id.startsWith('black-') ? 65 : 16);
      }, duration);
    }
    const spare = [...active.entries()].filter(([, piece]) => !keep.has(piece.square));
    timer = setTimeout(() => {
      for (const [, piece] of spare) {
        const rank = Number(piece.square[1]);
        const distance = rank < 5 ? rank : rank - 9;
        piece.token.animate?.([
          { transform: 'translateY(0)' },
          { transform: 'translateY(' + distance * 110 + '%)' }
        ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
      }
      timer = setTimeout(() => {
        for (const [id, piece] of spare) {
          piece.token.remove();
          active.delete(id);
          squares.get(piece.square).setAttribute('aria-label', piece.square);
        }
        if (start.line.length) playPly(0);
        else reset(false);
      }, 320);
    }, waveEnd ? waveEnd + 100 : 300);
  }

  function move() {
    const [id, from, to, notation, , changes] = line[ply++];
    const piece = tokens.get(id);
    piece.getAnimations?.().forEach(animation => animation.cancel());
    if (changes?.captured) {
      tokens.get(changes.captured).remove();
      delete position[changes.captured];
    }
    if (changes?.rook) {
      position[changes.rook.id] = changes.rook.to;
      squares.get(changes.rook.to).append(tokens.get(changes.rook.id));
    }
    if (changes?.promotion) {
      appearances[id] = changes.promotion;
      showPiece(piece, changes.promotion);
    }
    position[id] = to;
    selected = null;
    slidePiece(piece, from, to);
    updateLabels();
    section.dispatchEvent(new CustomEvent('puzzle:move', { detail: { ply, notation } }));
    return notation;
  }

  function finish(notation, solvedByPlayer = true) {
    busy = false;
    hintButton.disabled = true;
    showButton.disabled = true;
    if (solvedByPlayer) feedback.textContent = notation;
    section.dispatchEvent(new Event('puzzle:solved'));
  }

  function advancePlayer() {
    const played = move();
    if (ply === line.length) {
      finish(played);
      return;
    }
    busy = true;
    hintButton.disabled = true;
    feedback.textContent = '';
    timer = setTimeout(() => {
      move();
      busy = false;
      hintButton.disabled = false;
    }, reduceMotion.matches ? 0 : 550);
  }

  function choose(square) {
    if (busy || pendingPromotion || ply === line.length) return;
    const [, from, to, , , changes] = line[ply];
    const playerPiece = Object.keys(position).find(id => id.startsWith(playerPrefix) && position[id] === square);
    if (playerPiece) {
      selected = selected === square ? null : square;
      updateLabels();
      return;
    }
    if (selected !== from || square !== to) return;
    if (changes?.promote && promotionChoices) {
      pendingPromotion = true;
      promotionChoices.hidden = false;
      promotionChoices.querySelector('button').focus();
      return;
    }
    advancePlayer();
  }

  promotionChoices?.addEventListener('click', event => {
    const option = event.target.closest('[data-promote]');
    if (!option || !pendingPromotion || option.dataset.promote !== line[ply][5].promote) return;
    pendingPromotion = false;
    promotionChoices.hidden = true;
    squares.get(line[ply][2]).focus();
    advancePlayer();
  });

  function focusSquare(cell, focus) {
    board.querySelector('[tabindex="0"]').tabIndex = -1;
    cell.tabIndex = 0;
    if (focus) cell.focus();
  }

  board.addEventListener('click', event => {
    const cell = event.target.closest('[data-square]');
    if (!cell) return;
    focusSquare(cell, false);
    choose(cell.dataset.square);
  });

  board.addEventListener('keydown', event => {
    const [file, rank] = event.target.dataset.square || '';
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
    if (!file || !delta) return;
    event.preventDefault();
    const [x, y] = delta;
    const next = squares.get(files[files.indexOf(file) + x] + (Number(rank) + y));
    if (next) focusSquare(next, true);
  });

  if (shirtView) {
    function setZoom(zoomed) {
      shirtView.dataset.zoomed = String(zoomed);
      shirtZoom.setAttribute('aria-pressed', String(zoomed));
      shirtZoom.textContent = zoomed ? 'Show full item' : 'Zoom print';
    }
    setZoom(false);
    shirtZoom.addEventListener('click', () => setZoom(shirtView.dataset.zoomed !== 'true'));

    let dragging = false;
    board.addEventListener('dragstart', event => {
      const cell = event.target.closest('[data-square]');
      if (!cell?.draggable || busy || pendingPromotion) {
        event.preventDefault();
        return;
      }
      if (selected !== cell.dataset.square) choose(cell.dataset.square);
      dragging = true;
      event.dataTransfer.setData('text/plain', cell.dataset.square);
      event.dataTransfer.effectAllowed = 'move';
    });
    board.addEventListener('dragover', event => {
      if (dragging && event.target.closest('[data-square]')) event.preventDefault();
    });
    board.addEventListener('drop', event => {
      const cell = event.target.closest('[data-square]');
      if (!dragging || !cell) return;
      event.preventDefault();
      dragging = false;
      focusSquare(cell, false);
      choose(cell.dataset.square);
    });
    board.addEventListener('dragend', () => { dragging = false; });
  }

  hintButton.addEventListener('click', () => {
    feedback.textContent = line[ply][4];
  });
  resetButton.addEventListener('click', () => {
    setupPlayed = true;
    reset(true);
  });
  showButton.addEventListener('click', () => {
    reset(false);
    busy = true;
    hintButton.disabled = true;
    showButton.disabled = true;
    function play() {
      const notation = move();
      if (ply === line.length) {
        finish(notation, false);
        return;
      }
      if (reduceMotion.matches) play();
      else timer = setTimeout(play, 630);
    }
    play();
  });

  if (animateSetup && replaySetup) {
    replaySetup.hidden = false;
    replaySetup.addEventListener('click', playSetup);

  }
  reset(false);
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      if (!setupPlayed && ply === 0 && !selected) {
        if (animateSetup) playSetup();
        else layOut(true);
      }
    }, { threshold: 0.25 });
    observer.observe(board);
  } else if (animateSetup && !reduceMotion.matches) {
    playSetup();
  }
})();
