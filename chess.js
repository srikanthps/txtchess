const FILES = 'abcdefgh';

function cloneBoard(board) {
  return board.map((r) => r.slice());
}

function isWhitePiece(p) {
  return p && p === p.toUpperCase();
}

function colorOfPiece(p) {
  return isWhitePiece(p) ? 'w' : 'b';
}

function squareToCoords(square) {
  const file = FILES.indexOf(square[0]);
  const rank = 8 - Number(square[1]);
  if (file < 0 || rank < 0 || rank > 7) return null;
  return { r: rank, c: file };
}

function coordsToSquare(r, c) {
  return `${FILES[c]}${8 - r}`;
}

function pieceValueForSan(piece) {
  const upper = piece.toUpperCase();
  return upper === 'P' ? '' : upper;
}

class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      Array(8).fill('p'),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill('P'),
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    this.turn = 'w';
    this.castling = { K: true, Q: true, k: true, q: true };
    this.enPassant = null;
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.history = [];
    this.repetition = new Map();
    this.pushRepetition();
  }

  clone() {
    const c = new ChessGame();
    c.board = cloneBoard(this.board);
    c.turn = this.turn;
    c.castling = { ...this.castling };
    c.enPassant = this.enPassant;
    c.halfmoveClock = this.halfmoveClock;
    c.fullmoveNumber = this.fullmoveNumber;
    c.history = this.history.map((h) => ({ ...h }));
    c.repetition = new Map(this.repetition);
    return c;
  }

  fenPositionKey() {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let row = '';
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) empty++;
        else {
          if (empty) row += empty;
          empty = 0;
          row += p;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    const rights = ['K', 'Q', 'k', 'q'].filter((k) => this.castling[k]).join('') || '-';
    return `${rows.join('/') } ${this.turn} ${rights} ${this.enPassant || '-'}`;
  }

  pushRepetition() {
    const key = this.fenPositionKey();
    this.repetition.set(key, (this.repetition.get(key) || 0) + 1);
  }

  inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  at(r, c) {
    return this.inBounds(r, c) ? this.board[r][c] : null;
  }

  isAttacked(square, byColor) {
    const { r, c } = squareToCoords(square);
    const pawnDir = byColor === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const p = this.at(r - pawnDir, c + dc);
      if (p && colorOfPiece(p) === byColor && p.toUpperCase() === 'P') return true;
    }
    const knightD = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightD) {
      const p = this.at(r + dr, c + dc);
      if (p && colorOfPiece(p) === byColor && p.toUpperCase() === 'N') return true;
    }
    const lines = [
      [[1,0],[-1,0],[0,1],[0,-1],['R','Q']],
      [[1,1],[1,-1],[-1,1],[-1,-1],['B','Q']]
    ];
    for (const [dirs, pieces] of lines.map((x) => [x.slice(0,4), x[4]])) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (this.inBounds(rr, cc)) {
          const p = this.at(rr, cc);
          if (p) {
            if (colorOfPiece(p) === byColor && pieces.includes(p.toUpperCase())) return true;
            break;
          }
          rr += dr;
          cc += dc;
        }
      }
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const p = this.at(r + dr, c + dc);
        if (p && colorOfPiece(p) === byColor && p.toUpperCase() === 'K') return true;
      }
    }
    return false;
  }

  kingSquare(color) {
    const target = color === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) if (this.board[r][c] === target) return coordsToSquare(r, c);
    }
    return null;
  }

  inCheck(color = this.turn) {
    const ksq = this.kingSquare(color);
    if (!ksq) return false;
    return this.isAttacked(ksq, color === 'w' ? 'b' : 'w');
  }

  pseudoMovesFrom(r, c) {
    const piece = this.at(r, c);
    if (!piece) return [];
    const color = colorOfPiece(piece);
    if (color !== this.turn) return [];
    const upper = piece.toUpperCase();
    const from = coordsToSquare(r, c);
    const moves = [];
    const add = (rr, cc, extra = {}) => {
      if (!this.inBounds(rr, cc)) return;
      const toPiece = this.at(rr, cc);
      if (toPiece && colorOfPiece(toPiece) === color) return;
      moves.push({ from, to: coordsToSquare(rr, cc), piece, capture: !!toPiece, ...extra });
    };

    if (upper === 'P') {
      const dir = color === 'w' ? -1 : 1;
      const startRank = color === 'w' ? 6 : 1;
      const promoRank = color === 'w' ? 0 : 7;
      const one = r + dir;
      if (this.inBounds(one, c) && !this.at(one, c)) {
        if (one === promoRank) {
          for (const p of ['q','r','b','n']) add(one, c, { promotion: p });
        } else {
          add(one, c);
          if (r === startRank && !this.at(r + 2 * dir, c)) add(r + 2 * dir, c, { twoStep: true });
        }
      }
      for (const dc of [-1, 1]) {
        const rr = r + dir;
        const cc = c + dc;
        if (!this.inBounds(rr, cc)) continue;
        const tp = this.at(rr, cc);
        if (tp && colorOfPiece(tp) !== color) {
          if (rr === promoRank) {
            for (const p of ['q','r','b','n']) add(rr, cc, { promotion: p, capture: true });
          } else add(rr, cc, { capture: true });
        }
      }
      if (this.enPassant) {
        const ep = squareToCoords(this.enPassant);
        if (ep.r === r + dir && Math.abs(ep.c - c) === 1) {
          moves.push({ from, to: this.enPassant, piece, capture: true, enPassant: true });
        }
      }
    } else if (upper === 'N') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr,c+dc);
    } else if (upper === 'B' || upper === 'R' || upper === 'Q') {
      const dirs = [];
      if (upper !== 'B') dirs.push([1,0],[-1,0],[0,1],[0,-1]);
      if (upper !== 'R') dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (this.inBounds(rr, cc)) {
          const tp = this.at(rr, cc);
          if (!tp) add(rr, cc);
          else {
            if (colorOfPiece(tp) !== color) add(rr, cc, { capture: true });
            break;
          }
          rr += dr; cc += dc;
        }
      }
    } else if (upper === 'K') {
      for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) if (dr||dc) add(r+dr,c+dc);
      const enemy = color === 'w' ? 'b' : 'w';
      if (!this.inCheck(color)) {
        if (color === 'w' && this.castling.K && !this.at(7,5) && !this.at(7,6) && !this.isAttacked('f1', enemy) && !this.isAttacked('g1', enemy)) {
          moves.push({ from, to: 'g1', piece, castle: 'K' });
        }
        if (color === 'w' && this.castling.Q && !this.at(7,1) && !this.at(7,2) && !this.at(7,3) && !this.isAttacked('d1', enemy) && !this.isAttacked('c1', enemy)) {
          moves.push({ from, to: 'c1', piece, castle: 'Q' });
        }
        if (color === 'b' && this.castling.k && !this.at(0,5) && !this.at(0,6) && !this.isAttacked('f8', enemy) && !this.isAttacked('g8', enemy)) {
          moves.push({ from, to: 'g8', piece, castle: 'k' });
        }
        if (color === 'b' && this.castling.q && !this.at(0,1) && !this.at(0,2) && !this.at(0,3) && !this.isAttacked('d8', enemy) && !this.isAttacked('c8', enemy)) {
          moves.push({ from, to: 'c8', piece, castle: 'q' });
        }
      }
    }
    return moves;
  }

  applyMove(move) {
    const { r: fr, c: fc } = squareToCoords(move.from);
    const { r: tr, c: tc } = squareToCoords(move.to);
    const piece = this.board[fr][fc];
    const color = colorOfPiece(piece);
    let captured = this.board[tr][tc] || null;

    this.board[fr][fc] = null;

    if (move.enPassant) {
      const capR = color === 'w' ? tr + 1 : tr - 1;
      captured = this.board[capR][tc];
      this.board[capR][tc] = null;
    }

    let placed = piece;
    if (move.promotion) placed = color === 'w' ? move.promotion.toUpperCase() : move.promotion;
    this.board[tr][tc] = placed;

    if (move.castle) {
      if (move.to === 'g1') { this.board[7][5] = this.board[7][7]; this.board[7][7] = null; }
      if (move.to === 'c1') { this.board[7][3] = this.board[7][0]; this.board[7][0] = null; }
      if (move.to === 'g8') { this.board[0][5] = this.board[0][7]; this.board[0][7] = null; }
      if (move.to === 'c8') { this.board[0][3] = this.board[0][0]; this.board[0][0] = null; }
    }

    if (piece === 'K') { this.castling.K = false; this.castling.Q = false; }
    if (piece === 'k') { this.castling.k = false; this.castling.q = false; }
    if (move.from === 'a1' || move.to === 'a1') this.castling.Q = false;
    if (move.from === 'h1' || move.to === 'h1') this.castling.K = false;
    if (move.from === 'a8' || move.to === 'a8') this.castling.q = false;
    if (move.from === 'h8' || move.to === 'h8') this.castling.k = false;

    this.enPassant = move.twoStep ? coordsToSquare((fr + tr) / 2, fc) : null;

    if (piece.toUpperCase() === 'P' || captured) this.halfmoveClock = 0;
    else this.halfmoveClock += 1;

    if (this.turn === 'b') this.fullmoveNumber += 1;
    this.turn = this.turn === 'w' ? 'b' : 'w';

    return { captured };
  }

  legalMoves() {
    const all = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.at(r, c);
        if (p && colorOfPiece(p) === this.turn) {
          for (const m of this.pseudoMovesFrom(r, c)) {
            const g = this.clone();
            g.applyMove(m);
            if (!g.inCheck(this.turn)) all.push(m);
          }
        }
      }
    }
    return all;
  }

  sanForMove(move, legalMoves = null) {
    if (move.castle) return move.to[0] === 'g' ? 'O-O' : 'O-O-O';
    const moves = legalMoves || this.legalMoves();
    const sameTargets = moves.filter((m) => m.to === move.to && m.piece === move.piece && m.from !== move.from);
    const from = squareToCoords(move.from);
    const needFile = sameTargets.some((m) => squareToCoords(m.from).c !== from.c);
    const needRank = sameTargets.some((m) => squareToCoords(m.from).r !== from.r);

    let san = pieceValueForSan(move.piece);
    if (move.piece.toUpperCase() === 'P' && move.capture) san += move.from[0];
    else if (sameTargets.length) {
      if (needFile) san += move.from[0];
      if (!needFile || needRank) san += move.from[1];
    }
    if (move.capture) san += 'x';
    san += move.to;
    if (move.promotion) san += `=${move.promotion.toUpperCase()}`;

    const g = this.clone();
    g.applyMove(move);
    const oppMoves = g.legalMoves();
    if (g.inCheck(g.turn)) san += oppMoves.length ? '+' : '#';
    return san;
  }

  parseMoveText(text) {
    const input = text.trim();
    const clean = input.replace(/[+#]$/,'').replace(/0-0-0/i,'O-O-O').replace(/0-0/i,'O-O');
    const legal = this.legalMoves();
    const uci = clean.match(/^([a-h][1-8])([a-h][1-8])([qrbnQRBN])?$/);
    if (uci) {
      const [, from, to, promo] = uci;
      return legal.find((m) => m.from === from && m.to === to && (!promo || m.promotion === promo.toLowerCase()));
    }
    return legal.find((m) => {
      const san = this.sanForMove(m, legal);
      return san.replace(/[+#]$/,'') === clean;
    });
  }

  suggestions(text) {
    const raw = (text || '').trim();
    const normalized = raw.replace(/[+#]$/,'').replace(/0-0-0/ig, 'O-O-O').replace(/0-0/ig, 'O-O');
    const legal = this.legalMoves();
    const ranked = [];

    for (const move of legal) {
      const san = this.sanForMove(move, legal);
      const sanClean = san.replace(/[+#]$/, '');
      const uci = `${move.from}${move.to}${move.promotion || ''}`;
      const sanPrefix = sanClean.toLowerCase().startsWith(normalized.toLowerCase());
      const uciPrefix = uci.toLowerCase().startsWith(raw.toLowerCase());
      if (!raw || sanPrefix || uciPrefix) {
        ranked.push({ move, san, sanClean, uci, score: sanClean.toLowerCase() === normalized.toLowerCase() || uci.toLowerCase() === raw.toLowerCase() ? 2 : 1 });
      }
    }

    ranked.sort((a, b) => b.score - a.score || a.sanClean.localeCompare(b.sanClean));

    return ranked.map(({ move, san, uci }) => ({
      san,
      uci,
      from: move.from,
      to: move.to,
      piece: move.piece,
      promotion: move.promotion || null,
      isExact: san.replace(/[+#]$/, '').toLowerCase() === normalized.toLowerCase() || uci.toLowerCase() === raw.toLowerCase()
    }));
  }

  move(text) {
    const move = this.parseMoveText(text);
    if (!move) return null;
    const san = this.sanForMove(move);
    const applied = this.applyMove(move);
    this.history.push({ ...move, san, captured: applied.captured });
    this.pushRepetition();
    return { ...move, san };
  }

  status() {
    const legal = this.legalMoves();
    const check = this.inCheck(this.turn);
    const threefold = [...this.repetition.values()].some((v) => v >= 3);
    let result = null;
    if (!legal.length) result = check ? (this.turn === 'w' ? 'black_wins_checkmate' : 'white_wins_checkmate') : 'draw_stalemate';
    else if (threefold) result = 'draw_threefold_repetition';
    else if (this.halfmoveClock >= 100) result = 'draw_fifty_move_rule';
    return { check, result, turn: this.turn, threefold };
  }

  boardString() {
    return this.board.map((r) => r.map((p) => p || '.').join(' ')).join('\n');
  }
}

module.exports = { ChessGame };
