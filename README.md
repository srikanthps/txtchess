# TxtChess

A lightweight multiplayer chess app where moves are entered using **text notation** instead of mouse dragging.

## Features

- Create a game and share a URL (`/game/<id>`) with another player.
- First joiner is White, second joiner is Black, additional joiners are spectators.
- Enter moves using SAN (`Nf3`, `O-O`, `Qh4#`) or coordinate notation (`e2e4`, `e7e8q`).
- Full move legality checks:
  - illegal moves are rejected,
  - check and checkmate are detected,
  - stalemate is detected,
  - threefold repetition draw is detected,
  - fifty-move rule draw is detected.

## Run

```bash
node server.js
```

Then open `http://localhost:3000`.

## Notes

- Game state is stored in memory, so restarting the server resets all games.
- No external npm dependencies are required.
