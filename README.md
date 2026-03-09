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

## Run locally

### Prerequisites

- Node.js 18+ (Node 20+ recommended)

### Start the app

```bash
npm start
```

Or:

```bash
node server.js
```

Then open:

- `http://localhost:3000`

### How to play

1. Click **Create new shared game URL**.
2. Copy the generated URL and send it to another player.
3. Enter moves using text notation:
   - SAN examples: `e4`, `Nf3`, `O-O`, `Qh4#`
   - Coordinate examples: `e2e4`, `e7e8q`

## Host for free (recommended: Render)

You can deploy this app on Render's free tier in a few minutes.

1. Push this repository to GitHub.
2. Go to [https://render.com](https://render.com) and create an account.
3. Click **New +** → **Web Service**.
4. Connect your GitHub repo.
5. Use these settings:
   - **Runtime**: Node
   - **Build command**: *(leave empty)*
   - **Start command**: `npm start`
6. Deploy.

Render will provide a public URL like:

- `https://your-app-name.onrender.com`

Share that URL with players.

> Important: game state is in memory, so free-tier service restarts will reset active games.

## Alternative free options

- **Railway**: deploy from GitHub with start command `npm start`.
- **Fly.io**: works too, but setup is slightly more involved.

## Notes

- Game state is stored in memory, so restarting the server resets all games.
- No external npm dependencies are required.
