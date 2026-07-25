# APEX EVOLVE

APEX EVOLVE is a desktop-first tactical tank combat game built with React, TypeScript, Three.js,
and Vite. Play Evolution War against six genetically evolving specialists or enter a 1 × 1 duel
against a rival whose arsenal escalates every round.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The game requires a keyboard and mouse.

## Validate

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Distribution builds

Each target is compiled with a separate integration policy:

```bash
npm run package:itch
npm run package:crazygames
npm run package:steam:dir
```

- Direct web: optional Stripe/UPI support and consent-gated GA4.
- itch.io: consent-gated GA4; itch handles donations on the game page.
- CrazyGames: CrazyGames HTML5 v3 SDK; no external funding or Google Analytics.
- Steam: offline Electron desktop package; no ads, web analytics, or external funding.

Release instructions are in [`docs/launch`](docs/launch).

## Optional direct-web support

Copy `.env.example` to `.env.local` and set only public checkout details:

```bash
VITE_SUPPORT_ENABLED=true
VITE_STRIPE_DONATION_URL=https://donate.stripe.com/your-payment-link
VITE_UPI_ID=your-upi-id@bank
VITE_UPI_PAYEE_NAME=APEX EVOLVE
```

Never put a Stripe secret key in a Vite environment variable.

## Optional analytics

Set a GA4 web-stream measurement ID:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

The Google tag is not downloaded until the player explicitly allows anonymous analytics.
