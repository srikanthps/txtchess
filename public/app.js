const createBtn = document.getElementById('createBtn');
const share = document.getElementById('share');
const lobby = document.getElementById('lobby');
const gameSection = document.getElementById('game');
const roleEl = document.getElementById('role');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const historyEl = document.getElementById('history');
const moveForm = document.getElementById('moveForm');
const notationInput = document.getElementById('notation');
const suggestionsList = document.getElementById('suggestions');
const previewEl = document.getElementById('preview');
const errorEl = document.getElementById('error');

let gameId = null;
let clientId = null;
let suggestController = null;
let latestState = null;
let previewMove = null;

const pieceMap = { K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟', k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };

function getPieceColor(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'white' : 'black';
}

function render(state) {
  latestState = state;
  roleEl.textContent = state.role === 'w' ? 'White' : state.role === 'b' ? 'Black' : 'Spectator';
  turnEl.textContent = state.turn === 'w' ? 'White' : 'Black';
  statusEl.textContent = state.status.result || (state.status.check ? 'Check!' : 'In progress');

  const perspective = state.role === 'spectator' ? state.turn : state.role;
  const isBlackPerspective = perspective === 'b';
  const files = isBlackPerspective
    ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
    : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = isBlackPerspective
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];

  const lastMove = state.history[state.history.length - 1] || null;
  const renderSquare = (file, rank, symbol, pieceColor, previewPiece, previewPieceColor) => {
    const boardCol = file.charCodeAt(0) - 97;
    const square = `${file}${rank}`;
    const isLightSquare = (boardCol + rank) % 2 === 0;
    const classes = ['square', isLightSquare ? 'light' : 'dark'];
    if (lastMove?.from === square) classes.push('last-move-from');
    if (lastMove?.to === square) classes.push('last-move-to');
    const effectivePieceColor = previewPiece ? previewPieceColor : pieceColor;
    if (effectivePieceColor) classes.push(`piece-${effectivePieceColor}`);
    if (previewPiece) classes.push('preview-piece');
    return `<span class="${classes.join(' ')}">${previewPiece || symbol}</span>`;
  };

  let out = `  ${files.join(' ')}\n`;
  for (let r = 0; r < 8; r++) {
    const rank = ranks[r];
    const boardRow = 8 - rank;
    out += `${rank} `;
    for (let c = 0; c < 8; c++) {
      const file = files[c];
      const boardCol = file.charCodeAt(0) - 97;
      const square = `${file}${rank}`;
      const p = state.board[boardRow][boardCol];
      const symbol = p ? pieceMap[p] : ' ';
      const pieceColor = getPieceColor(p);
      if (previewMove && previewMove.to === square) {
        const previewPiece = pieceMap[previewMove.piece] || symbol;
        const previewPieceColor = getPieceColor(previewMove.piece) || pieceColor;
        out += `${renderSquare(file, rank, symbol, pieceColor, previewPiece, previewPieceColor)}`;
      } else {
        out += `${renderSquare(file, rank, symbol, pieceColor)}`;
      }
    }
    out += `${rank}\n`;
  }
  out += `  ${files.join(' ')}`;
  boardEl.innerHTML = out;

  historyEl.innerHTML = '';
  state.history.forEach((m) => {
    const li = document.createElement('li');
    li.textContent = m.san;
    historyEl.appendChild(li);
  });

  const myTurn = (state.role === state.turn);
  notationInput.disabled = !myTurn || !!state.status.result;
  moveForm.querySelector('button').disabled = notationInput.disabled;
  if (!myTurn || state.status.result) {
    previewMove = null;
    previewEl.textContent = '';
    suggestionsList.innerHTML = '';
  }
}

async function joinGame(id) {
  const res = await fetch(`/api/game/${id}/join`, { method: 'POST' });
  const data = await res.json();
  gameId = id;
  clientId = data.clientId;
  lobby.classList.add('hidden');
  gameSection.classList.remove('hidden');
  render(data);
  setInterval(pollState, 1500);
}

async function pollState() {
  if (!gameId || !clientId) return;
  const res = await fetch(`/api/game/${gameId}/state?clientId=${encodeURIComponent(clientId)}`);
  if (!res.ok) return;
  const data = await res.json();
  render(data);
}

createBtn.addEventListener('click', async () => {
  const res = await fetch('/api/create', { method: 'POST' });
  const data = await res.json();
  const full = `${location.origin}${data.url}`;
  share.innerHTML = `Share URL: <a href="${data.url}">${full}</a>`;
  history.replaceState({}, '', data.url);
  joinGame(data.gameId);
});

moveForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const notation = notationInput.value.trim();
  if (!notation) return;
  const res = await fetch(`/api/game/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, notation })
  });
  const data = await res.json();
  if (!res.ok) {
    errorEl.textContent = data.error || 'Move failed';
    return;
  }
  notationInput.value = '';
  previewMove = null;
  previewEl.textContent = '';
  suggestionsList.innerHTML = '';
  render(data);
});

notationInput.addEventListener('input', async () => {
  if (!gameId || !clientId || notationInput.disabled) return;

  const text = notationInput.value.trim();
  if (!text) {
    previewMove = null;
    if (latestState) render(latestState);
    previewEl.textContent = '';
    suggestionsList.innerHTML = '';
    return;
  }

  if (suggestController) suggestController.abort();
  suggestController = new AbortController();

  try {
    const params = new URLSearchParams({ clientId, text });
    const res = await fetch(`/api/game/${gameId}/suggest?${params.toString()}`, { signal: suggestController.signal });
    if (!res.ok) return;
    const data = await res.json();

    suggestionsList.innerHTML = '';
    data.suggestions.slice(0, 8).forEach((s) => {
      const option = document.createElement('option');
      option.value = s.san;
      option.label = `${s.san} (${s.uci})`;
      suggestionsList.appendChild(option);
    });

    if (!data.suggestions.length) {
      previewMove = null;
      if (latestState) render(latestState);
      previewEl.textContent = 'No legal moves match this text yet.';
      return;
    }

    const best = data.suggestions[0];
    previewMove = { to: best.to, piece: best.piece };
    if (latestState) render(latestState);
    const piece = pieceMap[best.piece] || best.piece;
    const action = best.isExact ? 'Ready:' : 'Try:';
    previewEl.textContent = `${action} ${best.san} (${best.uci}) — ${piece} from ${best.from} to ${best.to}. Press Enter to confirm.`;
    if (data.suggestions.length === 1 && !best.isExact && best.san.toLowerCase().startsWith(text.toLowerCase())) {
      notationInput.value = best.san;
      notationInput.setSelectionRange(text.length, best.san.length);
    }
  } catch (err) {
    if (err.name !== 'AbortError') previewEl.textContent = 'Could not load move suggestions.';
  }
});

const match = location.pathname.match(/^\/game\/([a-f0-9]+)$/);
if (match) joinGame(match[1]);
