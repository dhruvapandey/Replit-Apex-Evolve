# EvoLab MVP — Product Requirements Document

## One-line pitch
Build the world. Evolution finds the loophole.

## Player fantasy
The player is an invisible researcher managing a 2D terrarium. They create a problem, release a population, observe what survives, and make the experiment harder.

## Target player
- Curious casual players who enjoy sandbox and simulation games.
- Players who like digital pets, emergent systems, and shareable unexpected moments.
- No knowledge of AI or genetics required.

## Core loop
1. **Design** — Place food, poison, walls, and eventually a predator.
2. **Release** — Start a 20-second generation of 20 autonomous blobs.
3. **Observe** — Watch paths, deaths, discoveries, and the best specimen.
4. **Evolve** — Breed the strongest 20% with mutation.
5. **Escalate** — Make the arena harder and repeat.

## MVP objective
Prove that players enjoy watching visible adaptation and want to escalate the arena.

## MVP success criteria
- A first-time player starts generation one within 30 seconds.
- The player notices measurable behavioral improvement by generation five.
- The player voluntarily changes the arena after a successful generation.
- A full experiment can be completed in under ten minutes.

## Required features
### Arena editor
- Select and place food, poison, fixed-size walls, and one or more predators.
- Reset the experiment.
- Editing disabled while simulation runs.

### Population simulation
- 20 creatures per generation.
- Creature sensors: food, poison, predator, walls/world boundary.
- Creature outputs: movement direction and speed.
- 20-second generation timer with 1×, 2×, and 5× speed.

### Evolution
- Fitness rewards food and survival.
- Fitness penalizes poison/predator death.
- Top 20% selected as parents.
- Crossover plus bounded mutation creates 20 children.
- Preserve generation number and summary.

### Observation
- Click a creature to inspect fitness, food eaten, age, state, genes, and descriptive traits.
- Generation summary identifies best creature.

## Explicitly out of scope
- Reinforcement learning service.
- Back end, accounts, cloud saves, payments.
- Multiplayer and community arenas.
- Mobile-native build.
- Complex combat, reproduction animation, family tree, species collection.
- Procedural art pipeline and final audio.

## Primary risks
1. **Improvement is not visible.** Add trails, replays, comparison metrics, and stronger early selection pressure.
2. **Watching becomes passive.** Add limited interventions only after the baseline loop is proven.
3. **Behavior feels fake.** Keep rules consistent and make genes/fitness inspectable.
4. **Emergence is overpromised.** Market “unexpected strategies” only when the physics genuinely permit them.
