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
const errorEl = document.getElementById('error');

let gameId = null;
let clientId = null;

const pieceMap = { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙', k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };

function render(state) {
  roleEl.textContent = state.role === 'w' ? 'White' : state.role === 'b' ? 'Black' : 'Spectator';
  turnEl.textContent = state.turn === 'w' ? 'White' : 'Black';
  statusEl.textContent = state.status.result || (state.status.check ? 'Check!' : 'In progress');

  const isBlackPerspective = state.role === 'b';
  const files = isBlackPerspective
    ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
    : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = isBlackPerspective
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];

  let out = `  ${files.join(' ')}\n`;
  for (let r = 0; r < 8; r++) {
    const boardRow = isBlackPerspective ? 7 - r : r;
    out += `${ranks[r]} `;
    for (let c = 0; c < 8; c++) {
      const boardCol = isBlackPerspective ? 7 - c : c;
      const p = state.board[boardRow][boardCol];
      out += `${p ? pieceMap[p] : '·'} `;
    }
    out += `${ranks[r]}\n`;
  }
  out += `  ${files.join(' ')}`;
  boardEl.textContent = out;

  historyEl.innerHTML = '';
  state.history.forEach((m) => {
    const li = document.createElement('li');
    li.textContent = m.san;
    historyEl.appendChild(li);
  });

  const myTurn = (state.role === state.turn);
  notationInput.disabled = !myTurn || !!state.status.result;
  moveForm.querySelector('button').disabled = notationInput.disabled;
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
  render(data);
});

const match = location.pathname.match(/^\/game\/([a-f0-9]+)$/);
if (match) joinGame(match[1]);
