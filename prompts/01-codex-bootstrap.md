# First Codex task

You are working in the EvoLab repository. Read `AGENTS.md`, `README.md`, and every document in `docs/` before editing code.

## Objective
Turn the existing starter into a reliable M1 food-evolution vertical slice where behavioral improvement is measurable and visible.

## Required work
1. Install dependencies and run the current app and build.
2. Fix all compile/runtime issues you find without changing the product scope.
3. Refactor the genetic algorithm out of `ArenaScene.ts` into testable modules.
4. Add a small seeded PRNG so a benchmark experiment is reproducible.
5. Add automated tests for:
   - Crossover chooses bounded parent gene values.
   - Mutation never exceeds gene bounds.
   - Selection uses the strongest fitness group.
   - A fixed benchmark run does not regress below generation-one median fitness after five generations.
6. Add visible movement trails that can be toggled from the UI.
7. Add a compact “Generation 1 vs current” comparison in the inspector or generation summary.
8. Preserve the current UI direction and keep the arena as the visual focus.

## Constraints
- No backend, authentication, database, multiplayer, LLM, reinforcement-learning library, or external paid service.
- Do not add features outside M1.
- Do not hide failures by weakening tests; document stochastic limitations and use the seeded benchmark.
- Keep build and tests fast enough for local iteration.

## Stopping condition
Stop only when:
- The app runs locally.
- Typecheck/build and all tests pass.
- The fixed benchmark demonstrates visible or measured improvement by generation five.
- You have manually tested the full flow: place food → start → inspect → finish → evolve → repeat.

## Final response
Report:
- What you changed.
- Files added or changed.
- Commands and tests run.
- Benchmark results by generation.
- Known limitations and the next smallest task.
