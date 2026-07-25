# APEX EVOLVE analytics

The direct web and itch builds support consent-gated GA4 analytics. CrazyGames uses its own SDK
analytics, and the Steam build does not load web analytics.

## Configuration

Set `VITE_GA_MEASUREMENT_ID` to the GA4 web stream ID before building or deploying. No Google tag
is downloaded until the player chooses **Allow Analytics**.

## Measurement map

| Question | Events and fields |
| --- | --- |
| Completion rate | `level_start` compared with `level_end`; `success` distinguishes clears from deaths |
| Repeat sessions | GA4 returning users plus `game_session_start.local_session_number` |
| Preferred game mode | `level_start.game_mode` and `select_content` with `content_type=combat_mode` |
| Preferred arena | `level_start.arena_id` and `select_content` with `content_type=combat_arena` |
| Difficulty/drop-off | `game_session_end.wave_reached`, score, play time and mode |

Create GA4 event-scoped custom dimensions for `game_mode` and `arena_id`, and custom metrics for
`wave_reached`, `score`, and `play_time_seconds`. Mark a successful `level_end` as a key event if
first-wave completion is the launch KPI.

## Mobile decision report

After seven full days and at least 200 consenting sessions, compare:

- returning players divided by total players;
- successful `level_end` events for level 1 divided by level 1 starts;
- `game_session_end` events with `wave_reached >= 3` divided by game sessions;
- game-session starts grouped by `game_mode`;
- play-time distribution and deaths grouped by arena.

Use the retention gate in `docs/launch/README.md`. Do not begin mobile work from page-view traffic
alone; the decision should be based on completed gameplay sessions.
