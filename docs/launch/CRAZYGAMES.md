# CrazyGames submission

Run:

```bash
npm run package:crazygames
```

Upload `release/crazygames/apex-evolve-crazygames.zip` in the CrazyGames Developer Portal. The
portal build uses relative asset paths, initializes the HTML5 v3 SDK, reports loading,
gameplay start/stop and ten-wave completion, respects the platform mute setting, and requests
midgame ads only on a game-over break after at least three minutes and three rounds.

The CrazyGames build intentionally removes Stripe, UPI and GA4. It remains playable when ads are
disabled, unfilled, or blocked.

Submission metadata:

- Type: HTML5 / desktop / landscape
- Engine: Three.js + React
- Controls: keyboard and mouse
- Multiplayer: no (the 1 × 1 mode is an AI duel)
- Content rating target: PEGI 12
