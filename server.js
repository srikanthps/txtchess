const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { ChessGame } = require('./chess');

const games = new Map();

function getGame(id) {
  if (!games.has(id)) {
    games.set(id, { engine: new ChessGame(), clients: new Map(), nextClientId: 1, roles: { w: null, b: null } });
  }
  return games.get(id);
}

function assignRole(game, clientId) {
  if (!game.roles.w) game.roles.w = clientId;
  else if (!game.roles.b) game.roles.b = clientId;
}

function roleOf(game, clientId) {
  if (game.roles.w === clientId) return 'w';
  if (game.roles.b === clientId) return 'b';
  return 'spectator';
}

function gameState(game, clientId) {
  return {
    role: roleOf(game, clientId),
    board: game.engine.board,
    boardText: game.engine.boardString(),
    turn: game.engine.turn,
    history: game.engine.history,
    status: game.engine.status()
  };
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) return json(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/') return serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html; charset=utf-8');
  if (pathname === '/app.js') return serveFile(res, path.join(__dirname, 'public', 'app.js'), 'application/javascript; charset=utf-8');
  if (pathname === '/style.css') return serveFile(res, path.join(__dirname, 'public', 'style.css'), 'text/css; charset=utf-8');

  if (pathname === '/api/create' && req.method === 'POST') {
    const id = crypto.randomBytes(4).toString('hex');
    getGame(id);
    return json(res, 200, { gameId: id, url: `/game/${id}` });
  }

  const join = pathname.match(/^\/api\/game\/([a-f0-9]+)\/join$/);
  if (join && req.method === 'POST') {
    const game = getGame(join[1]);
    const clientId = String(game.nextClientId++);
    game.clients.set(clientId, { lastSeenMove: game.engine.history.length });
    assignRole(game, clientId);
    return json(res, 200, { clientId, ...gameState(game, clientId) });
  }

  const poll = pathname.match(/^\/api\/game\/([a-f0-9]+)\/state$/);
  if (poll && req.method === 'GET') {
    const game = getGame(poll[1]);
    const clientId = url.searchParams.get('clientId');
    if (!clientId || !game.clients.has(clientId)) return json(res, 400, { error: 'Unknown client' });
    return json(res, 200, gameState(game, clientId));
  }


  const suggest = pathname.match(/^\/api\/game\/([a-f0-9]+)\/suggest$/);
  if (suggest && req.method === 'GET') {
    const game = getGame(suggest[1]);
    const clientId = url.searchParams.get('clientId');
    const text = url.searchParams.get('text') || '';
    if (!clientId || !game.clients.has(clientId)) return json(res, 400, { error: 'Unknown client' });
    const role = roleOf(game, clientId);
    if (['w', 'b'].includes(role) && game.engine.turn !== role) return json(res, 200, { suggestions: [] });
    if (game.engine.status().result) return json(res, 200, { suggestions: [] });
    return json(res, 200, { suggestions: game.engine.suggestions(text) });
  }

  const move = pathname.match(/^\/api\/game\/([a-f0-9]+)\/move$/);
  if (move && req.method === 'POST') {
    const game = getGame(move[1]);
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const { clientId, notation } = parsed;
        if (!clientId || !game.clients.has(clientId)) return json(res, 400, { error: 'Unknown client' });
        const role = roleOf(game, clientId);
        if (!['w','b'].includes(role)) return json(res, 403, { error: 'Spectators cannot move' });
        if (game.engine.turn !== role) return json(res, 400, { error: 'Not your turn' });
        if (game.engine.status().result) return json(res, 400, { error: 'Game is over' });
        const moved = game.engine.move(notation || '');
        if (!moved) return json(res, 400, { error: 'Illegal move or notation not understood' });
        return json(res, 200, { ok: true, move: moved, ...gameState(game, clientId) });
      } catch {
        return json(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (/^\/game\/[a-f0-9]+$/.test(pathname)) return serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html; charset=utf-8');

  json(res, 404, { error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`txtchess running on http://localhost:${PORT}`);
});
