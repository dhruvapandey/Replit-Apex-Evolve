export const MORTAR_DIRECT_RADIUS = 1.2;
export const MORTAR_SPLASH_RADIUS = 5.85;
export const WOUNDED_SPEED_MULTIPLIER = 0.55;
export const PLAYER_CANNON_FIRE_RATE_MULTIPLIER = 1.3;
export const PLAYER_CANNON_FIRE_INTERVAL = 0.28 / PLAYER_CANNON_FIRE_RATE_MULTIPLIER;
export const PLAYER_GENERATION_FIRE_RATE_GAIN = 0.1;
export const ENEMY_GENERATION_FIRE_RATE_GAIN = 0.05;
export const PLAYER_GENERATION_FIRE_RATE_CAP = 4;
export const ENEMY_GENERATION_FIRE_RATE_CAP = 2.5;
export const PLAYER_MORTAR_GENERATION_POWER_GAIN = 0.2;
export const PLAYER_MORTAR_GENERATION_POWER_CAP = 2;
export const MORTAR_RANGE_MULTIPLIER = 1.3;
// Retains the original 108-unit arena coverage, plus the requested 30% reserve.
export const MORTAR_MAX_RANGE = 108 * MORTAR_RANGE_MULTIPLIER;
export const MORTAR_BURST_SIZE = 3;
export const MORTAR_BURST_INTERVAL = 0.16;
const MORTAR_TACTICAL_DEAD_ZONE = 0.18;

function generationFireRateMultiplier(generation: number, gain: number, cap: number) {
  const completedGenerations = Math.max(0, Math.floor(generation) - 1);
  // Add a fixed percentage of the generation-one rate each round. This keeps
  // progression visible through long runs without exponential bullet spam.
  return Math.min(cap, 1 + gain * completedGenerations);
}

export function playerFireRateMultiplierForGeneration(generation: number) {
  return generationFireRateMultiplier(
    generation,
    PLAYER_GENERATION_FIRE_RATE_GAIN,
    PLAYER_GENERATION_FIRE_RATE_CAP,
  );
}

export function enemyFireRateMultiplierForGeneration(generation: number) {
  return generationFireRateMultiplier(
    generation,
    ENEMY_GENERATION_FIRE_RATE_GAIN,
    ENEMY_GENERATION_FIRE_RATE_CAP,
  );
}

export function playerMortarPowerForGeneration(generation: number) {
  return generationFireRateMultiplier(
    generation,
    PLAYER_MORTAR_GENERATION_POWER_GAIN,
    PLAYER_MORTAR_GENERATION_POWER_CAP,
  );
}

export function playerCannonFireIntervalForGeneration(generation: number) {
  return PLAYER_CANNON_FIRE_INTERVAL / playerFireRateMultiplierForGeneration(generation);
}

export function enemyCannonCooldownForGeneration(baseCooldown: number, generation: number) {
  return Math.max(0, baseCooldown) / enemyFireRateMultiplierForGeneration(generation);
}

export function mortarBlastDamage(distance: number, blockedByCover: boolean) {
  if (blockedByCover) return 0;
  if (distance <= MORTAR_DIRECT_RADIUS) return 2;
  if (distance <= MORTAR_SPLASH_RADIUS) return 1;
  return 0;
}

export function mortarBurstCount(ammo: number) {
  return Math.min(MORTAR_BURST_SIZE, Math.max(0, Math.floor(ammo)));
}

export function mortarFlightDuration(distance: number) {
  const boundedDistance = Math.min(MORTAR_MAX_RANGE, Math.max(0, distance));
  return Math.min(5.5, Math.max(0.78, 0.72 + boundedDistance / 80));
}

export function mortarLaunchSpeed(
  maximumRange: number,
  launchHeight = 0,
  gravity = 22,
) {
  const range = Math.max(0, maximumRange);
  if (range === 0) return 0;
  return Math.sqrt((gravity * range * range) / (range + Math.max(0, launchHeight)));
}

export function mortarRangeForElevation(
  elevationRadians: number,
  maximumRange: number,
  launchHeight = 0,
  gravity = 22,
) {
  const elevation = Math.min(Math.PI / 2, Math.max(0, elevationRadians));
  const speed = mortarLaunchSpeed(maximumRange, launchHeight, gravity);
  const verticalSpeed = speed * Math.sin(elevation);
  const horizontalSpeed = speed * Math.cos(elevation);
  const flightTime = gravity > 0
    ? (verticalSpeed + Math.sqrt(verticalSpeed * verticalSpeed + 2 * gravity * Math.max(0, launchHeight))) / gravity
    : 0;
  const distance = Math.min(maximumRange, horizontalSpeed * flightTime * MORTAR_RANGE_MULTIPLIER);
  return Math.abs(distance) < 0.0001 ? 0 : distance;
}

export function mortarAimDistance(
  groundDistance: number | null,
  maximumRange = MORTAR_MAX_RANGE,
) {
  if (groundDistance === null || !Number.isFinite(groundDistance)) return maximumRange;
  return Math.min(maximumRange, Math.max(0, groundDistance));
}

export function mortarTacticalDistance(
  pointerX: number,
  pointerY: number,
  groundDistance: number,
  maximumRange = MORTAR_MAX_RANGE,
) {
  const edgeStrength = Math.min(1, Math.max(Math.abs(pointerX), Math.abs(pointerY)));
  const normalized = Math.min(
    1,
    Math.max(0, (edgeStrength - MORTAR_TACTICAL_DEAD_ZONE) / (1 - MORTAR_TACTICAL_DEAD_ZONE)),
  );
  const eased = normalized * normalized * (3 - 2 * normalized);
  return mortarAimDistance(Math.max(groundDistance, maximumRange * eased), maximumRange);
}

export function mortarTargetInsideArena(
  originX: number,
  originZ: number,
  offsetX: number,
  offsetZ: number,
  arenaHalfSize: number,
) {
  const targetX = Math.min(arenaHalfSize, Math.max(-arenaHalfSize, originX + offsetX));
  const targetZ = Math.min(arenaHalfSize, Math.max(-arenaHalfSize, originZ + offsetZ));
  return { x: targetX - originX, z: targetZ - originZ };
}

export function mortarDistanceToArenaEdge(
  originX: number,
  originZ: number,
  directionX: number,
  directionZ: number,
  arenaHalfSize: number,
) {
  const directionLength = Math.hypot(directionX, directionZ);
  if (directionLength === 0) return 0;
  const x = directionX / directionLength;
  const z = directionZ / directionLength;
  const distances = [
    x > 0 ? (arenaHalfSize - originX) / x : x < 0 ? (-arenaHalfSize - originX) / x : Infinity,
    z > 0 ? (arenaHalfSize - originZ) / z : z < 0 ? (-arenaHalfSize - originZ) / z : Infinity,
  ].filter((distance) => distance >= 0);
  return Math.min(...distances);
}
