# APEX EVOLVE launch sequence

## Release order

1. Deploy the direct web build and verify the analytics consent flow.
2. Publish the itch.io HTML5 beta on the same day and let itch handle optional donations.
3. Submit the dedicated CrazyGames package for Basic Launch evaluation. Monetization begins only
   if CrazyGames selects the game for Full Launch.
4. Use the first web cohort to tune balance, onboarding, and loading performance.
5. Finish the premium content scope and upload signed desktop builds to a private Steam branch.
6. Start mobile development only after the retention gate below is met.

## Web retention gate for mobile

Evaluate this only after at least 200 consenting game sessions and seven full days of data:

- at least 25% of players return for another session;
- 35–70% of started runs clear the first round (hard, but not immediately punishing);
- at least 15% of runs reach round three;
- no game mode accounts for less than 15% of started runs without a clear product reason;
- crash-free sessions and input failures are reviewed before mobile work starts.

These are launch decision thresholds, not promises. Revisit them after the first 1,000 sessions.

## Artifacts

| Target | Command | Output |
| --- | --- | --- |
| itch.io | `npm run package:itch` | `release/itch/apex-evolve-beta.zip` |
| CrazyGames | `npm run package:crazygames` | `release/crazygames/apex-evolve-crazygames.zip` |
| Steam/macOS local candidate | `npm run package:steam:dir` | `release/steam/mac-arm64/APEX EVOLVE.app` |
| Desktop CI | Push a `v*` tag or run the workflow manually | GitHub Actions artifacts |

Read `ANALYTICS.md`, `ITCH.md`, `CRAZYGAMES.md`, and `STEAM.md` before each submission.
