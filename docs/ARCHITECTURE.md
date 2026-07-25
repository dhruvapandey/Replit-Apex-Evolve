# Architecture

## Stack
- Vite
- React
- TypeScript
- Phaser
- Local browser state only

## Responsibility split
### React
- Top bar and objective status.
- Environment toolbar.
- Simulation controls.
- Creature inspector and generation summary.
- Future menus, onboarding, settings, and saved experiments.

### Phaser
- Arena rendering.
- Pointer placement coordinates.
- Creature movement and physics.
- Food/hazard interactions.
- Population scoring and generation lifecycle.

### EventBus
A shared Phaser event emitter is the narrow integration layer. React sends player commands; Phaser publishes UI snapshots.

## Current controller
Each creature has bounded genes for:
- Food attraction.
- Poison avoidance.
- Predator avoidance.
- Wander tendency.
- Speed.
- Vision.
- Size.

A steering vector combines sensed targets and gene weights. This is intentionally simpler than a neural network so the first prototype is understandable and debuggable.

## Evolution pipeline
1. Simulate one generation.
2. Rank by fitness.
3. Keep top 20% as parent pool.
4. Randomly select two parents per child.
5. Inherit each gene from either parent.
6. Apply bounded mutation probabilistically.
7. Spawn the next generation.

## Recommended next refactor
Before adding more behavior, split `ArenaScene` into:
- `simulation/Genome.ts`
- `simulation/EvolutionEngine.ts`
- `simulation/CreatureController.ts`
- `simulation/Fitness.ts`
- `entities/Creature.ts`
- `entities/Predator.ts`
- `systems/ArenaEditor.ts`

Add a seeded PRNG at the same time so tests and replays are reproducible.
