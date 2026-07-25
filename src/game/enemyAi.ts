import type { ArenaBounds } from './arenas';

export const DEPLOYMENT_SECONDS = 3;
export const ENEMY_MORTAR_RADIUS = 3.25;
export const ENEMY_MORTAR_WARNING_SECONDS = 0.9;
export const ENEMY_MORTAR_MIN_COOLDOWN = 7;
export const ENEMY_MORTAR_MAX_COOLDOWN = 9;
export const ENEMY_MEMORY_SECONDS = 2.5;
export const ENEMY_STARTING_POWER = 1.8;
export const ENEMY_MORTAR_FREQUENCY_MULTIPLIER = 0.5;
export const ENEMY_CANNON_MAX_RANGE = 112;

export const ENEMY_ROLES = [
  'marksman',
  'sprinter',
  'dodger',
  'navigator',
  'artillery',
  'interceptor',
] as const;

export type EnemyRole = typeof ENEMY_ROLES[number];
export type EnemyWeapon = 'cannon' | 'mortar';

export type SpecialistProfile = {
  speed: number;
  accuracy: number;
  fireInterval: number;
  aggression: number;
  predictionLead: number;
  projectileSpeed: number;
  coverDiscipline: number;
  evasion: number;
  navigation: number;
};

const BASE_PROFILES: Record<EnemyRole, SpecialistProfile> = {
  marksman: { speed: 2.7, accuracy: 0.66, fireInterval: 2.25, aggression: 0.52, predictionLead: 0.72, projectileSpeed: 23, coverDiscipline: 0.78, evasion: 0.28, navigation: 0.45 },
  sprinter: { speed: 4.5, accuracy: 0.34, fireInterval: 1.75, aggression: 0.9, predictionLead: 0.34, projectileSpeed: 19, coverDiscipline: 0.38, evasion: 0.56, navigation: 0.58 },
  dodger: { speed: 3.55, accuracy: 0.42, fireInterval: 2, aggression: 0.72, predictionLead: 0.42, projectileSpeed: 18, coverDiscipline: 0.62, evasion: 0.9, navigation: 0.7 },
  navigator: { speed: 3.25, accuracy: 0.47, fireInterval: 1.9, aggression: 0.7, predictionLead: 0.5, projectileSpeed: 20, coverDiscipline: 0.68, evasion: 0.52, navigation: 0.92 },
  artillery: { speed: 2.65, accuracy: 0.4, fireInterval: 2.5, aggression: 0.46, predictionLead: 0.85, projectileSpeed: 18, coverDiscipline: 0.9, evasion: 0.22, navigation: 0.5 },
  interceptor: { speed: 3.7, accuracy: 0.55, fireInterval: 1.85, aggression: 0.82, predictionLead: 1, projectileSpeed: 24, coverDiscipline: 0.48, evasion: 0.48, navigation: 0.85 },
};

export function specialistProfile(role: EnemyRole): SpecialistProfile {
  return { ...BASE_PROFILES[role] };
}

export function enemyProfileAtPower(
  profile: SpecialistProfile,
  power = ENEMY_STARTING_POWER,
): SpecialistProfile {
  const effectivePower = Math.max(1, power);
  const mobilityScale = Math.sqrt(effectivePower);
  const sharpen = (value: number) => 1 - (1 - value) / mobilityScale;
  return {
    speed: profile.speed * mobilityScale,
    accuracy: 1 - (1 - profile.accuracy) / effectivePower,
    fireInterval: profile.fireInterval / effectivePower,
    aggression: 1 - (1 - profile.aggression) / effectivePower,
    predictionLead: profile.predictionLead * mobilityScale,
    projectileSpeed: profile.projectileSpeed * mobilityScale,
    coverDiscipline: sharpen(profile.coverDiscipline),
    evasion: sharpen(profile.evasion),
    navigation: sharpen(profile.navigation),
  };
}

export function predictPlayerPosition(
  lastKnown: { x: number; z: number },
  velocity: { x: number; z: number },
  leadSeconds: number,
  arena: number | ArenaBounds = 35.5,
) {
  const bounds = typeof arena === 'number'
    ? { minX: -arena, maxX: arena, minZ: -arena, maxZ: arena }
    : arena;
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, lastKnown.x + velocity.x * leadSeconds)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, lastKnown.z + velocity.z * leadSeconds)),
  };
}

export function enemyCannonInRange(distance: number) {
  return distance <= ENEMY_CANNON_MAX_RANGE;
}

export function enemyCannonProjectileLife(distance: number, projectileSpeed: number) {
  const travelTime = Math.max(0, distance) / Math.max(1, projectileSpeed);
  return Math.min(6.5, Math.max(2.5, travelTime + 0.8));
}

export function enemyCannonCooldownMultiplier(distance: number) {
  return Math.min(2.1, 1 + Math.max(0, distance - 45) / 70);
}

export function interceptorBridgeFireMultiplier(role: EnemyRole, playerOnBridge: boolean) {
  return role === 'interceptor' && playerOnBridge ? 0.58 : 1;
}

export function enemyMortarCooldown(randomValue: number) {
  const normalized = Math.min(1, Math.max(0, randomValue));
  return ENEMY_MORTAR_MIN_COOLDOWN
    + normalized * (ENEMY_MORTAR_MAX_COOLDOWN - ENEMY_MORTAR_MIN_COOLDOWN);
}

export function enemyMortarCooldownAtPower(randomValue: number) {
  return enemyMortarCooldown(randomValue)
    / (ENEMY_STARTING_POWER * ENEMY_MORTAR_FREQUENCY_MULTIPLIER);
}

export function canLaunchEnemyMortar(
  role: EnemyRole,
  activeEnemyMortars: number,
  cooldown: number,
  memorySeconds: number,
) {
  return role === 'artillery'
    && activeEnemyMortars === 0
    && cooldown <= 0
    && memorySeconds > 0;
}

export function enemyMortarHitsPlayer(distance: number) {
  return distance <= ENEMY_MORTAR_RADIUS;
}

export function roleDodgesWeapon(role: EnemyRole, weapon: EnemyWeapon) {
  return role === 'dodger' && weapon === 'cannon';
}

export function evolvedEnemyDodgesWeapon(
  role: EnemyRole,
  weapon: EnemyWeapon,
  evasion: number,
) {
  return weapon === 'cannon' && (role === 'dodger' || evasion >= 0.72);
}
