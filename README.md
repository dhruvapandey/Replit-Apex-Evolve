# EvoLab MVP

A browser-based evolutionary sandbox where the player designs survival challenges and watches populations adapt across generations.

## Current vertical slice
- Place food, poison, walls, and predators.
- Spawn 20 autonomous creatures.
- Creatures sense nearby food and hazards.
- A simple genetic algorithm selects the top 20%, performs crossover, and mutates the next generation.
- Inspect creature traits and fitness.
- Run the simulation at 1×, 2×, or 5× speed.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Build

```bash
npm run build
```

## Optional player support

The release UI can show a voluntary-support panel with Stripe Payment Links and
an India UPI QR/deep link. Copy `.env.example` to `.env.local` and configure:

```bash
VITE_SUPPORT_ENABLED=true
VITE_STRIPE_DONATION_URL=https://donate.stripe.com/your-payment-link
VITE_UPI_ID=your-upi-id@bank
VITE_UPI_PAYEE_NAME=APEX EVOLVE
```

Only public checkout URLs and payment identifiers belong in Vite environment
variables. Never add a Stripe secret or restricted API key. Set
`VITE_SUPPORT_ENABLED=false` for distribution channels that prohibit external
payment links.

## Product docs
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/MILESTONES.md`
- `prompts/01-codex-bootstrap.md`

## Important MVP constraint
This starter uses an interpretable trait-based controller, not reinforcement learning. The genetic algorithm is the first product experiment. Neuroevolution can replace the controller only after the core loop is proven fun.
