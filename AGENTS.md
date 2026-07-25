# Codex instructions for EvoLab

## Product goal
Build a polished browser-based evolutionary sandbox. The player designs an arena, releases a population of autonomous blobs, observes behavior, and breeds the strongest creatures into the next generation.

## MVP product promise
Within five generations, a non-technical player must visibly notice that the population is getting better at reaching food.

## Engineering rules
- Use React + TypeScript for application UI.
- Use Phaser for the simulation canvas and physics.
- Keep simulation logic deterministic when a seed is supplied.
- Keep React UI state and Phaser simulation state separated; communicate through the shared EventBus.
- Do not introduce a backend, login, database, LLM, RL training service, multiplayer, or paid API in MVP.
- Prefer small, testable modules over a single large scene file when extending the starter.
- Every task must leave `npm run build` passing.
- Add tests around genome crossover, mutation boundaries, scoring, and seeded evolution before changing those systems significantly.

## UX rules
- The arena is the visual focus.
- The player must always understand: current generation, objective, time remaining, selected tool, and next action.
- Disable world editing while a generation is running.
- Show visible feedback for food collection, death, and generation completion.
- Never expose neural-network terminology in the default player experience.

## Definition of done for a Codex task
1. Implement the requested behavior.
2. Run typecheck/build and relevant tests.
3. Manually verify the main flow in the browser when UI is changed.
4. Summarize changed files, decisions, commands run, and known limitations.
