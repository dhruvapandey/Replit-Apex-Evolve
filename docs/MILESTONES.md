# MVP milestones

## M0 — Running shell
**Exit condition:** Responsive React shell renders the Phaser arena and `npm run build` passes.

## M1 — Food evolution vertical slice
**Exit condition:** Across repeated generations, median food collected improves in a fixed seeded arena. Player can inspect the best creature.

Tasks:
- Seeded random number generator.
- Unit tests for crossover and mutation bounds.
- Fixed benchmark arena.
- Comparison chart: generation 1 vs current generation.
- Visible creature trails.

## M2 — Player-created experiments
**Exit condition:** Player can place food, poison, and walls, then run and reset experiments without state bugs.

Tasks:
- Drag-to-draw walls.
- Eraser/select/move tools.
- Object limits and clear feedback.
- Undo/redo for editor actions.

## M3 — Predator and emergent interactions
**Exit condition:** Predator creates meaningful selection pressure; poison damages predators so environmental strategies are physically possible.

Tasks:
- Predator health and collision rules.
- Push force for creatures and predator.
- Fitness does not directly reward a hard-coded “push predator” action.
- Highlight detector for unusual predator deaths.

## M4 — Fun and onboarding
**Exit condition:** Five external players complete the tutorial without explanation and at least three intentionally escalate the arena.

Tasks:
- Four short tutorial experiments.
- Better visual/audio feedback.
- Generation recap and best-run replay.
- Basic local save.

## Not before M4
- Neural-network controller.
- Community arenas.
- Accounts/backend.
- Mobile packaging.
