import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  projectileHitsObstacle,
  projectileHitsTank,
  tankPositionBlocked,
  type ArenaObstacle,
} from './physics';
import { constrainTacticalPan, tacticalLookAhead } from './input';
import { livesForGeneration } from './progression';
import {
  DEPLOYMENT_SECONDS,
  ENEMY_MEMORY_SECONDS,
  ENEMY_MORTAR_RADIUS,
  ENEMY_MORTAR_WARNING_SECONDS,
  ENEMY_ROLES,
  ENEMY_STARTING_POWER,
  canLaunchEnemyMortar,
  enemyCannonCooldownMultiplier,
  enemyCannonInRange,
  enemyCannonProjectileLife,
  enemyMortarCooldownAtPower,
  enemyMortarHitsPlayer,
  enemyProfileAtPower,
  evolvedEnemyDodgesWeapon,
  interceptorBridgeFireMultiplier,
  predictPlayerPosition,
  type EnemyRole,
} from './enemyAi';
import {
  createFounderEnemyGenomes,
  evolveEnemyGenomes,
  type EnemyGenome,
} from './enemyEvolution';
import {
  createGenerationRecord,
  shouldUseAdaptiveMutation,
  type EnemyCombatResult,
  type GenerationRecord,
} from './evolutionTelemetry';
import { createMathRandomSource } from '../simulation/random';
import { enemyCombatOutcomeFitness, enemyPresenceFitness } from './enemyFitness';
import { ARENA_CONFIGS, type ArenaId } from './arenas';
import { createCombatAudio, soundVolumeForDistance, type CombatSound } from './combatAudio';
import { blastDamageForObstacle } from './environmentDamage';
import { effectBlockedByCover } from './coverOcclusion';
import {
  BREACH_RADIUS,
  BREACH_REQUIRED_HITS,
  breachAxisForImpact,
  breachCenterForImpact,
  pointInsideBreach,
  registerBreachHit,
  type BuildingBreach,
  type BreachProgress,
} from './breaching';
import {
  ENEMY_FLASH_DURATION_MULTIPLIER,
  ENEMY_TACTICAL_GRENADE_RANGE,
  FLASH_GRENADES_PER_GENERATION,
  FLASH_RADIUS,
  SMOKE_DURATION,
  SMOKE_GRENADES_PER_GENERATION,
  SMOKE_RADIUS,
  clampTacticalThrowDistance,
  chooseTacticalCarrierIndex,
  enemySmokeExposureSeconds,
  flashBlindDuration,
  lineBlockedBySmoke,
} from './tacticalGrenades';
import {
  bridgeInterceptionPoint,
  bridgeRouteWaypoint,
  closestPointOnPlayableSurface,
  playableRayDistance,
  pointInsideSurface,
  positionOnPlayableSurface,
} from './worldTopology';
import {
  MORTAR_BURST_INTERVAL,
  MORTAR_MAX_RANGE,
  MORTAR_SPLASH_RADIUS,
  PLAYER_CANNON_FIRE_INTERVAL,
  WOUNDED_SPEED_MULTIPLIER,
  enemyCannonCooldownForGeneration,
  mortarAimDistance,
  mortarBlastDamage,
  mortarBurstCount,
  mortarFlightDuration,
  mortarLaunchSpeed,
  mortarRangeForElevation,
  mortarTacticalDistance,
  playerCannonFireIntervalForGeneration,
  playerMortarPowerForGeneration,
} from './combat';
import {
  createRampOverpass,
  rampClearsBuilding,
  rampMovementDecision,
} from './ramps';
import {
  CANNON_MAX_PITCH,
  CANNON_MIN_PITCH,
  cannonDirectionForAngles,
  cannonPitchFromDirection,
  cannonPitchFromPointer,
  clampCannonPitch,
  convergedCannonTarget,
} from './cannon';
import {
  DUEL_STARTING_LIVES,
  duelEnemyPower,
  duelPlayerPower,
  enemyCountForMode,
  usesGeneticEvolution,
  type CombatMode,
} from './combatMode';
import {
  DUEL_BASE_MOVEMENT_SPEED,
  DUEL_BASE_PROJECTILE_SPEED,
  DUEL_COMBAT_MEMORY_SECONDS,
  DUEL_DODGE_DETECTION_RANGE,
  DUEL_DODGE_DISTANCE,
  DUEL_DODGE_REACTION_SECONDS,
  DUEL_MIN_DISTANCE,
  DUEL_TACTICAL_GRENADE_RANGE,
  clampDuelGoalDistance,
  duelBurstSize,
  duelEnemyCannonCooldown,
  duelLateralPressureGoal,
  duelMovementIntent,
  duelShouldDodge,
  registerDuelDodgeConsideration,
} from './duelAi';

export type GameHud = {
  mode: CombatMode;
  wave: number;
  enemies: number;
  lives: number;
  maxLives: number;
  opponentLives: number;
  opponentMaxLives: number;
  playerPower: number;
  enemyPower: number;
  score: number;
  multiplier: number;
  status: string;
  bestFitness: number;
  mutation: number;
  camera: string;
  weapon: 'CANNON' | 'MORTAR';
  mortarAmmo: number;
  mortarMaxAmmo: number;
  mortarRange: number;
  mortarElevation: number;
  artilleryActive: boolean;
  enemyMortarIncoming: boolean;
  flashEffectSeconds: number;
  smokeEffectSeconds: number;
  smokeGrenades: number;
  flashGrenades: number;
  enemyCountermeasures: boolean;
};

export type WaveCompletion = {
  mode: CombatMode;
  wave: number;
  score: number;
  livesRemaining: number;
  elapsedSeconds: number;
};

type EnemyTactic = 'cover' | 'peek' | 'flank' | 'relocate' | 'suppress';

type Enemy = {
  mesh: THREE.Group;
  genome: EnemyGenome;
  role: EnemyRole;
  isDuelist: boolean;
  hp: number;
  speed: number;
  aggression: number;
  accuracy: number;
  fire: number;
  fitness: number;
  cooldown: number;
  avoidTimer: number;
  avoidDirection: number;
  coverPosition: THREE.Vector3;
  peekPosition: THREE.Vector3;
  goalPosition: THREE.Vector3;
  lastKnownPlayer: THREE.Vector3;
  lastKnownVelocity: THREE.Vector3;
  memoryTimer: number;
  predictionLead: number;
  projectileSpeed: number;
  coverDiscipline: number;
  evasion: number;
  navigation: number;
  tactic: EnemyTactic;
  tacticTimer: number;
  mortarCooldown: number;
  wounded: boolean;
  smokeTimer: number;
  survivalSeconds: number;
  shotsFired: number;
  cannonHits: number;
  mortarHits: number;
  damageTaken: number;
  blindTimer: number;
  smokeGrenades: number;
  flashGrenades: number;
  grenadeCooldown: number;
  engagementDelay: number;
  perceptionTimer: number;
  hasLineOfSight: boolean;
  smokeObscured: boolean;
  damageResponseTimer: number;
  burstShotsRemaining: number;
  dodgeReactionTimer: number;
  pendingDodgeShot?: Shot;
};

type Shot = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  enemy: boolean;
  life: number;
  weapon: 'cannon' | 'mortar';
  trail: number;
  marker?: THREE.Mesh;
  source?: Enemy;
};
type Fx = { mesh: THREE.Mesh; life: number; max: number; grow?: boolean; maxScale?: number };
type TacticalGrenade = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  kind: 'smoke' | 'flash';
  life: number;
  enemy: boolean;
  source?: Enemy;
};
type SmokeZone = {
  center: THREE.Vector3;
  radius: number;
  life: number;
  maxLife: number;
  puffTimer: number;
  enemy: boolean;
};
type DamageableObstacle = ArenaObstacle & {
  buildingIndex?: number;
  coverIndex: number;
  height: number;
};
type BreachShaderState = {
  count: { value: number };
  centers: { value: THREE.Vector3[] };
  axes: { value: number[] };
  radii: { value: number[] };
};
type CityBuilding = {
  mesh: THREE.Mesh;
  roof: THREE.Mesh;
  windows: THREE.Mesh[];
  scorchMarks: THREE.Mesh[];
  obstacle: DamageableObstacle;
  width: number;
  height: number;
  depth: number;
  damage: number;
  maxDamage: number;
  smokeTimer: number;
  breaches: BuildingBreach[];
  breachProgress: BreachProgress[];
  breachShader: BreachShaderState;
};
type UtilityPole = {
  group: THREE.Group;
  base: THREE.Vector3;
  fallen: boolean;
  fallDirection: THREE.Vector2;
  fallProgress: number;
  sparkTimer: number;
  thudPlayed: boolean;
};
type Props = {
  arenaId: ArenaId;
  mode: CombatMode;
  active: boolean;
  onHud: (hud: GameHud) => void;
  onGameOver: (hud: GameHud) => void;
  onWaveComplete: (completion: WaveCompletion) => void;
  onPlayerDamage: () => void;
  onPlayerFlash: () => void;
  onGenerationComplete: (record: GenerationRecord) => void;
};

const MAX_BUILDING_BREACHES = 8;
const MAX_ACTIVE_EFFECTS = 110;
const TACTICAL_SMOKE_PUFF_INTERVAL = 0.18;
const DESKTOP_RENDER_PIXEL_RATIO = 1.4;
const WIDE_RENDER_PIXEL_RATIO = 1.2;
const clamp = (number: number, min: number, max: number) => Math.max(min, Math.min(max, number));

function renderPixelRatio(width: number) {
  const resolutionCap = width >= 1600 ? WIDE_RENDER_PIXEL_RATIO : DESKTOP_RENDER_PIXEL_RATIO;
  return Math.min(window.devicePixelRatio || 1, resolutionCap);
}

function createBreachShaderState(): BreachShaderState {
  return {
    count: { value: 0 },
    centers: {
      value: Array.from({ length: MAX_BUILDING_BREACHES }, () => new THREE.Vector3()),
    },
    axes: { value: Array.from({ length: MAX_BUILDING_BREACHES }, () => 0) },
    radii: { value: Array.from({ length: MAX_BUILDING_BREACHES }, () => 0) },
  };
}

function makeMaterialBreachable(material: THREE.MeshStandardMaterial, state: BreachShaderState) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.breachCount = state.count;
    shader.uniforms.breachCenters = state.centers;
    shader.uniforms.breachAxes = state.axes;
    shader.uniforms.breachRadii = state.radii;
    shader.vertexShader = `varying vec3 vBreachWorldPosition;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvBreachWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    shader.fragmentShader = `
uniform int breachCount;
uniform vec3 breachCenters[${MAX_BUILDING_BREACHES}];
uniform float breachAxes[${MAX_BUILDING_BREACHES}];
uniform float breachRadii[${MAX_BUILDING_BREACHES}];
varying vec3 vBreachWorldPosition;
${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      for (int breachIndex = 0; breachIndex < ${MAX_BUILDING_BREACHES}; breachIndex += 1) {
        if (breachIndex >= breachCount) break;
        vec3 breachDelta = vBreachWorldPosition - breachCenters[breachIndex];
        float breachDistance = breachAxes[breachIndex] < 0.5
          ? length(breachDelta.yz)
          : length(breachDelta.xy);
        if (breachDistance < breachRadii[breachIndex]) discard;
      }`,
    );
  };
  material.customProgramCacheKey = () => 'city-building-breaches-v1';
  material.needsUpdate = true;
}

const ROLE_COLORS: Record<EnemyRole, number> = {
  marksman: 0xb84a42,
  sprinter: 0xd46832,
  dodger: 0xb83e73,
  navigator: 0x8e4cc4,
  artillery: 0x734cc9,
  interceptor: 0x238f87,
};
const ROLE_GLOW_COLORS: Record<EnemyRole, number> = {
  marksman: 0xff4a52,
  sprinter: 0xff8a45,
  dodger: 0xff4a52,
  navigator: 0xff4a52,
  artillery: 0xb36cff,
  interceptor: 0x4cffe8,
};

function createTank(color: number, player = false) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.34 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x202a2b, metalness: 0.65, roughness: 0.48 });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: player ? 0x00c9bb : 0xe53c3c,
    emissive: player ? 0x00a897 : 0xd52f2f,
    emissiveIntensity: 2.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 3.2), bodyMaterial);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.05), bodyMaterial);
  nose.position.set(0, 0.87, -1.35);
  nose.rotation.x = -0.1;
  group.add(nose);

  const turretPivot = new THREE.Group();
  turretPivot.position.y = 1.07;
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.92, 0.48, 8), bodyMaterial);
  turret.rotation.x = Math.PI / 2;
  turretPivot.add(turret);
  const gunPitch = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 2.15, 10), darkMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.05, -1.4);
  gunPitch.add(barrel);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.05, -2.5);
  gunPitch.add(muzzle);
  turretPivot.add(gunPitch);
  group.add(turretPivot);

  [-1.2, 1.2].forEach((x) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 3.45), darkMaterial);
    track.position.set(x, 0.38, 0);
    track.castShadow = true;
    group.add(track);
  });

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.08), glowMaterial);
  lamp.position.set(0, 0.73, -1.65);
  group.add(lamp);
  group.userData.turret = turretPivot;
  group.userData.gunPitch = gunPitch;
  group.userData.muzzle = muzzle;
  group.userData.bodyMaterial = bodyMaterial;
  group.userData.glowMaterial = glowMaterial;
  return group;
}

function decorateEnemyTank(tank: THREE.Group, role: EnemyRole) {
  tank.userData.role = role;
  const glowMaterial = tank.userData.glowMaterial as THREE.MeshStandardMaterial;
  const roleGlow = ROLE_GLOW_COLORS[role];
  glowMaterial.color.setHex(roleGlow);
  glowMaterial.emissive.setHex(roleGlow);

  if (role === 'interceptor') {
    const beacon = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.58, 3),
      new THREE.MeshBasicMaterial({ color: 0x4cffe8 }),
    );
    beacon.position.y = 1.95;
    beacon.rotation.x = Math.PI;
    beacon.userData.interceptorBeacon = true;
    tank.userData.interceptorBeacon = beacon;
    tank.add(beacon);
    tank.add(new THREE.PointLight(0x35e7d5, 4.2, 6.5));
    return;
  }
  if (role !== 'artillery') return;
  const beacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshBasicMaterial({ color: 0xd9a4ff }),
  );
  beacon.position.y = 1.9;
  beacon.userData.artilleryBeacon = true;
  tank.userData.artilleryBeacon = beacon;
  tank.add(beacon);
  tank.add(new THREE.PointLight(0xb36cff, 4.8, 7));
}

function decorateTacticalCarrier(tank: THREE.Group) {
  tank.userData.tacticalCarrier = true;
  const canisterMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2b84e,
    emissive: 0xa86516,
    emissiveIntensity: 1.15,
    metalness: 0.58,
    roughness: 0.38,
  });
  [-0.68, 0.68].forEach((x) => {
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.58, 10), canisterMaterial);
    canister.rotation.x = Math.PI / 2;
    canister.position.set(x, 1.12, 0.42);
    tank.add(canister);
  });
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.36, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffce63,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  marker.position.y = 2.25;
  marker.rotation.x = Math.PI / 2;
  marker.userData.tacticalCarrierMarker = true;
  tank.userData.tacticalCarrierMarker = marker;
  tank.add(marker);
  const light = new THREE.PointLight(0xffbf3f, 3.8, 5.5);
  light.position.y = 1.85;
  tank.add(light);
}

export function GameCanvas({
  arenaId,
  mode,
  active,
  onHud,
  onGameOver,
  onWaveComplete,
  onPlayerDamage,
  onPlayerFlash,
  onGenerationComplete,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const host = mount.current!;
    const arena = ARENA_CONFIGS[arenaId];
    const duelMode = mode === 'duel';
    const arenaCover = arena.cover;
    const arenaSectors = arena.sectors;
    const arenaBridges = arena.bridges;
    const arenaSurfaces = arena.surfaces;
    const arenaRamps = arena.rampBuildingIndices.map((coverIndex) => (
      createRampOverpass(coverIndex, arenaCover[coverIndex])
    ));
    const worldWidth = arena.bounds.maxX - arena.bounds.minX;
    const worldDepth = arena.bounds.maxZ - arena.bounds.minZ;
    const worldCenterX = (arena.bounds.minX + arena.bounds.maxX) / 2;
    const worldCenterZ = (arena.bounds.minZ + arena.bounds.maxZ) / 2;
    const isCity = arena.environment === 'city';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(arena.colors.background);
    scene.fog = new THREE.Fog(arena.colors.fog, 58, 420);

    const projectileGeometry = {
      playerCannon: new THREE.SphereGeometry(0.18, 7, 7),
      enemyCannon: new THREE.SphereGeometry(0.14, 7, 7),
      mortar: new THREE.SphereGeometry(0.25, 8, 8),
      enemyMortar: new THREE.SphereGeometry(0.23, 8, 8),
    };
    const projectileMaterial = {
      playerCannon: new THREE.MeshBasicMaterial({ color: 0x76fff0 }),
      enemyCannon: new THREE.MeshBasicMaterial({ color: 0xff4c45 }),
      mortar: new THREE.MeshBasicMaterial({ color: 0xffa12e }),
      enemyMortar: new THREE.MeshBasicMaterial({ color: 0xff684d }),
    };
    const disposeObjectResources = (root: THREE.Object3D) => {
      root.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || child.userData.sharedResources) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      });
    };
    const removeTransientObject = (object: THREE.Object3D) => {
      scene.remove(object);
      disposeObjectResources(object);
    };

    const camera = new THREE.PerspectiveCamera(58, host.clientWidth / host.clientHeight, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setPixelRatio(renderPixelRatio(host.clientWidth));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.55;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const cockpitWeapon = new THREE.Group();
    const weaponMaterial = new THREE.MeshStandardMaterial({ color: 0x244f52, metalness: 0.72, roughness: 0.3 });
    const weaponBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 1.15), weaponMaterial);
    weaponBody.position.set(0.58, -0.48, -1.15);
    cockpitWeapon.add(weaponBody);
    const weaponBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 1.25, 10), weaponMaterial);
    weaponBarrel.rotation.x = Math.PI / 2;
    weaponBarrel.position.set(0.58, -0.4, -1.9);
    cockpitWeapon.add(weaponBarrel);
    const cockpitMuzzle = new THREE.Object3D();
    cockpitMuzzle.position.set(0.58, -0.4, -2.55);
    cockpitWeapon.add(cockpitMuzzle);
    const weaponLamp = new THREE.PointLight(0x44e7d7, 2.2, 4);
    weaponLamp.position.set(0.58, -0.36, -1.9);
    cockpitWeapon.add(weaponLamp);
    camera.add(cockpitWeapon);
    scene.add(camera);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(480, 28, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(isCity ? 0x345f7a : 0x12384e) },
          bottomColor: { value: new THREE.Color(isCity ? 0xa3bac0 : 0x426879) },
        },
        vertexShader: 'varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPos; void main(){ float h=clamp(normalize(vPos).y*.72+.35,0.0,1.0); gl_FragColor=vec4(mix(bottomColor,topColor,h),1.0); }',
      }),
    );
    scene.add(sky);

    scene.add(new THREE.HemisphereLight(isCity ? 0xdaf5ff : 0xa9ddf2, isCity ? 0x4f5548 : 0x27353a, isCity ? 3.25 : 2.8));
    const sun = new THREE.DirectionalLight(isCity ? 0xffe5bd : 0xc7e6ff, isCity ? 5.4 : 4.8);
    sun.position.set(-24, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -112;
    sun.shadow.camera.right = 112;
    sun.shadow.camera.top = 62;
    sun.shadow.camera.bottom = -62;
    sun.shadow.camera.far = 240;
    scene.add(sun);
    const fillLight = new THREE.DirectionalLight(isCity ? 0x8bdff5 : 0x55e1d0, 1.4);
    fillLight.position.set(22, 15, -18);
    scene.add(fillLight);

    const lowerField = new THREE.Mesh(
      new THREE.PlaneGeometry(worldWidth + 150, worldDepth + 150),
      new THREE.MeshStandardMaterial({
        color: isCity ? 0x17677c : 0x06131e,
        metalness: isCity ? 0.16 : 0.04,
        roughness: isCity ? 0.28 : 0.94,
        transparent: true,
        opacity: isCity ? 0.9 : 0.96,
      }),
    );
    lowerField.rotation.x = -Math.PI / 2;
    lowerField.position.set(worldCenterX, -0.38, worldCenterZ);
    scene.add(lowerField);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: arena.colors.floor,
      metalness: isCity ? 0.08 : 0.28,
      roughness: isCity ? 0.92 : 0.7,
    });
    arenaSectors.forEach((sector) => {
      const sectorWidth = sector.maxX - sector.minX;
      const sectorDepth = sector.maxZ - sector.minZ;
      const sectorCenterX = (sector.minX + sector.maxX) / 2;
      const sectorCenterZ = (sector.minZ + sector.maxZ) / 2;
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(sectorWidth, sectorDepth),
        floorMaterial,
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(sectorCenterX, 0, sectorCenterZ);
      floor.receiveShadow = true;
      scene.add(floor);

      const gridSize = Math.min(sectorWidth, sectorDepth);
      const grid = new THREE.GridHelper(gridSize, Math.round(gridSize / 2), arena.colors.gridMajor, arena.colors.gridMinor);
      grid.position.set(sectorCenterX, 0.012, sectorCenterZ);
      (grid.material as THREE.Material).opacity = 0.38;
      (grid.material as THREE.Material).transparent = true;
      scene.add(grid);
    });

    if (isCity) {
      const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x222a2d, roughness: 0.96, metalness: 0.02 });
      const roadLines = new THREE.MeshBasicMaterial({ color: 0xe0bc58 });
      const promenadeMaterial = new THREE.MeshStandardMaterial({ color: 0xa6a59b, roughness: 0.88 });
      const roadDashTransforms: THREE.Matrix4[] = [];
      const roadDashPlacement = new THREE.Object3D();
      arenaSectors.forEach((sector, sectorIndex) => {
        const centerX = (sector.minX + sector.maxX) / 2;
        const centerZ = (sector.minZ + sector.maxZ) / 2;
        const sectorWidth = sector.maxX - sector.minX;
        const sectorDepth = sector.maxZ - sector.minZ;
        const mirror = sectorIndex === 0 ? 1 : -1;
        [-22, 0, 22].forEach((localX) => {
          const x = centerX + localX * mirror;
          const road = new THREE.Mesh(new THREE.PlaneGeometry(7.2, sectorDepth), roadMaterial);
          road.rotation.x = -Math.PI / 2;
          road.position.set(x, 0.022, centerZ);
          scene.add(road);
          for (let z = sector.minZ + 2; z <= sector.maxZ - 2; z += 7) {
            roadDashPlacement.position.set(x, 0.045, z);
            roadDashPlacement.rotation.set(0, 0, 0);
            roadDashPlacement.updateMatrix();
            roadDashTransforms.push(roadDashPlacement.matrix.clone());
          }
        });
        [-24, 0, 24].forEach((localZ) => {
          const z = centerZ + localZ;
          const road = new THREE.Mesh(new THREE.PlaneGeometry(sectorWidth, 7.2), roadMaterial);
          road.rotation.x = -Math.PI / 2;
          road.position.set(centerX, 0.026, z);
          scene.add(road);
          for (let x = sector.minX + 2; x <= sector.maxX - 2; x += 7) {
            roadDashPlacement.position.set(x, 0.05, z);
            roadDashPlacement.rotation.set(0, Math.PI / 2, 0);
            roadDashPlacement.updateMatrix();
            roadDashTransforms.push(roadDashPlacement.matrix.clone());
          }
        });
        for (const side of [-1, 1]) {
          const waterfront = new THREE.Mesh(new THREE.BoxGeometry(sectorWidth, 0.1, 1.7), promenadeMaterial);
          waterfront.position.set(centerX, 0.04, side < 0 ? sector.minZ + 1 : sector.maxZ - 1);
          scene.add(waterfront);
          const crossWaterfront = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, sectorDepth), promenadeMaterial);
          crossWaterfront.position.set(side < 0 ? sector.minX + 1 : sector.maxX - 1, 0.04, centerZ);
          scene.add(crossWaterfront);
        }
      });
      const roadDashes = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.12, 0.025, 3.3),
        roadLines,
        roadDashTransforms.length,
      );
      roadDashTransforms.forEach((matrix, index) => roadDashes.setMatrixAt(index, matrix));
      roadDashes.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      roadDashes.computeBoundingSphere();
      scene.add(roadDashes);
    }

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: arena.colors.accent,
      emissive: isCity ? 0x81581d : 0x00b9ae,
      emissiveIntensity: isCity ? 0.35 : 0.7,
      metalness: 0.42,
      roughness: 0.38,
    });
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: arena.colors.cover,
      metalness: isCity ? 0.08 : 0.32,
      roughness: isCity ? 0.82 : 0.58,
    });
    const obstacles: DamageableObstacle[] = [];
    const cityBuildings: CityBuilding[] = [];
    const utilityPoles: UtilityPole[] = [];

    const boundaryRailTransforms: THREE.Matrix4[] = [];
    const boundaryRailPlacement = new THREE.Object3D();
    arenaSectors.forEach((sector, sectorIndex) => {
      for (let x = sector.minX + 2; x <= sector.maxX - 2; x += 4) {
        for (const z of [sector.minZ, sector.maxZ]) {
          boundaryRailPlacement.position.set(x, 0.18, z);
          boundaryRailPlacement.rotation.set(0, 0, 0);
          boundaryRailPlacement.updateMatrix();
          boundaryRailTransforms.push(boundaryRailPlacement.matrix.clone());
        }
      }
      for (let z = sector.minZ + 2; z <= sector.maxZ - 2; z += 4) {
        for (const x of [sector.minX, sector.maxX]) {
          const innerShore = sectorIndex === 0 ? x === sector.maxX : x === sector.minX;
          const opensOntoBridge = innerShore && arenaBridges.some((bridge) => (
            z >= bridge.minZ && z <= bridge.maxZ
          ));
          if (opensOntoBridge) continue;
          boundaryRailPlacement.position.set(x, 0.18, z);
          boundaryRailPlacement.rotation.set(0, Math.PI / 2, 0);
          boundaryRailPlacement.updateMatrix();
          boundaryRailTransforms.push(boundaryRailPlacement.matrix.clone());
        }
      }
    });
    const boundaryRails = new THREE.InstancedMesh(
      new THREE.BoxGeometry(3.5, 0.16, 0.12),
      accentMaterial,
      boundaryRailTransforms.length,
    );
    boundaryRailTransforms.forEach((matrix, index) => boundaryRails.setMatrixAt(index, matrix));
    boundaryRails.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    boundaryRails.computeBoundingSphere();
    scene.add(boundaryRails);

    arenaBridges.forEach((bridge, bridgeIndex) => {
      const bridgeWidth = bridge.maxZ - bridge.minZ;
      const bridgeLength = bridge.maxX - bridge.minX;
      const centerX = (bridge.minX + bridge.maxX) / 2;
      const centerZ = (bridge.minZ + bridge.maxZ) / 2;
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(bridgeLength, 0.34, bridgeWidth),
        new THREE.MeshStandardMaterial({
          color: isCity ? 0x30383a : 0x263f49,
          metalness: isCity ? 0.28 : 0.62,
          roughness: isCity ? 0.82 : 0.46,
        }),
      );
      deck.position.set(centerX, -0.15, centerZ);
      deck.receiveShadow = true;
      scene.add(deck);
      for (const side of [-1, 1]) {
        const bridgeRail = new THREE.Mesh(
          new THREE.BoxGeometry(bridgeLength, isCity ? 0.72 : 0.48, 0.18),
          accentMaterial,
        );
        bridgeRail.position.set(centerX, isCity ? 0.36 : 0.24, side < 0 ? bridge.minZ + 0.12 : bridge.maxZ - 0.12);
        bridgeRail.castShadow = true;
        scene.add(bridgeRail);
      }
      for (let x = bridge.minX + 2; x < bridge.maxX; x += 4) {
        const laneMark = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.04, 0.11),
          new THREE.MeshBasicMaterial({ color: isCity ? 0xf0c45e : 0x73f4e3 }),
        );
        laneMark.position.set(x, 0.045, centerZ);
        scene.add(laneMark);
      }
      if (!isCity) {
        const bridgeGlow = new THREE.PointLight(0x49e8db, 7, 14);
        bridgeGlow.position.set(centerX, 1.2, centerZ);
        scene.add(bridgeGlow);
      } else if (bridgeIndex === 0) {
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(3.8, 0.7, 0.16),
          new THREE.MeshStandardMaterial({ color: 0x61655f, emissive: 0x805d1d, emissiveIntensity: 0.42 }),
        );
        sign.position.set(centerX, 2.5, bridge.minZ + 0.25);
        scene.add(sign);
      }
    });

    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd786,
      emissive: 0xffbd55,
      emissiveIntensity: 1.15,
      metalness: 0.2,
      roughness: 0.25,
    });

    arenaCover.forEach(([x, z, width, height, depth], buildingIndex) => {
      const buildingMaterial = isCity ? wallMaterial.clone() : wallMaterial;
      const breachShader = createBreachShaderState();
      if (isCity) makeMaterialBreachable(buildingMaterial, breachShader);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterial);
      cover.position.set(x, height / 2, z);
      cover.castShadow = true;
      cover.receiveShadow = true;
      scene.add(cover);
      const obstacle: DamageableObstacle = {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        buildingIndex: isCity ? buildingIndex : undefined,
        coverIndex: buildingIndex,
        height,
      };
      obstacles.push(obstacle);

      if (isCity) {
        const buildingWindowMaterial = windowMaterial.clone();
        makeMaterialBreachable(buildingWindowMaterial, breachShader);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.42, 0.55, depth * 0.42),
          new THREE.MeshStandardMaterial({ color: buildingIndex % 2 ? 0x50595c : 0x5b6264, roughness: 0.84 }),
        );
        roof.position.set(x, height + 0.28, z);
        roof.castShadow = true;
        scene.add(roof);

        const windows: THREE.Mesh[] = [];
        const floors = Math.min(4, Math.max(2, Math.floor(height / 1.7)));
        for (let level = 0; level < floors; level += 1) {
          const windowY = Math.min(height - 0.48, 1.25 + level * 1.45);
          const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(width * 0.62, 0.22, 0.045), buildingWindowMaterial);
          frontWindow.position.set(x, windowY, z - depth / 2 - 0.026);
          scene.add(frontWindow);
          const rearWindow = frontWindow.clone();
          rearWindow.position.z = z + depth / 2 + 0.026;
          scene.add(rearWindow);
          const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, depth * 0.62), buildingWindowMaterial);
          sideWindow.position.set(x - width / 2 - 0.026, windowY, z);
          scene.add(sideWindow);
          const otherSideWindow = sideWindow.clone();
          otherSideWindow.position.x = x + width / 2 + 0.026;
          scene.add(otherSideWindow);
          windows.push(frontWindow, rearWindow, sideWindow, otherSideWindow);
        }
        cityBuildings.push({
          mesh: cover,
          roof,
          windows,
          scorchMarks: [],
          obstacle,
          width,
          height,
          depth,
          damage: 0,
          maxDamage: 8,
          smokeTimer: 0.15 + Math.random() * 0.3,
          breaches: [],
          breachProgress: [],
          breachShader,
        });
      } else {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.09, 0.09), accentMaterial);
        stripe.position.set(x, height + 0.05, z - depth / 2 - 0.01);
        scene.add(stripe);
      }
    });

    const rampDeckMaterial = new THREE.MeshStandardMaterial({
      color: isCity ? 0x434b4d : 0x294952,
      metalness: isCity ? 0.56 : 0.72,
      roughness: isCity ? 0.54 : 0.38,
    });
    arenaRamps.forEach((ramp) => {
      const buildingMinX = ramp.centerX - ramp.buildingWidth / 2;
      const buildingMaxX = ramp.centerX + ramp.buildingWidth / 2;
      const slopeLength = Math.hypot(ramp.approachLength, ramp.topHeight);
      const slopeAngle = Math.atan2(ramp.topHeight, ramp.approachLength);
      for (const side of [-1, 1]) {
        const slope = new THREE.Mesh(
          new THREE.BoxGeometry(slopeLength, 0.28, ramp.laneWidth),
          rampDeckMaterial,
        );
        slope.rotation.z = side < 0 ? slopeAngle : -slopeAngle;
        slope.position.set(
          side < 0
            ? buildingMinX - ramp.approachLength / 2
            : buildingMaxX + ramp.approachLength / 2,
          ramp.topHeight / 2,
          ramp.centerZ,
        );
        slope.castShadow = true;
        slope.receiveShadow = true;
        scene.add(slope);

        for (const railSide of [-1, 1]) {
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(slopeLength, 0.34, 0.12),
            accentMaterial,
          );
          rail.rotation.z = slope.rotation.z;
          rail.position.copy(slope.position);
          rail.position.y += 0.34;
          rail.position.z += railSide * (ramp.laneWidth / 2 - 0.08);
          scene.add(rail);
        }
      }

      const roofDeck = new THREE.Mesh(
        new THREE.BoxGeometry(ramp.buildingWidth, 0.28, ramp.laneWidth),
        rampDeckMaterial,
      );
      roofDeck.position.set(ramp.centerX, ramp.topHeight - 0.14, ramp.centerZ);
      roofDeck.castShadow = true;
      roofDeck.receiveShadow = true;
      scene.add(roofDeck);
      for (const side of [-1, 1]) {
        const roofRail = new THREE.Mesh(
          new THREE.BoxGeometry(ramp.buildingWidth, 0.46, 0.12),
          accentMaterial,
        );
        roofRail.position.set(
          ramp.centerX,
          ramp.topHeight + 0.2,
          ramp.centerZ + side * (ramp.laneWidth / 2 - 0.08),
        );
        scene.add(roofRail);
      }
    });

    if (isCity) {
      const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x30383a, metalness: 0.74, roughness: 0.43 });
      const crossbarMaterial = new THREE.MeshStandardMaterial({ color: 0x453629, metalness: 0.12, roughness: 0.78 });
      const insulatorMaterial = new THREE.MeshStandardMaterial({ color: 0x8fdde0, emissive: 0x226e74, emissiveIntensity: 0.65, roughness: 0.2 });
      arenaSectors.forEach((sector) => {
        const centerX = (sector.minX + sector.maxX) / 2;
        const centerZ = (sector.minZ + sector.maxZ) / 2;
        for (const localX of [-31, -11, 11, 31]) {
          for (const localZ of [-31, -11, 11, 31]) {
          const x = centerX + localX;
          const z = centerZ + localZ;
          const group = new THREE.Group();
          group.position.set(x, 0, z);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 3.6, 8), poleMaterial);
          post.position.y = 1.8;
          post.castShadow = true;
          group.add(post);
          const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.16), crossbarMaterial);
          crossbar.position.y = 3.25;
          crossbar.castShadow = true;
          group.add(crossbar);
          for (const offset of [-0.52, 0, 0.52]) {
            const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.24, 8), insulatorMaterial);
            insulator.position.set(offset, 3.44, 0);
            group.add(insulator);
          }
          scene.add(group);
          utilityPoles.push({
            group,
            base: new THREE.Vector3(x, 0, z),
            fallen: false,
            fallDirection: new THREE.Vector2(1, 0),
            fallProgress: 0,
            sparkTimer: 0,
            thudPlayed: false,
          });
        }
        }
      });
    } else {
      const grassMaterial = new THREE.MeshBasicMaterial({ color: 0x3d6d65 });
      arenaSectors.forEach((sector) => {
        for (let index = 0; index < 100; index += 1) {
          const fleck = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.035), grassMaterial);
          fleck.position.set(
            sector.minX + Math.random() * (sector.maxX - sector.minX),
            0.05,
            sector.minZ + Math.random() * (sector.maxZ - sector.minZ),
          );
          scene.add(fleck);
        }
      });
    }

    const player = createTank(0x1d817d, true);
    player.position.set(arena.playerSpawn[0], 0, arena.playerSpawn[1]);
    scene.add(player);
    const enemyMemorySeconds = duelMode
      ? DUEL_COMBAT_MEMORY_SECONDS
      : ENEMY_MEMORY_SECONDS;
    const previousPlayerPosition = player.position.clone();
    const playerVelocity = new THREE.Vector3();
    const squadLastKnownPlayer = player.position.clone();
    const squadLastKnownVelocity = new THREE.Vector3();
    let squadMemoryTimer = enemyMemorySeconds;

    let enemies: Enemy[] = [];
    const evolutionRng = createMathRandomSource();
    let enemyGenomes = createFounderEnemyGenomes(evolutionRng);
    let generationResults: EnemyCombatResult[] = [];
    let mutationPercent = 0;
    let plateauStreak = 0;
    let generationElapsed = 0;
    let duelPressureSeconds = 0;
    let duelRelocationSeconds = 0;
    let duelMinimumDistance = Infinity;
    let duelDodgeCount = 0;
    let shots: Shot[] = [];
    let tacticalGrenades: TacticalGrenade[] = [];
    let smokeZones: SmokeZone[] = [];
    const effects: Fx[] = [];
    const addEffect = (effect: Fx) => {
      while (effects.length >= MAX_ACTIVE_EFFECTS) {
        const oldest = effects.shift();
        if (oldest) removeTransientObject(oldest.mesh);
      }
      effects.push(effect);
    };
    let wave = 1;
    let score = 0;
    let maxLives = duelMode ? DUEL_STARTING_LIVES : livesForGeneration(wave);
    let lives = maxLives;
    const currentPlayerPower = () => duelMode ? duelPlayerPower(wave) : 1;
    const currentEnemyPower = () => duelMode ? duelEnemyPower(wave) : ENEMY_STARTING_POWER;
    const currentPlayerMortarPower = () => duelMode
      ? currentPlayerPower()
      : playerMortarPowerForGeneration(wave);
    const currentPlayerMortarRange = () => (
      MORTAR_MAX_RANGE * currentPlayerMortarPower()
    );
    let best = 0;
    let cameraMode = 1;
    let aimAngle = 0;
    let aimPitch = 0;
    let aimEngaged = false;
    let pointerLocked = false;
    let pointerLockUnavailable = false;
    let tacticalPanX = 0;
    let tacticalPanZ = 0;
    let weaponRecoil = 0;
    let damageShake = 0;
    let playerBlindTimer = 0;
    let playerSmokeTimer = 0;
    let playerFireCooldown = 0;
    let weaponMode: 'cannon' | 'mortar' = 'cannon';
    const mortarMaxAmmo = 3;
    let mortarAmmo = mortarMaxAmmo;
    let mortarRecharge = 0;
    let mortarBurstRemaining = 0;
    let mortarBurstTimer = 0;
    let mortarRange = 0;
    let mortarElevation = 45;
    let smokeGrenades = SMOKE_GRENADES_PER_GENERATION;
    let flashGrenades = FLASH_GRENADES_PER_GENERATION;
    let fireHeld = false;
    const pointer = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    const aimingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.92);
    const aimIntersection = new THREE.Vector3();
    const turretOriginScratch = new THREE.Vector3();
    const turretAimScratch = new THREE.Vector3();
    const horizontalAimScratch = new THREE.Vector3();
    const movementScratch = new THREE.Vector3();
    const velocityScratch = new THREE.Vector3();
    const directionToPlayerScratch = new THREE.Vector3();
    const predictedTargetScratch = new THREE.Vector3();
    const directionToPredictionScratch = new THREE.Vector3();
    const enemyAimOriginScratch = new THREE.Vector3();
    const enemyAimDirectionScratch = new THREE.Vector3();
    const shotThreatScratch = new THREE.Vector3();
    const shotDirectionScratch = new THREE.Vector3();
    const dodgeOffsetScratch = new THREE.Vector3();
    const directionToGoalScratch = new THREE.Vector3();
    const previousEnemyPositionScratch = new THREE.Vector3();
    const enemyStepScratch = new THREE.Vector3();
    const cameraFocusScratch = new THREE.Vector3();
    const cameraOffsetScratch = new THREE.Vector3(0, 28, 12);
    const cameraDesiredScratch = new THREE.Vector3();
    const projectedPlayerScratch = new THREE.Vector3();
    let lastFrame = performance.now();
    let hudTick = 0;
    let started = false;
    let gameEnded = false;
    let deploymentTimer = DEPLOYMENT_SECONDS;
    let breachMessage = '';
    let breachMessageTimer = 0;
    let countermeasureMessage = '';
    let countermeasureMessageTimer = 0;
    const keys = new Set<string>();
    const combatAudio = createCombatAudio();
    const playWorldSound = (sound: CombatSound, position: THREE.Vector3, level = 1) => {
      const distance = camera.position.distanceTo(position);
      combatAudio.play(sound, level * soundVolumeForDistance(distance));
    };

    const removeShots = () => {
      shots.forEach((shot) => {
        removeTransientObject(shot.mesh);
        if (shot.marker) removeTransientObject(shot.marker);
      });
      shots = [];
    };

    const removeTacticalGrenades = () => {
      tacticalGrenades.forEach((grenade) => removeTransientObject(grenade.mesh));
      tacticalGrenades = [];
      smokeZones = [];
      playerSmokeTimer = 0;
    };

    const resetPlayerToArenaSpawn = () => {
      player.position.set(arena.playerSpawn[0], 0, arena.playerSpawn[1]);
      player.rotation.set(0, 0, 0);
      player.userData.activeRampCoverIndex = undefined;
      previousPlayerPosition.copy(player.position);
      playerVelocity.set(0, 0, 0);
      aimAngle = 0;
      aimPitch = 0;
      aimEngaged = false;
      pointer.set(0, 0);
      tacticalPanX = 0;
      tacticalPanZ = 0;
      weaponRecoil = 0;
      damageShake = 0;
      playerBlindTimer = 0;
      playerSmokeTimer = 0;
      playerFireCooldown = 0;
      fireHeld = false;
      (player.userData.turret as THREE.Object3D).rotation.y = 0;
      (player.userData.gunPitch as THREE.Object3D).rotation.x = 0;
      document.documentElement.style.setProperty('--aim-x', '50vw');
      document.documentElement.style.setProperty('--aim-y', '50vh');
    };

    const spawnWave = () => {
      enemies.forEach((enemy) => removeTransientObject(enemy.mesh));
      enemies = [];
      generationResults = [];
      generationElapsed = 0;
      duelPressureSeconds = 0;
      duelRelocationSeconds = 0;
      duelMinimumDistance = Infinity;
      duelDodgeCount = 0;
      removeShots();
      removeTacticalGrenades();
      mortarBurstRemaining = 0;
      smokeGrenades = SMOKE_GRENADES_PER_GENERATION;
      flashGrenades = FLASH_GRENADES_PER_GENERATION;
      countermeasureMessage = '';
      countermeasureMessageTimer = 0;
      resetPlayerToArenaSpawn();
      deploymentTimer = DEPLOYMENT_SECONDS;
      squadLastKnownPlayer.copy(player.position);
      squadLastKnownVelocity.set(0, 0, 0);
      squadMemoryTimer = enemyMemorySeconds;
      const count = enemyCountForMode(mode);
      const tacticalCarrierIndex = duelMode ? 0 : chooseTacticalCarrierIndex(Math.random(), count);
      for (let index = 0; index < count; index += 1) {
        const role = duelMode ? 'interceptor' : ENEMY_ROLES[index];
        const spawnSlot = duelMode ? 1 : index;
        const coverIndex = arena.enemySpawnCoverIndices[spawnSlot] ?? spawnSlot;
        const [coverX, coverZ, coverWidth, , coverDepth] = arenaCover[coverIndex];
        const outward = new THREE.Vector2(coverX - player.position.x, coverZ - player.position.z).normalize();
        const coverRadius = Math.max(coverWidth, coverDepth) / 2;
        const x = coverX + outward.x * (coverRadius + 2.7);
        const z = coverZ + outward.y * (coverRadius + 2.7);
        const peekDistance = coverRadius + 3.2;
        const peekCandidates = [1, -1].map((side) => new THREE.Vector3(
          x - outward.y * peekDistance * side,
          0,
          z + outward.x * peekDistance * side,
        ));
        const peekPosition = peekCandidates.find((candidate) => (
          !tankPositionBlocked(candidate, obstacles)
          && !tankSightBlockedByCover(candidate, player.position)
        )) ?? peekCandidates[index % 2];
        const enemyTank = createTank(ROLE_COLORS[role]);
        decorateEnemyTank(enemyTank, role);
        if (duelMode || index === tacticalCarrierIndex) decorateTacticalCarrier(enemyTank);
        enemyTank.position.set(x, 0, z);
        enemyTank.rotation.y = Math.atan2(-player.position.x + x, -player.position.z + z);
        scene.add(enemyTank);
        const genome = enemyGenomes.find((candidate) => candidate.role === role);
        if (!genome) throw new Error(`Missing ${role} genome for Generation ${wave}.`);
        const duelPower = currentEnemyPower();
        const profile = duelMode
          ? {
            speed: DUEL_BASE_MOVEMENT_SPEED * duelPower,
            accuracy: Math.min(0.98, 0.72 * duelPower),
            fireInterval: PLAYER_CANNON_FIRE_INTERVAL / duelPower,
            aggression: Math.min(0.98, 0.78 * duelPower),
            predictionLead: 0.55 * duelPower,
            projectileSpeed: DUEL_BASE_PROJECTILE_SPEED * duelPower,
            coverDiscipline: Math.min(0.98, 0.76 * duelPower),
            evasion: Math.min(0.98, 0.78 * duelPower),
            navigation: Math.min(0.98, 0.9 * duelPower),
          }
          : enemyProfileAtPower(genome.genes);
          const initialTactic: EnemyTactic = role === 'sprinter'
          ? 'suppress'
          : role === 'navigator'
            ? 'suppress'
            : role === 'dodger'
              ? 'relocate'
              : 'cover';
        const initialGoal = new THREE.Vector3(x, 0, z);
        enemies.push({
          mesh: enemyTank,
          genome,
          role,
          isDuelist: duelMode,
          hp: duelMode ? DUEL_STARTING_LIVES : 2,
          speed: profile.speed,
          aggression: profile.aggression,
          accuracy: profile.accuracy,
          fire: profile.fireInterval,
          fitness: 0,
          cooldown: duelMode
            ? (0.32 + Math.random() * 0.24) / duelPower
            : (0.35 + Math.random() * 0.55) / ENEMY_STARTING_POWER,
          avoidTimer: 0,
          avoidDirection: Math.random() > 0.5 ? 1 : -1,
          coverPosition: new THREE.Vector3(x, 0, z),
          peekPosition,
          goalPosition: initialGoal,
          lastKnownPlayer: player.position.clone(),
          lastKnownVelocity: new THREE.Vector3(),
          memoryTimer: enemyMemorySeconds,
          predictionLead: profile.predictionLead,
          projectileSpeed: profile.projectileSpeed,
          coverDiscipline: profile.coverDiscipline,
          evasion: profile.evasion,
          navigation: profile.navigation,
          tactic: initialTactic,
          // On the first live frame, transition into the role's real opening tactic.
          tacticTimer: 0.02,
          mortarCooldown: duelMode
            ? 4.8 / duelPower
            : role === 'artillery'
              ? enemyMortarCooldownAtPower(Math.random())
              : Infinity,
          wounded: false,
          smokeTimer: 0.2 + Math.random() * 0.3,
          survivalSeconds: 0,
          shotsFired: 0,
          cannonHits: 0,
          mortarHits: 0,
          damageTaken: 0,
          blindTimer: 0,
          smokeGrenades: duelMode || index === tacticalCarrierIndex ? SMOKE_GRENADES_PER_GENERATION : 0,
          flashGrenades: duelMode || index === tacticalCarrierIndex ? FLASH_GRENADES_PER_GENERATION : 0,
          grenadeCooldown: duelMode || index === tacticalCarrierIndex ? 0.05 + Math.random() * 0.08 : Infinity,
          engagementDelay: 0.45 + index * 0.16 + Math.random() * 0.22,
          perceptionTimer: index * 0.012,
          hasLineOfSight: false,
          smokeObscured: false,
          damageResponseTimer: 0,
          burstShotsRemaining: duelMode ? duelBurstSize(Math.random()) : 0,
          dodgeReactionTimer: 0,
        });
      }
    };

    const createExplosion = (position: THREE.Vector3, color = 0xff542e) => {
      for (let index = 0; index < 9; index += 1) {
        const particle = new THREE.Mesh(
          new THREE.SphereGeometry(0.12 + Math.random() * 0.2, 6, 6),
          new THREE.MeshBasicMaterial({ color, transparent: true }),
        );
        particle.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2));
        particle.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4);
        scene.add(particle);
        addEffect({ mesh: particle, life: 0.7 + Math.random() * 0.5, max: 1.2 });
      }
    };

    const createSmoke = (position: THREE.Vector3) => {
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 7, 7),
        new THREE.MeshBasicMaterial({ color: 0x4d5559, transparent: true, opacity: 0.62, depthWrite: false }),
      );
      smoke.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 1.05, (Math.random() - 0.5) * 0.7));
      smoke.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.75 + Math.random() * 0.35, (Math.random() - 0.5) * 0.35);
      scene.add(smoke);
      addEffect({ mesh: smoke, life: 1.15, max: 1.15, grow: true, maxScale: 2.1 });
    };

    const createTacticalSmokePuff = (position: THREE.Vector3) => {
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.55 + Math.random() * 0.35, 8, 7),
        new THREE.MeshBasicMaterial({
          color: Math.random() > 0.45 ? 0x586361 : 0x3d4847,
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
        }),
      );
      smoke.position.copy(position);
      smoke.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.65,
        0.2 + Math.random() * 0.32,
        (Math.random() - 0.5) * 0.65,
      );
      scene.add(smoke);
      addEffect({ mesh: smoke, life: 2.5, max: 2.5, grow: true, maxScale: 2.8 });
    };

    const createConcreteDebris = (position: THREE.Vector3, count = 6) => {
      for (let index = 0; index < count; index += 1) {
        const chunk = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.11 + Math.random() * 0.2,
            0.08 + Math.random() * 0.18,
            0.1 + Math.random() * 0.22,
          ),
          new THREE.MeshStandardMaterial({
            color: Math.random() > 0.35 ? 0x777975 : 0x3b4041,
            roughness: 0.96,
            transparent: true,
          }),
        );
        chunk.position.copy(position);
        chunk.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 5.5,
          1.4 + Math.random() * 3.6,
          (Math.random() - 0.5) * 5.5,
        );
        chunk.userData.gravity = 9.8;
        chunk.userData.angularVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9,
        );
        chunk.castShadow = true;
        scene.add(chunk);
        addEffect({ mesh: chunk, life: 1.05 + Math.random() * 0.45, max: 1.5, maxScale: 1 });
      }
    };

    const createElectricSparks = (position: THREE.Vector3) => {
      for (let index = 0; index < 7; index += 1) {
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.035 + Math.random() * 0.025, 5, 5),
          new THREE.MeshBasicMaterial({ color: index % 2 ? 0x8ffcff : 0xffffff, transparent: true }),
        );
        spark.position.copy(position).add(new THREE.Vector3(0, 2.4 + Math.random(), 0));
        spark.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 4.2,
          1 + Math.random() * 3.5,
          (Math.random() - 0.5) * 4.2,
        );
        spark.userData.gravity = 7.5;
        scene.add(spark);
        addEffect({ mesh: spark, life: 0.28 + Math.random() * 0.28, max: 0.56, maxScale: 1.1 });
      }
      playWorldSound('electric-spark', position, 0.9);
    };

    const toppleUtilityPole = (pole: UtilityPole, impact: THREE.Vector3) => {
      if (pole.fallen) return;
      pole.fallen = true;
      pole.fallProgress = 0;
      pole.sparkTimer = 0.03;
      pole.thudPlayed = false;
      pole.fallDirection.set(pole.base.x - impact.x, pole.base.z - impact.z);
      if (pole.fallDirection.lengthSq() < 0.01) {
        const angle = Math.random() * Math.PI * 2;
        pole.fallDirection.set(Math.cos(angle), Math.sin(angle));
      } else {
        pole.fallDirection.normalize();
      }
      createElectricSparks(pole.base);
    };

    const createScorchMark = (building: CityBuilding, impact: THREE.Vector3) => {
      const { obstacle } = building;
      const x = clamp(impact.x, obstacle.minX, obstacle.maxX);
      const z = clamp(impact.z, obstacle.minZ, obstacle.maxZ);
      const xFace = Math.min(Math.abs(x - obstacle.minX), Math.abs(x - obstacle.maxX));
      const zFace = Math.min(Math.abs(z - obstacle.minZ), Math.abs(z - obstacle.maxZ));
      const mark = new THREE.Mesh(
        new THREE.CircleGeometry(0.35 + Math.random() * 0.32, 13),
        new THREE.MeshBasicMaterial({
          color: 0x171817,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          side: THREE.DoubleSide,
        }),
      );
      const height = clamp(impact.y, 0.35, building.height - 0.35);
      if (xFace < zFace) {
        const faceX = Math.abs(x - obstacle.minX) < Math.abs(x - obstacle.maxX)
          ? obstacle.minX - 0.012
          : obstacle.maxX + 0.012;
        mark.position.set(faceX, height, z);
        mark.rotation.y = Math.PI / 2;
      } else {
        const faceZ = Math.abs(z - obstacle.minZ) < Math.abs(z - obstacle.maxZ)
          ? obstacle.minZ - 0.012
          : obstacle.maxZ + 0.012;
        mark.position.set(x, height, faceZ);
      }
      mark.userData.impact = impact.clone();
      mark.userData.breachAxis = breachAxisForImpact(impact, obstacle);
      scene.add(mark);
      building.scorchMarks.push(mark);
      if (building.scorchMarks.length > 9) {
        const oldest = building.scorchMarks.shift();
        if (oldest) removeTransientObject(oldest);
      }
    };

    const updateBuildingBreachShader = (building: CityBuilding) => {
      const breachCount = Math.min(building.breaches.length, MAX_BUILDING_BREACHES);
      building.breachShader.count.value = breachCount;
      for (let index = 0; index < MAX_BUILDING_BREACHES; index += 1) {
        const breach = building.breaches[index];
        if (!breach) {
          building.breachShader.radii.value[index] = 0;
          continue;
        }
        building.breachShader.centers.value[index].set(
          breach.center.x,
          breach.center.y,
          breach.center.z,
        );
        building.breachShader.axes.value[index] = breach.axis === 'x' ? 0 : 1;
        building.breachShader.radii.value[index] = BREACH_RADIUS;
      }
    };

    const createBreachVisuals = (building: CityBuilding, breach: BuildingBreach) => {
      const center = new THREE.Vector3(breach.center.x, breach.center.y, breach.center.z);
      const tunnelLength = breach.axis === 'x' ? building.width + 0.16 : building.depth + 0.16;
      const tunnel = new THREE.Mesh(
        new THREE.CylinderGeometry(BREACH_RADIUS * 0.96, BREACH_RADIUS * 0.96, tunnelLength, 24, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x202323,
          metalness: 0.02,
          roughness: 1,
          side: THREE.BackSide,
        }),
      );
      tunnel.position.copy(center);
      if (breach.axis === 'x') tunnel.rotation.z = Math.PI / 2;
      else tunnel.rotation.x = Math.PI / 2;
      scene.add(tunnel);

      const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0x3c3f3d,
        metalness: 0.02,
        roughness: 0.98,
      });
      const faces = breach.axis === 'x'
        ? [building.obstacle.minX - 0.025, building.obstacle.maxX + 0.025]
        : [building.obstacle.minZ - 0.025, building.obstacle.maxZ + 0.025];
      faces.forEach((face, faceIndex) => {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(BREACH_RADIUS * 0.98, 0.075, 7, 24),
          rimMaterial,
        );
        if (breach.axis === 'x') {
          rim.position.set(face, center.y, center.z);
          rim.rotation.y = Math.PI / 2;
        } else {
          rim.position.set(center.x, center.y, face);
        }
        rim.rotation.z += (faceIndex ? -1 : 1) * 0.035;
        scene.add(rim);

        for (let chunkIndex = 0; chunkIndex < 10; chunkIndex += 1) {
          const angle = chunkIndex / 10 * Math.PI * 2 + Math.random() * 0.14;
          const radius = BREACH_RADIUS * (0.94 + Math.random() * 0.14);
          const chunk = new THREE.Mesh(
            new THREE.BoxGeometry(
              0.09 + Math.random() * 0.13,
              0.08 + Math.random() * 0.16,
              0.08 + Math.random() * 0.12,
            ),
            rimMaterial,
          );
          if (breach.axis === 'x') {
            chunk.position.set(
              face,
              center.y + Math.sin(angle) * radius,
              center.z + Math.cos(angle) * radius,
            );
          } else {
            chunk.position.set(
              center.x + Math.cos(angle) * radius,
              center.y + Math.sin(angle) * radius,
              face,
            );
          }
          chunk.rotation.set(Math.random(), Math.random(), Math.random());
          chunk.castShadow = true;
          scene.add(chunk);
        }
      });

      building.scorchMarks = building.scorchMarks.filter((mark) => {
        const markImpact = mark.userData.impact as THREE.Vector3 | undefined;
        const insideOpening = markImpact
          ? pointInsideBreach(markImpact, breach, BREACH_RADIUS * 1.08)
          : false;
        if (insideOpening) removeTransientObject(mark);
        return !insideOpening;
      });
      createConcreteDebris(center, 18);
      createExplosion(center, 0x8c8374);
      playWorldSound('concrete-impact', center, 1);
    };

    const registerBuildingBreachHit = (building: CityBuilding, impact: THREE.Vector3) => {
      const candidate = breachCenterForImpact(
        impact,
        building.obstacle,
        building.height,
      );
      const result = registerBreachHit(building.breachProgress, candidate);
      building.breachProgress = result.progress;
      if (!result.completed || building.breaches.length >= MAX_BUILDING_BREACHES) {
        breachMessage = `WALL BREACH · ${result.hits}/${BREACH_REQUIRED_HITS} HITS`;
        breachMessageTimer = 1.25;
        return;
      }

      building.breaches.push(result.completed);
      updateBuildingBreachShader(building);
      createBreachVisuals(building, result.completed);
      breachMessage = 'BREACH OPEN · FIRE THROUGH';
      breachMessageTimer = 2.4;
    };

    const projectileBlockedBySolidCover = (position: THREE.Vector3) => (
      obstacles.some((obstacle) => {
        if (
          position.y > obstacle.height
          || !projectileHitsObstacle(position, [obstacle])
        ) {
          return false;
        }
        const building = obstacle.buildingIndex === undefined
          ? undefined
          : cityBuildings[obstacle.buildingIndex];
        const passesThroughBreach = building?.breaches.some((breach) => (
          pointInsideBreach(position, breach, BREACH_RADIUS * 0.86)
        ));
        return !passesThroughBreach;
      })
    );

    const breachesForObstacle = (obstacle: DamageableObstacle) => (
      obstacle.buildingIndex === undefined
        ? []
        : cityBuildings[obstacle.buildingIndex]?.breaches ?? []
    );

    const tacticalEffectBlockedByCover = (
      from: { x: number; y?: number; z: number },
      target: { x: number; y?: number; z: number },
    ) => effectBlockedByCover(
      from,
      target,
      obstacles,
      breachesForObstacle,
      BREACH_RADIUS * 0.86,
    );

    const tankSightBlockedByCover = (
      observer: { x: number; y?: number; z: number },
      target: { x: number; y?: number; z: number },
    ) => effectBlockedByCover(
      {
        x: observer.x,
        y: (observer.y ?? 0) + 1.12,
        z: observer.z,
      },
      {
        x: target.x,
        y: (target.y ?? 0) + 0.85,
        z: target.z,
      },
      obstacles,
      breachesForObstacle,
      BREACH_RADIUS * 0.86,
      0,
    );

    const damageBuilding = (
      obstacle: DamageableObstacle,
      impact: THREE.Vector3,
      amount: number,
      impactSound = true,
      precisionHit = false,
    ) => {
      if (obstacle.buildingIndex === undefined) return;
      const building = cityBuildings[obstacle.buildingIndex];
      if (!building) return;
      building.damage = Math.min(building.maxDamage, building.damage + amount);
      const damageRatio = building.damage / building.maxDamage;
      const material = building.mesh.material as THREE.MeshStandardMaterial;
      material.color.copy(new THREE.Color(arena.colors.cover)).lerp(new THREE.Color(0x272b2b), damageRatio * 0.76);
      material.roughness = Math.min(1, 0.82 + damageRatio * 0.18);
      building.windows.forEach((window, index) => {
        window.visible = !window.userData.breached
          && index / Math.max(1, building.windows.length - 1) > damageRatio * 0.88;
      });
      building.roof.rotation.x = damageRatio * 0.035;
      building.roof.rotation.z = -damageRatio * 0.065;
      building.roof.position.y = building.height + 0.28 - damageRatio * 0.16;
      createScorchMark(building, impact);
      createConcreteDebris(impact, amount > 1.5 ? 10 : 6);
      if (impactSound) playWorldSound('concrete-impact', impact, 0.9);
      if (precisionHit) registerBuildingBreachHit(building, impact);
    };

    const damageEnvironment = (impact: THREE.Vector3, radius: number, maximumDamage: number) => {
      obstacles.forEach((obstacle) => {
        const damage = blastDamageForObstacle(impact, obstacle, radius, maximumDamage);
        if (damage > 0.05) damageBuilding(obstacle, impact, damage, false);
      });
      utilityPoles.forEach((pole) => {
        if (pole.fallen) return;
        const distance = Math.hypot(pole.base.x - impact.x, pole.base.z - impact.z);
        if (distance <= radius * 1.18) toppleUtilityPole(pole, impact);
      });
    };

    const createMortarTrail = (position: THREE.Vector3) => {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.72 }),
      );
      ember.position.copy(position);
      scene.add(ember);
      addEffect({ mesh: ember, life: 0.32, max: 0.32, grow: true, maxScale: 1.35 });
    };

    const tacticalNodes = arenaCover.flatMap(([x, z, width, , depth]) => {
      const clearance = 2.2;
      return [
        new THREE.Vector3(x + width / 2 + clearance, 0, z),
        new THREE.Vector3(x - width / 2 - clearance, 0, z),
        new THREE.Vector3(x, 0, z + depth / 2 + clearance),
        new THREE.Vector3(x, 0, z - depth / 2 - clearance),
      ];
    }).filter((candidate) => !tankPositionBlocked(candidate, obstacles));

    const chooseTacticalGoal = (enemy: Enemy, seekCover: boolean, flank = false) => {
      const currentPlayerDistance = enemy.mesh.position.distanceTo(player.position);
      const shouldHoldVisibleDistance = enemy.isDuelist
        && enemy.hasLineOfSight
        && enemyCannonInRange(currentPlayerDistance);
      if (flank) {
        const toEnemy = enemy.mesh.position.clone().sub(player.position).setY(0).normalize();
        const side = enemy.avoidDirection;
        const flankGoal = player.position.clone().add(new THREE.Vector3(
          -toEnemy.z * 15 * side + toEnemy.x * 7,
          0,
          toEnemy.x * 15 * side + toEnemy.z * 7,
        ));
        if (enemy.isDuelist) {
          const safeGoal = clampDuelGoalDistance(
            flankGoal,
            player.position,
            shouldHoldVisibleDistance
              ? Math.max(DUEL_MIN_DISTANCE, currentPlayerDistance - 0.35)
              : DUEL_MIN_DISTANCE,
          );
          flankGoal.set(safeGoal.x, 0, safeGoal.z);
        }
        const playableFlank = closestPointOnPlayableSurface(flankGoal, arenaSurfaces);
        flankGoal.set(playableFlank.x, 0, playableFlank.z);
        if (
          !tankPositionBlocked(flankGoal, obstacles)
          && (!enemy.isDuelist || flankGoal.distanceTo(player.position) >= DUEL_MIN_DISTANCE - 0.05)
        ) {
          return flankGoal;
        }
      }

      const candidates = tacticalNodes.filter((candidate) => (
        tankSightBlockedByCover(candidate, player.position) === seekCover
      ));
      const availablePool = candidates.length > 0 ? candidates : tacticalNodes;
      const reinforcementPool = availablePool.filter((candidate) => (
        candidate.distanceTo(player.position) < 44
      ));
      const pool = !enemy.isDuelist
        && enemy.role !== 'artillery'
        && enemy.mesh.position.distanceTo(player.position) > 50
        && reinforcementPool.length > 0
        ? reinforcementPool
        : availablePool;
      const duelSafePool = enemy.isDuelist
        ? pool.filter((candidate) => candidate.distanceTo(player.position) >= DUEL_MIN_DISTANCE)
        : pool;
      const scoringPool = duelSafePool.length > 0 ? duelSafePool : pool;
      let selected = scoringPool[0]?.clone() ?? enemy.coverPosition.clone();
      let selectedScore = Infinity;
      scoringPool.forEach((candidate) => {
        const travel = candidate.distanceTo(enemy.mesh.position);
        const playerDistance = candidate.distanceTo(player.position);
        const duelDistanceTarget = shouldHoldVisibleDistance
          ? currentPlayerDistance
          : 22;
        const roleBias = enemy.isDuelist
          ? Math.abs(playerDistance - duelDistanceTarget) * 0.8
          : enemy.role === 'marksman'
          ? Math.abs(playerDistance - 30) * 0.7
          : enemy.role === 'sprinter'
            ? Math.abs(playerDistance - 14) * 0.45
            : Math.abs(playerDistance - 22) * 0.35;
        const visibleClosingPenalty = shouldHoldVisibleDistance
          && playerDistance < currentPlayerDistance - 0.75
          ? 200 + (currentPlayerDistance - playerDistance) * 20
          : 0;
        const navigationNoise = Math.max(0.5, 5.5 - enemy.navigation * 4.5);
        const travelCost = travel * (1.35 - enemy.navigation * 0.55);
        const score = travelCost
          + roleBias
          + visibleClosingPenalty
          + Math.random() * navigationNoise;
        if (score < selectedScore) {
          selected = candidate.clone();
          selectedScore = score;
        }
      });
      if (enemy.isDuelist && selected.distanceTo(player.position) < DUEL_MIN_DISTANCE) {
        const safeGoal = clampDuelGoalDistance(selected, player.position);
        const playableGoal = closestPointOnPlayableSurface(safeGoal, arenaSurfaces);
        selected.set(playableGoal.x, 0, playableGoal.z);
      }
      return selected;
    };

    const setEnemyTactic = (enemy: Enemy, tactic: EnemyTactic) => {
      enemy.tactic = tactic;
      if (tactic === 'cover') {
        enemy.goalPosition.copy(chooseTacticalGoal(enemy, true));
        enemy.tacticTimer = enemy.isDuelist
          ? 0.72 + Math.random() * 0.32
          : 0.7 + enemy.coverDiscipline * 1.25 + Math.random() * 0.45;
      } else if (tactic === 'peek') {
        enemy.goalPosition.copy(chooseTacticalGoal(enemy, false));
        enemy.tacticTimer = enemy.isDuelist
          ? 0.52 + Math.random() * 0.28
          : 0.65 + (1 - enemy.coverDiscipline) * 0.75 + Math.random() * 0.65;
        enemy.cooldown = Math.min(enemy.cooldown, 0.28);
      } else if (tactic === 'flank') {
        enemy.goalPosition.copy(chooseTacticalGoal(enemy, false, true));
        enemy.tacticTimer = enemy.isDuelist
          ? 0.95 + Math.random() * 0.45
          : 2.5 - enemy.navigation * 0.7 + Math.random() * 0.8;
      } else if (tactic === 'relocate') {
        enemy.goalPosition.copy(chooseTacticalGoal(enemy, true));
        enemy.tacticTimer = enemy.isDuelist
          ? 0.55 + Math.random() * 0.3
          : 2.4 - enemy.navigation * 0.9 + Math.random() * 0.9;
      } else {
        enemy.goalPosition.copy(chooseTacticalGoal(enemy, false));
        enemy.tacticTimer = enemy.isDuelist
          ? 0.68 + Math.random() * 0.32
          : 1 + enemy.aggression * 0.8 + Math.random() * 0.7;
        enemy.cooldown = Math.min(enemy.cooldown, 0.2);
      }
    };

    const enemyMortarInFlight = () => shots.some((shot) => (
      shot.enemy && shot.weapon === 'mortar' && shot.life > 0
    ));

    const fireEnemyMortar = (source: Enemy) => {
      const activeEnemyMortars = enemyMortarInFlight() ? 1 : 0;
      const canLaunch = source.isDuelist
        ? activeEnemyMortars === 0 && source.mortarCooldown <= 0 && source.memoryTimer > 0
        : canLaunchEnemyMortar(
          source.role,
          activeEnemyMortars,
          source.mortarCooldown,
          source.memoryTimer,
        );
      if (!canLaunch) return false;
      const predicted = predictPlayerPosition(
        source.lastKnownPlayer,
        source.lastKnownVelocity,
        source.predictionLead,
        arena.bounds,
      );
      const target = new THREE.Vector3(predicted.x, 0.12, predicted.z);
      const origin = new THREE.Vector3();
      (source.mesh.userData.muzzle as THREE.Object3D).getWorldPosition(origin);
      const horizontalTarget = target.clone().sub(origin).setY(0);
      const distance = horizontalTarget.length();
      const flightTime = Math.max(
        ENEMY_MORTAR_WARNING_SECONDS,
        Math.min(1.55, 0.82 + distance / 70),
      );
      const gravity = 22;
      const velocity = new THREE.Vector3(
        horizontalTarget.x / flightTime,
        (target.y - origin.y + 0.5 * gravity * flightTime * flightTime) / flightTime,
        horizontalTarget.z / flightTime,
      );
      const enemyMortarRadius = ENEMY_MORTAR_RADIUS * (source.isDuelist ? currentEnemyPower() : 1);

      const marker = new THREE.Mesh(
        new THREE.RingGeometry(enemyMortarRadius * 0.78, enemyMortarRadius, 40),
        new THREE.MeshBasicMaterial({
          color: 0xff4c55,
          transparent: true,
          opacity: 0.64,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.copy(target).setY(0.035);
      scene.add(marker);

      const projectile = new THREE.Mesh(
        projectileGeometry.enemyMortar,
        projectileMaterial.enemyMortar,
      );
      projectile.userData.sharedResources = true;
      projectile.position.copy(origin);
      scene.add(projectile);
      shots.push({
        mesh: projectile,
        velocity,
        enemy: true,
        life: flightTime + 0.35,
        weapon: 'mortar',
        trail: 0,
        marker,
        source,
      });
      source.mortarCooldown = source.isDuelist
        ? (4.8 + Math.random() * 1.8) / currentEnemyPower()
        : enemyMortarCooldownAtPower(Math.random());
      source.shotsFired += 1;
      playWorldSound('mortar-launch', origin, 0.65);
      combatAudio.play('incoming-mortar', 0.78, ENEMY_MORTAR_WARNING_SECONDS);
      return true;
    };

    const detonateEnemyMortar = (shot: Shot) => {
      if (shot.mesh.userData.detonated) return;
      shot.mesh.userData.detonated = true;
      shot.life = 0;
      if (shot.marker) {
        removeTransientObject(shot.marker);
        shot.marker = undefined;
      }
      const impact = shot.mesh.position.clone().setY(0.08);
      createExplosion(impact, 0xff453e);
      createExplosion(impact, 0xff9850);
      playWorldSound('explosion', impact, 0.92);
      const enemyMortarRadius = ENEMY_MORTAR_RADIUS
        * (shot.source?.isDuelist ? currentEnemyPower() : 1);
      damageEnvironment(impact, enemyMortarRadius, 2.35);

      const shockwave = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.64, 32),
        new THREE.MeshBasicMaterial({
          color: 0xff4d50,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      shockwave.rotation.x = -Math.PI / 2;
      shockwave.position.copy(impact);
      scene.add(shockwave);
      addEffect({
        mesh: shockwave,
        life: 0.46,
        max: 0.46,
        grow: true,
        maxScale: enemyMortarRadius / 0.64 - 0.22,
      });

      const mortarDistance = Math.hypot(
        player.position.x - impact.x,
        player.position.z - impact.z,
      );
      const blockedByCover = tacticalEffectBlockedByCover(impact, player.position);
      const withinBlastRadius = shot.source?.isDuelist
        ? mortarDistance <= enemyMortarRadius
        : enemyMortarHitsPlayer(mortarDistance);
      const hitPlayer = withinBlastRadius && !blockedByCover;
      if (hitPlayer) {
        lives = Math.max(0, lives - 1);
        if (shot.source) {
          shot.source.fitness += enemyCombatOutcomeFitness('mortar-hit');
          shot.source.mortarHits += 1;
        }
        damageShake = 1;
        combatAudio.play('tank-hit', 0.92);
        onPlayerDamage();
      } else if (shot.source) {
        shot.source.fitness += enemyCombatOutcomeFitness('mortar-miss');
      }
    };

    const destroyEnemy = (enemy: Enemy) => {
      if (!enemies.includes(enemy)) return;
      enemy.hp = 0;
      score += 500 + wave * 70;
      best = Math.max(best, enemy.fitness);
      if (usesGeneticEvolution(mode)) {
        generationResults.push({
          genome: enemy.genome,
          fitness: enemy.fitness,
          stats: {
            survivalSeconds: enemy.survivalSeconds,
            shotsFired: enemy.shotsFired,
            cannonHits: enemy.cannonHits,
            mortarHits: enemy.mortarHits,
            damageTaken: enemy.damageTaken,
          },
        });
      }
      removeTransientObject(enemy.mesh);
      enemies = enemies.filter((candidate) => candidate !== enemy);
      if (enemy.role === 'artillery' || enemy.isDuelist) {
        shots.filter((shot) => shot.source === enemy && shot.weapon === 'mortar').forEach((shot) => {
          shot.life = 0;
          removeTransientObject(shot.mesh);
          if (shot.marker) removeTransientObject(shot.marker);
        });
      }
      createExplosion(enemy.mesh.position);
      playWorldSound('tank-destroyed', enemy.mesh.position, 1);
    };

    const woundEnemy = (enemy: Enemy) => {
      if (enemy.wounded) return;
      enemy.wounded = true;
      enemy.smokeTimer = 0;
      const bodyMaterial = enemy.mesh.userData.bodyMaterial as THREE.MeshStandardMaterial;
      const glowMaterial = enemy.mesh.userData.glowMaterial as THREE.MeshStandardMaterial;
      bodyMaterial.color.setHex(0x71332f);
      glowMaterial.color.setHex(0xff6b38);
      glowMaterial.emissive.setHex(0xff351f);
      createSmoke(enemy.mesh.position);
    };

    const playerViewOrigin = () => player.position.clone().add(
      new THREE.Vector3(0, 1.45, -0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), aimAngle),
    );

    const syncPlayerCannonToView = () => {
      player.rotation.y = aimAngle;
      (player.userData.turret as THREE.Object3D).rotation.y = 0;
      (player.userData.gunPitch as THREE.Object3D).rotation.x = clampCannonPitch(aimPitch);
      player.updateMatrixWorld(true);
    };

    const playerAimTarget = (origin: THREE.Vector3, mortarShot: boolean) => {
      raycaster.setFromCamera(pointer, camera);
      const horizontalTarget = new THREE.Vector3();

      if (!mortarShot && cameraMode === 1) {
        const viewDirection = cannonDirectionForAngles(aimAngle, aimPitch);
        const target = convergedCannonTarget(origin, playerViewOrigin(), viewDirection);
        return horizontalTarget.set(target.x, target.y, target.z);
      }

      if (mortarShot && cameraMode === 1) {
        // POV elevation already rotates the camera/barrel. Use tank yaw for
        // the horizontal direction so screen-ray pitch is not applied twice.
        horizontalTarget.set(-Math.sin(aimAngle), 0, -Math.cos(aimAngle));
        const availableRange = playableRayDistance(
          origin,
          horizontalTarget,
          arenaSurfaces,
          currentPlayerMortarRange(),
        );
        const elevation = clamp(aimPitch, 0, Math.PI / 2);
        const launchHeight = Math.max(0, origin.y - 0.12);
        const physicalRange = mortarRangeForElevation(elevation, availableRange, launchHeight);
        horizontalTarget.multiplyScalar(physicalRange);
        const intendedLanding = {
          x: origin.x + horizontalTarget.x,
          z: origin.z + horizontalTarget.z,
        };
        const playableLanding = closestPointOnPlayableSurface(intendedLanding, arenaSurfaces);
        horizontalTarget.set(playableLanding.x - origin.x, 0, playableLanding.z - origin.z);
        return horizontalTarget;
      }

      const enemyMeshes = enemies.map((enemy) => enemy.mesh);
      const targetHit = raycaster.intersectObjects(enemyMeshes, true)[0];
      const floorTarget = targetHit
        ? null
        : raycaster.ray.intersectPlane(aimingPlane, new THREE.Vector3());

      if (targetHit) {
        horizontalTarget.copy(targetHit.point).sub(origin);
        if (mortarShot) horizontalTarget.y = 0;
      } else if (floorTarget) {
        horizontalTarget.copy(floorTarget).sub(origin);
        if (mortarShot) horizontalTarget.y = 0;
        if (mortarShot && horizontalTarget.lengthSq() > 0.0001) {
          const distance = cameraMode === 0
            ? mortarTacticalDistance(
              pointer.x,
              pointer.y,
              horizontalTarget.length(),
              currentPlayerMortarRange(),
            )
            : mortarAimDistance(horizontalTarget.length(), currentPlayerMortarRange());
          horizontalTarget.setLength(distance);
        }
      } else {
        horizontalTarget.copy(raycaster.ray.direction);
        if (mortarShot) horizontalTarget.y = 0;
        if (horizontalTarget.lengthSq() < 0.0001) {
          horizontalTarget.set(-Math.sin(aimAngle), 0, -Math.cos(aimAngle));
        }
        horizontalTarget.normalize().multiplyScalar(
          mortarShot ? mortarAimDistance(null, currentPlayerMortarRange()) : 28,
        );
      }

      if (mortarShot && horizontalTarget.length() > currentPlayerMortarRange()) {
        horizontalTarget.setLength(currentPlayerMortarRange());
      }
      if (mortarShot) {
        const playableTarget = closestPointOnPlayableSurface({
          x: origin.x + horizontalTarget.x,
          z: origin.z + horizontalTarget.z,
        }, arenaSurfaces);
        horizontalTarget.set(playableTarget.x - origin.x, 0, playableTarget.z - origin.z);
      }
      return horizontalTarget;
    };

    const detonateTacticalGrenade = (grenade: TacticalGrenade) => {
      const impact = grenade.mesh.position.clone();
      impact.y = Math.max(0.14, impact.y);
      grenade.life = 0;
      const tacticalPower = grenade.enemy
        ? grenade.source?.isDuelist ? currentEnemyPower() : 1
        : currentPlayerPower();
      if (grenade.kind === 'smoke') {
        const smokeRadius = SMOKE_RADIUS * tacticalPower;
        const smokeDuration = SMOKE_DURATION * tacticalPower;
        smokeZones.push({
          center: impact.clone(),
          radius: smokeRadius,
          life: smokeDuration,
          maxLife: smokeDuration,
          puffTimer: 0,
          enemy: grenade.enemy,
        });
        for (let index = 0; index < 16; index += 1) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.sqrt(Math.random()) * smokeRadius * 0.7;
          createTacticalSmokePuff(new THREE.Vector3(
            impact.x + Math.cos(angle) * distance,
            0.18 + Math.random() * 0.8,
            impact.z + Math.sin(angle) * distance,
          ));
        }
        const boundary = new THREE.Mesh(
          new THREE.RingGeometry(smokeRadius * 0.88, smokeRadius, 40),
          new THREE.MeshBasicMaterial({
            color: 0xa5bbb4,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        boundary.rotation.x = -Math.PI / 2;
        boundary.position.copy(impact).setY(0.035);
        scene.add(boundary);
        addEffect({ mesh: boundary, life: 1.15, max: 1.15, grow: true, maxScale: 1.08 });
        playWorldSound('smoke-grenade', impact, 0.86);
        countermeasureMessage = grenade.enemy
          ? 'ENEMY SMOKE DEPLOYED · VISIBILITY LOST'
          : 'SMOKE SCREEN ACTIVE · MORTAR LOCK BLOCKED';
        countermeasureMessageTimer = 2.2;
        return;
      }

      let flashed = 0;
      let artilleryFlashed = false;
      if (grenade.enemy) {
        const playerDistance = Math.hypot(
          player.position.x - impact.x,
          player.position.z - impact.z,
        );
        const blockedByCover = tacticalEffectBlockedByCover(impact, player.position);
        const blindDuration = flashBlindDuration(playerDistance / tacticalPower, blockedByCover)
          * ENEMY_FLASH_DURATION_MULTIPLIER
          * tacticalPower;
        if (blindDuration > 0) {
          playerBlindTimer = Math.max(playerBlindTimer, blindDuration);
          playerFireCooldown = Math.max(playerFireCooldown, blindDuration);
          fireHeld = false;
          mortarBurstRemaining = 0;
          onPlayerFlash();
          countermeasureMessage = `FLASHED · WEAPONS OFFLINE ${blindDuration.toFixed(1)}S`;
        } else {
          countermeasureMessage = 'ENEMY FLASH DETONATED · COVER PROTECTED YOU';
        }
      } else {
        enemies.forEach((enemy) => {
          const distance = Math.hypot(
            enemy.mesh.position.x - impact.x,
            enemy.mesh.position.z - impact.z,
          );
          const blockedByCover = tacticalEffectBlockedByCover(impact, enemy.mesh.position);
          const blindDuration = flashBlindDuration(distance / tacticalPower, blockedByCover)
            * tacticalPower;
          if (blindDuration <= 0) return;
          flashed += 1;
          artilleryFlashed ||= enemy.role === 'artillery';
          enemy.blindTimer = Math.max(enemy.blindTimer, blindDuration);
          enemy.memoryTimer = 0;
          enemy.cooldown = Math.max(enemy.cooldown, blindDuration + 0.5);
          enemy.mortarCooldown = Math.max(enemy.mortarCooldown, blindDuration + 1.25);
          setEnemyTactic(enemy, 'relocate');
        });
      }
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 14, 10),
        new THREE.MeshBasicMaterial({
          color: 0xf5ffff,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
        }),
      );
      flash.position.copy(impact).setY(1.1);
      flash.add(new THREE.PointLight(0xeaffff, 24, FLASH_RADIUS * 1.8));
      scene.add(flash);
      addEffect({ mesh: flash, life: 0.42, max: 0.42, grow: true, maxScale: FLASH_RADIUS * 1.3 });
      createExplosion(impact, 0xeaffff);
      playWorldSound('flashbang', impact, 1);
      if (!grenade.enemy) {
        countermeasureMessage = artilleryFlashed
          ? 'ENEMY ARTILLERY BLINDED'
          : flashed > 0
            ? `${flashed} HOSTILE${flashed === 1 ? '' : 'S'} BLINDED`
            : 'FLASH BLOCKED · NO HOSTILES EXPOSED';
      }
      countermeasureMessageTimer = 2.2;
    };

    const launchTacticalGrenade = (
      kind: TacticalGrenade['kind'],
      origin: THREE.Vector3,
      target: THREE.Vector3,
      enemy: boolean,
      source?: Enemy,
    ) => {
      const throwDistance = Math.hypot(target.x - origin.x, target.z - origin.z);
      const flightTime = enemy
        ? 0.3 + throwDistance / 110
        : 0.64 + throwDistance / 58;
      const gravity = 18;
      const velocity = target.clone().sub(origin);
      velocity.x /= flightTime;
      velocity.z /= flightTime;
      velocity.y = (target.y - origin.y + 0.5 * gravity * flightTime * flightTime) / flightTime;
      const grenadeColor = enemy
        ? kind === 'smoke' ? 0xd69c45 : 0xff765f
        : kind === 'smoke' ? 0x82958a : 0xd9f7ef;
      const grenade = new THREE.Mesh(
        kind === 'smoke'
          ? new THREE.CylinderGeometry(0.13, 0.16, 0.38, 10)
          : new THREE.IcosahedronGeometry(0.2, 1),
        new THREE.MeshStandardMaterial({
          color: grenadeColor,
          emissive: enemy ? 0xa52d22 : kind === 'flash' ? 0x8acfc7 : 0x263832,
          emissiveIntensity: kind === 'flash' ? 1.8 : 0.35,
          metalness: 0.62,
          roughness: 0.42,
        }),
      );
      grenade.position.copy(origin);
      grenade.castShadow = true;
      grenade.add(new THREE.PointLight(grenadeColor, kind === 'flash' ? 5 : 1.2, 4));
      scene.add(grenade);
      tacticalGrenades.push({
        mesh: grenade,
        velocity,
        kind,
        life: flightTime + 0.35,
        enemy,
        source,
      });
      playWorldSound(kind === 'smoke' ? 'smoke-grenade' : 'flashbang', origin, 0.48);
    };

    const throwTacticalGrenade = (kind: TacticalGrenade['kind']) => {
      if (!activeRef.current || gameEnded || deploymentTimer > 0 || playerBlindTimer > 0) return false;
      const available = kind === 'smoke' ? smokeGrenades : flashGrenades;
      if (available <= 0) {
        countermeasureMessage = `${kind === 'smoke' ? 'SMOKE' : 'FLASH'} GRENADES DEPLETED`;
        countermeasureMessageTimer = 1.7;
        return false;
      }

      const origin = player.position.clone().add(new THREE.Vector3(0, 1.35, 0));
      const horizontalTarget = playerAimTarget(origin, false);
      const throwDistance = clampTacticalThrowDistance(horizontalTarget.length())
        * currentPlayerPower();
      if (horizontalTarget.lengthSq() < 0.0001) {
        horizontalTarget.set(-Math.sin(aimAngle), 0, -Math.cos(aimAngle));
      } else {
        horizontalTarget.normalize();
      }
      horizontalTarget.multiplyScalar(throwDistance);
      const target = origin.clone().add(horizontalTarget).setY(0.14);
      const playableTarget = closestPointOnPlayableSurface(target, arenaSurfaces);
      target.set(playableTarget.x, 0.14, playableTarget.z);
      launchTacticalGrenade(kind, origin, target, false);
      if (kind === 'smoke') smokeGrenades -= 1;
      else flashGrenades -= 1;
      countermeasureMessage = `${kind === 'smoke' ? 'SMOKE' : 'FLASH'} OUT · ${available - 1} LEFT`;
      countermeasureMessageTimer = 1.35;
      return true;
    };

    const throwEnemyTacticalGrenade = (
      source: Enemy,
      kind: TacticalGrenade['kind'],
      desiredTarget: THREE.Vector3,
    ) => {
      const available = kind === 'smoke' ? source.smokeGrenades : source.flashGrenades;
      if (available <= 0 || source.blindTimer > 0 || source.grenadeCooldown > 0) return false;
      const origin = source.mesh.position.clone().add(new THREE.Vector3(0, 1.45, 0));
      const horizontalTarget = desiredTarget.clone().sub(origin).setY(0);
      const tacticalRange = source.isDuelist
        ? DUEL_TACTICAL_GRENADE_RANGE * currentEnemyPower()
        : ENEMY_TACTICAL_GRENADE_RANGE;
      if (horizontalTarget.lengthSq() > tacticalRange ** 2) {
        horizontalTarget.setLength(tacticalRange);
      }
      const target = origin.clone().add(horizontalTarget).setY(0.14);
      const playableTarget = closestPointOnPlayableSurface(target, arenaSurfaces);
      target.set(playableTarget.x, 0.14, playableTarget.z);
      launchTacticalGrenade(kind, origin, target, true, source);
      if (kind === 'smoke') source.smokeGrenades -= 1;
      else source.flashGrenades -= 1;
      source.grenadeCooldown = (4.2 + Math.random() * 2.8)
        / (source.isDuelist ? currentEnemyPower() : 1);
      countermeasureMessage = kind === 'flash'
        ? 'ENEMY FLASH INBOUND · TAKE COVER'
        : 'TACTICAL CARRIER DEPLOYING SMOKE';
      countermeasureMessageTimer = 1.65;
      return true;
    };

    const detonateMortar = (shot: Shot) => {
      if (shot.mesh.userData.detonated) return;
      shot.mesh.userData.detonated = true;
      shot.life = 0;
      const impact = shot.mesh.position.clone();
      impact.y = 0.08;
      createExplosion(impact, 0xff8a2b);
      createExplosion(impact, 0xffd36a);
      playWorldSound('explosion', impact, 1);
      const playerPower = currentPlayerMortarPower();
      const playerMortarSplashRadius = MORTAR_SPLASH_RADIUS * playerPower;
      damageEnvironment(impact, playerMortarSplashRadius, 4.4 * playerPower);

      const shockwave = new THREE.Mesh(
        new THREE.RingGeometry(0.48, 0.72, 32),
        new THREE.MeshBasicMaterial({ color: 0xffa13a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      );
      shockwave.rotation.x = -Math.PI / 2;
      shockwave.position.copy(impact);
      scene.add(shockwave);
      addEffect({
        mesh: shockwave,
        life: 0.48,
        max: 0.48,
        grow: true,
        maxScale: playerMortarSplashRadius / 0.72 - 0.22,
      });

      [...enemies].forEach((enemy) => {
        const distance = Math.hypot(
          enemy.mesh.position.x - impact.x,
          enemy.mesh.position.z - impact.z,
        );
        const blockedByCover = tacticalEffectBlockedByCover(impact, enemy.mesh.position);
        const damage = mortarBlastDamage(distance / playerPower, blockedByCover);
        if (damage === 0) return;

        enemy.hp = Math.max(0, enemy.hp - damage);
        enemy.damageTaken += damage;
        if (enemy.isDuelist) enemy.damageResponseTimer = 1.4;
        enemy.fitness -= damage * 4;
        score += damage === 2 ? 70 : 90;
        if (enemy.hp <= 0) destroyEnemy(enemy);
        else woundEnemy(enemy);
      });
    };

    const fire = (
      enemyShot = false,
      source?: Enemy,
      bypassCooldown = false,
      targetOverride?: THREE.Vector3,
    ) => {
      if (!activeRef.current || deploymentTimer > 0) return false;
      if (!enemyShot && playerBlindTimer > 0) return false;
      if (!enemyShot && playerFireCooldown > 0 && !bypassCooldown) return false;
      const mortarShot = !enemyShot && weaponMode === 'mortar';
      if (mortarShot && mortarAmmo <= 0) return false;
      const origin = new THREE.Vector3();
      if (enemyShot) {
        (source!.mesh.userData.muzzle as THREE.Object3D).getWorldPosition(origin);
      } else if (cameraMode === 1 && mortarShot) {
        cockpitMuzzle.getWorldPosition(origin);
      } else {
        if (cameraMode === 1 && !mortarShot) syncPlayerCannonToView();
        (player.userData.muzzle as THREE.Object3D).getWorldPosition(origin);
      }
      const direction = new THREE.Vector3();
      let velocity = new THREE.Vector3();
      let projectileLife = 2.5;
      if (enemyShot) {
        direction.copy(targetOverride ?? player.position).sub(origin);
        const targetDistance = direction.length();
        direction.normalize();
        direction.x += (Math.random() - 0.5) * (1 - source!.accuracy) * 0.5;
        direction.z += (Math.random() - 0.5) * (1 - source!.accuracy) * 0.5;
        direction.normalize();
        velocity = direction.clone().multiplyScalar(source!.projectileSpeed);
        projectileLife = enemyCannonProjectileLife(targetDistance, source!.projectileSpeed);
      } else {
        const horizontalTarget = playerAimTarget(origin, mortarShot);
        direction.copy(horizontalTarget).normalize();

        if (mortarShot) {
          const distance = horizontalTarget.length();
          mortarRange = distance;
          const gravity = 22;
          let flightTime = 0;
          if (cameraMode === 1) {
            const elevation = clamp(aimPitch, 0, Math.PI / 2);
            mortarElevation = THREE.MathUtils.radToDeg(elevation);
            const horizontalDirection = horizontalTarget.clone();
            if (horizontalDirection.lengthSq() < 0.0001) {
              horizontalDirection.set(-Math.sin(aimAngle), 0, -Math.cos(aimAngle));
            } else {
              horizontalDirection.normalize();
            }
            const availableRange = playableRayDistance(
              origin,
              horizontalDirection,
              arenaSurfaces,
              currentPlayerMortarRange(),
            );
            const launchHeight = Math.max(0, origin.y - 0.12);
            if (distance < 0.0001) {
              const launchSpeed = mortarLaunchSpeed(availableRange, launchHeight, gravity);
              const verticalSpeed = launchSpeed * Math.sin(elevation);
              velocity.set(0, verticalSpeed, 0);
              flightTime = gravity > 0
                ? (verticalSpeed + Math.sqrt(verticalSpeed * verticalSpeed + 2 * gravity * launchHeight)) / gravity
                : 0;
            } else {
              const elevationTangent = Math.tan(elevation);
              flightTime = gravity > 0
                ? Math.sqrt(2 * Math.max(0, launchHeight + distance * elevationTangent) / gravity)
                : 0;
              const horizontalSpeed = flightTime > 0 ? distance / flightTime : 0;
              velocity.copy(horizontalDirection).multiplyScalar(horizontalSpeed);
              velocity.y = horizontalSpeed * elevationTangent;
            }
          } else {
            mortarElevation = 45;
            flightTime = mortarFlightDuration(distance);
            velocity.set(
              horizontalTarget.x / flightTime,
              (0.12 - origin.y + 0.5 * gravity * flightTime * flightTime) / flightTime,
              horizontalTarget.z / flightTime,
            );
          }
          projectileLife = flightTime + 0.9;
        } else {
          velocity = direction.clone().multiplyScalar(30 * currentPlayerPower());
        }
      }

      const projectileKind = mortarShot ? 'mortar' : enemyShot ? 'enemyCannon' : 'playerCannon';
      const projectile = new THREE.Mesh(
        projectileGeometry[projectileKind],
        projectileMaterial[projectileKind],
      );
      projectile.userData.sharedResources = true;
      projectile.position.copy(origin).addScaledVector(direction, mortarShot ? 0.45 : 0.28);
      scene.add(projectile);
      shots.push({
        mesh: projectile,
        velocity,
        enemy: enemyShot,
        life: mortarShot || enemyShot ? projectileLife : 2.5,
        weapon: mortarShot ? 'mortar' : 'cannon',
        trail: 0,
        source: enemyShot ? source : undefined,
      });

      const flashColor = enemyShot ? 0xff5a42 : mortarShot ? 0xffbd55 : 0x7dfff3;
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(mortarShot ? 0.5 : 0.32, 8, 8),
        new THREE.MeshBasicMaterial({ color: flashColor, transparent: true }),
      );
      flash.position.copy(projectile.position);
      scene.add(flash);
      addEffect({ mesh: flash, life: 0.16, max: 0.16 });
      if (mortarShot) playWorldSound('mortar-launch', origin, 0.95);
      else if (enemyShot) playWorldSound('enemy-cannon', origin, 0.82);
      else playWorldSound('player-cannon', origin, 1);
      if (!enemyShot) {
        weaponRecoil = mortarShot ? 0.48 : 0.3;
          playerFireCooldown = mortarShot
            ? 0.72 / currentPlayerMortarPower()
            : duelMode
              ? PLAYER_CANNON_FIRE_INTERVAL / currentPlayerPower()
              : playerCannonFireIntervalForGeneration(wave);
        if (mortarShot) {
          mortarAmmo -= 1;
          if (mortarRecharge <= 0) {
            mortarRecharge = 6 / currentPlayerMortarPower();
          }
        }
      }
      return true;
    };

    const beginMortarBurst = () => {
      if (
        weaponMode !== 'mortar'
        || deploymentTimer > 0
        || playerFireCooldown > 0
        || mortarBurstRemaining > 0
      ) return;
      mortarBurstRemaining = mortarBurstCount(mortarAmmo);
      mortarBurstTimer = 0;
    };

    const tryMoveTank = (tank: THREE.Group, x: number, z: number) => {
      const tankBlockedAt = (candidate: THREE.Vector3, elevation: number) => {
        const blockingObstacles = obstacles.filter((obstacle) => !rampClearsBuilding(
          candidate,
          elevation,
          obstacle.coverIndex,
          arenaRamps,
        ));
        return tankPositionBlocked(candidate, blockingObstacles);
      };
      const attemptMove = (nextX: number, nextZ: number) => {
        const previous = tank.position.clone();
        const activeCoverIndex = typeof tank.userData.activeRampCoverIndex === 'number'
          ? tank.userData.activeRampCoverIndex as number
          : undefined;
        const target = {
          x: clamp(nextX, arena.bounds.minX, arena.bounds.maxX),
          z: clamp(nextZ, arena.bounds.minZ, arena.bounds.maxZ),
        };
        const rampMovement = rampMovementDecision(
          previous,
          target,
          activeCoverIndex,
          arenaRamps,
        );
        if (!rampMovement.allowed) return;
        tank.position.set(target.x, rampMovement.elevation, target.z);
        if (
          !positionOnPlayableSurface(tank.position, arenaSurfaces)
          || tankBlockedAt(tank.position, tank.position.y)
        ) {
          tank.position.copy(previous);
          return;
        }
        tank.userData.activeRampCoverIndex = rampMovement.activeCoverIndex;
      };

      attemptMove(x, tank.position.z);
      attemptMove(tank.position.x, z);
    };

    const requestMouseCapture = async () => {
      try {
        await host.requestPointerLock();
      } catch {
        pointerLockUnavailable = true;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      combatAudio.unlock();
      keys.add(event.code);
      if (event.code === 'KeyM' && !event.repeat) combatAudio.toggleMuted();
      if (event.code === 'KeyV' && !event.repeat && activeRef.current) {
        cameraMode = (cameraMode + 1) % 2;
        pointer.set(0, 0);
        document.documentElement.style.setProperty('--aim-x', '50vw');
        document.documentElement.style.setProperty('--aim-y', '50vh');
        if (cameraMode === 0) {
          tacticalPanX = 0;
          tacticalPanZ = 0;
          if (document.pointerLockElement === host) document.exitPointerLock();
        } else if (!pointerLocked && !pointerLockUnavailable) {
          if (weaponMode === 'mortar') aimPitch = Math.PI / 4;
          void requestMouseCapture();
        }
      }
      if (event.code === 'KeyQ' && !event.repeat && activeRef.current) {
        weaponMode = weaponMode === 'cannon' ? 'mortar' : 'cannon';
        if (weaponMode === 'mortar' && cameraMode === 1 && !pointerLocked) {
          aimPitch = (pointer.y + 1) * Math.PI / 4;
        } else if (weaponMode === 'cannon') {
          aimPitch = clampCannonPitch(aimPitch);
        }
        fireHeld = false;
        mortarBurstRemaining = 0;
        playerFireCooldown = Math.min(playerFireCooldown, 0.18);
      }
      if (event.code === 'KeyC' && !event.repeat) throwTacticalGrenade('smoke');
      if (event.code === 'KeyF' && !event.repeat) throwTacticalGrenade('flash');
      if (event.code === 'KeyR') {
        tacticalPanX = 0;
        tacticalPanZ = 0;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onMouseMove = (event: MouseEvent) => {
      if (pointerLocked && cameraMode === 1) {
        aimAngle -= event.movementX * 0.0024;
        const minimumPitch = weaponMode === 'mortar' ? 0 : CANNON_MIN_PITCH;
        const maximumPitch = weaponMode === 'mortar' ? Math.PI / 2 : CANNON_MAX_PITCH;
        aimPitch = clamp(aimPitch - event.movementY * 0.0019, minimumPitch, maximumPitch);
        pointer.set(0, 0);
        document.documentElement.style.setProperty('--aim-x', '50vw');
        document.documentElement.style.setProperty('--aim-y', '50vh');
        aimEngaged = true;
        return;
      }
      if (pointerLocked) return;
      const bounds = host.getBoundingClientRect();
      pointer.x = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
      pointer.y = clamp(-((event.clientY - bounds.top) / bounds.height * 2 - 1), -1, 1);
      aimPitch = weaponMode === 'mortar' && cameraMode === 1
        ? (pointer.y + 1) * Math.PI / 4
        : weaponMode === 'cannon'
          ? cannonPitchFromPointer(pointer.y)
          : clamp(pointer.y * 0.08, -0.08, 0.08);
      document.documentElement.style.setProperty('--aim-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--aim-y', `${event.clientY}px`);
      aimEngaged = true;
    };
    const onPointerLockChange = () => {
      pointerLocked = document.pointerLockElement === host;
      if (pointerLocked) {
        pointer.set(0, 0);
        document.documentElement.style.setProperty('--aim-x', '50vw');
        document.documentElement.style.setProperty('--aim-y', '50vh');
        aimEngaged = true;
      }
    };
    const onPointerLockError = () => { pointerLockUnavailable = true; };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) combatAudio.unlock();
      const target = event.target as Element | null;
      if (event.button !== 0 || !activeRef.current || target?.closest('[data-game-ui]')) return;
      fireHeld = true;
      if (cameraMode === 1 && !pointerLocked && !pointerLockUnavailable) {
        void requestMouseCapture();
      }
      aimEngaged = true;
      if (weaponMode === 'mortar') beginMortarBurst();
      else fire(false);
    };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 0) fireHeld = false;
    };

    addEventListener('keydown', onKeyDown);
    addEventListener('keyup', onKeyUp);
    host.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
    spawnWave();

    let animationFrame = 0;
    const loop = (now: number) => {
      animationFrame = requestAnimationFrame(loop);
      const deltaTime = Math.min((now - lastFrame) / 1000, 0.04);
      lastFrame = now;

      if (activeRef.current) {
        if (!started) {
          started = true;
          deploymentTimer = DEPLOYMENT_SECONDS;
        }

        const deploying = deploymentTimer > 0;
        if (deploying) deploymentTimer = Math.max(0, deploymentTimer - deltaTime);
        breachMessageTimer = Math.max(0, breachMessageTimer - deltaTime);
        countermeasureMessageTimer = Math.max(0, countermeasureMessageTimer - deltaTime);
        playerBlindTimer = Math.max(0, playerBlindTimer - deltaTime);
        playerFireCooldown = Math.max(0, playerFireCooldown - deltaTime);
        damageShake = Math.max(0, damageShake - deltaTime * 3.4);
        if (mortarAmmo < mortarMaxAmmo) {
          mortarRecharge -= deltaTime;
          if (mortarRecharge <= 0) {
            mortarAmmo += 1;
            mortarRecharge = mortarAmmo < mortarMaxAmmo
              ? 6 / currentPlayerMortarPower()
              : 0;
          }
        } else {
          mortarRecharge = 0;
        }
        if (!deploying && mortarBurstRemaining > 0) {
          mortarBurstTimer -= deltaTime;
          if (mortarBurstTimer <= 0) {
            if (fire(false, undefined, true)) {
              mortarBurstRemaining -= 1;
              mortarBurstTimer = MORTAR_BURST_INTERVAL
                / currentPlayerMortarPower();
            } else {
              mortarBurstRemaining = 0;
            }
          }
        }
        if (!deploying && fireHeld && (cameraMode === 0 || pointerLocked || pointerLockUnavailable)) {
          if (weaponMode === 'mortar') beginMortarBurst();
          else fire(false);
        }

        tacticalGrenades.forEach((grenade) => {
          if (grenade.life <= 0) return;
          grenade.life -= deltaTime;
          grenade.velocity.y -= 18 * deltaTime;
          grenade.mesh.position.addScaledVector(grenade.velocity, deltaTime);
          grenade.mesh.rotation.x += deltaTime * 8.5;
          grenade.mesh.rotation.z += deltaTime * 6.2;
          if (
            projectileBlockedBySolidCover(grenade.mesh.position)
            || grenade.mesh.position.y <= 0.14
            || grenade.life <= 0
          ) {
            detonateTacticalGrenade(grenade);
          }
        });
        for (let grenadeIndex = tacticalGrenades.length - 1; grenadeIndex >= 0; grenadeIndex -= 1) {
          const grenade = tacticalGrenades[grenadeIndex];
          if (grenade.life > 0) continue;
          removeTransientObject(grenade.mesh);
          tacticalGrenades.splice(grenadeIndex, 1);
        }

        smokeZones.forEach((zone) => {
          zone.life -= deltaTime;
          zone.puffTimer -= deltaTime;
          if (zone.puffTimer > 0 || zone.life <= 0) return;
          for (let puff = 0; puff < 1; puff += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * zone.radius * 0.76;
            createTacticalSmokePuff(new THREE.Vector3(
              zone.center.x + Math.cos(angle) * distance,
              0.16 + Math.random() * 1.05,
              zone.center.z + Math.sin(angle) * distance,
            ));
          }
          zone.puffTimer = TACTICAL_SMOKE_PUFF_INTERVAL;
        });
        smokeZones = smokeZones.filter((zone) => zone.life > 0);
        playerSmokeTimer = enemySmokeExposureSeconds(
          player.position,
          smokeZones,
          (zone) => tacticalEffectBlockedByCover(zone.center, player.position),
        );

        if (cameraMode === 1 && !pointerLocked) {
          const edgeTurn = Math.max(0, Math.abs(pointer.x) - 0.58) / 0.42;
          if (edgeTurn > 0) aimAngle -= Math.sign(pointer.x) * edgeTurn * deltaTime * 1.65;
        }

        player.rotation.y = aimAngle;
        aimingPlane.constant = -(player.position.y + 0.92);
        raycaster.setFromCamera(pointer, camera);
        const floorAim = raycaster.ray.intersectPlane(aimingPlane, aimIntersection);
        const turretOrigin = turretOriginScratch.set(
          player.position.x,
          player.position.y + 1.12,
          player.position.z,
        );
        const turretAim = floorAim
          ? turretAimScratch.copy(floorAim).sub(turretOrigin)
          : turretAimScratch.copy(raycaster.ray.direction);
        const horizontalAim = horizontalAimScratch.copy(turretAim).setY(0);
        if (horizontalAim.lengthSq() < 0.000001) {
          horizontalAim.set(-Math.sin(aimAngle), 0, -Math.cos(aimAngle));
        } else {
          horizontalAim.normalize();
        }
        const pointerAimAngle = Math.atan2(-horizontalAim.x, -horizontalAim.z);
        (player.userData.turret as THREE.Object3D).rotation.y = pointerAimAngle - player.rotation.y;
        const desiredGunPitch = weaponMode === 'mortar'
          ? clamp(aimPitch, 0, Math.PI / 2)
          : cameraMode === 1
            ? clampCannonPitch(aimPitch)
            : cannonPitchFromDirection(turretAim);
        (player.userData.gunPitch as THREE.Object3D).rotation.x = desiredGunPitch;
        weaponRecoil = Math.max(0, weaponRecoil - deltaTime * 1.7);
        // The reticle and cockpit gun must share the same immediate input pose.
        // Interpolating these rotations made the barrel visibly trail the free
        // pointer during deployment before pointer lock could be requested.
        cockpitWeapon.rotation.y = -pointer.x * 0.34;
        cockpitWeapon.rotation.x = pointer.y * 0.19 - weaponRecoil * 0.22;
        cockpitWeapon.position.z = THREE.MathUtils.lerp(cockpitWeapon.position.z, weaponRecoil, 0.34);

        if (!deploying) {
          generationElapsed += deltaTime;
          const forwardInput = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
          const strafeInput = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
          const boost = keys.has('ShiftLeft') ? 1.65 : 1;
          const movement = cameraMode === 0
            ? movementScratch.set(strafeInput, 0, -forwardInput)
            : movementScratch.set(
              -Math.sin(aimAngle) * forwardInput + Math.cos(aimAngle) * strafeInput,
              0,
              -Math.cos(aimAngle) * forwardInput - Math.sin(aimAngle) * strafeInput,
            );
          if (movement.lengthSq() > 1) movement.normalize();
          tryMoveTank(
            player,
            player.position.x + movement.x * deltaTime * 8.2 * currentPlayerPower() * boost,
            player.position.z + movement.z * deltaTime * 8.2 * currentPlayerPower() * boost,
          );
          const observedVelocity = velocityScratch
            .copy(player.position)
            .sub(previousPlayerPosition)
            .divideScalar(Math.max(deltaTime, 0.001));
          playerVelocity.lerp(observedVelocity, 0.28);
          previousPlayerPosition.copy(player.position);
          squadMemoryTimer = Math.max(0, squadMemoryTimer - deltaTime);
          const playerOnBridge = arenaBridges.some((bridge) => (
            pointInsideSurface(player.position, bridge)
          ));

          enemies.forEach((enemy) => {
            enemy.survivalSeconds += deltaTime;
            enemy.engagementDelay = Math.max(0, enemy.engagementDelay - deltaTime);
            enemy.blindTimer = Math.max(0, enemy.blindTimer - deltaTime);
            enemy.damageResponseTimer = Math.max(0, enemy.damageResponseTimer - deltaTime);
            enemy.dodgeReactionTimer = Math.max(0, enemy.dodgeReactionTimer - deltaTime);
            const glowMaterial = enemy.mesh.userData.glowMaterial as THREE.MeshStandardMaterial;
            const artilleryBeacon = enemy.mesh.userData.artilleryBeacon as THREE.Object3D | undefined;
            if (artilleryBeacon) {
              artilleryBeacon.rotation.y += deltaTime * 3.8;
              artilleryBeacon.position.y = 1.9 + Math.sin(now * 0.006) * 0.12;
            }
            const interceptorBeacon = enemy.mesh.userData.interceptorBeacon as THREE.Object3D | undefined;
            if (interceptorBeacon) {
              interceptorBeacon.rotation.y += deltaTime * 4.6;
              interceptorBeacon.position.y = 1.95 + Math.sin(now * 0.009) * 0.1;
            }
            const tacticalCarrierMarker = enemy.mesh.userData.tacticalCarrierMarker as THREE.Object3D | undefined;
            if (tacticalCarrierMarker) {
              tacticalCarrierMarker.rotation.z += deltaTime * 1.7;
              tacticalCarrierMarker.scale.setScalar(0.9 + Math.sin(now * 0.007) * 0.12);
              tacticalCarrierMarker.visible = enemy.smokeGrenades + enemy.flashGrenades > 0;
            }
            if (enemy.blindTimer > 0) {
              glowMaterial.color.setHex(0xf1ffff);
              glowMaterial.emissive.setHex(0xe8ffff);
              glowMaterial.emissiveIntensity = 3.2 + Math.sin(now * 0.035) * 0.7;
            } else if (enemy.wounded) {
              glowMaterial.color.setHex(0xff6b38);
              glowMaterial.emissive.setHex(0xff351f);
              glowMaterial.emissiveIntensity = 0.55 + Math.max(0, Math.sin(now * 0.018)) * 2.1;
            } else {
              const roleGlow = ROLE_GLOW_COLORS[enemy.role];
              glowMaterial.color.setHex(roleGlow);
              glowMaterial.emissive.setHex(roleGlow);
              glowMaterial.emissiveIntensity = 2.2;
            }
            if (enemy.wounded) {
              enemy.smokeTimer -= deltaTime;
              if (enemy.smokeTimer <= 0) {
                createSmoke(enemy.mesh.position);
                enemy.smokeTimer = 0.28 + Math.random() * 0.22;
              }
            }
            const directionToPlayer = directionToPlayerScratch.copy(player.position).sub(enemy.mesh.position);
            directionToPlayer.y = 0;
            const distance = directionToPlayer.length();
            enemy.perceptionTimer -= deltaTime;
            if (enemy.perceptionTimer <= 0) {
              enemy.smokeObscured = lineBlockedBySmoke(
                enemy.mesh.position,
                player.position,
                smokeZones,
              );
              enemy.hasLineOfSight = enemy.blindTimer <= 0
                && !enemy.smokeObscured
                && !tankSightBlockedByCover(enemy.mesh.position, player.position);
              enemy.perceptionTimer = 0.075 + Math.random() * 0.025;
            }
            const smokeObscured = enemy.smokeObscured;
            const hasLineOfSight = enemy.hasLineOfSight;
            if (hasLineOfSight) {
              enemy.lastKnownPlayer.copy(player.position);
              enemy.lastKnownVelocity.copy(playerVelocity);
              enemy.memoryTimer = enemyMemorySeconds;
              squadLastKnownPlayer.copy(player.position);
              squadLastKnownVelocity.copy(playerVelocity);
              squadMemoryTimer = enemyMemorySeconds;
            } else if (squadMemoryTimer > 0) {
              enemy.lastKnownPlayer.copy(squadLastKnownPlayer);
              enemy.lastKnownVelocity.copy(squadLastKnownVelocity);
              enemy.memoryTimer = squadMemoryTimer;
            } else {
              enemy.memoryTimer = Math.max(0, enemy.memoryTimer - deltaTime);
            }
            const predictedPoint = predictPlayerPosition(
              enemy.lastKnownPlayer,
              enemy.lastKnownVelocity,
              enemy.predictionLead,
              arena.bounds,
            );
            const predictedTarget = predictedTargetScratch.set(
              predictedPoint.x,
              player.position.y + 0.85,
              predictedPoint.z,
            );
            const directionToPrediction = directionToPredictionScratch
              .copy(predictedTarget)
              .sub(enemy.mesh.position)
              .setY(0);
            const aimAtPrediction = Math.atan2(-directionToPrediction.x, -directionToPrediction.z);
            (enemy.mesh.userData.turret as THREE.Object3D).rotation.y = aimAtPrediction - enemy.mesh.rotation.y;
            const enemyAimOrigin = enemyAimOriginScratch.set(
              enemy.mesh.position.x,
              enemy.mesh.position.y + 1.12,
              enemy.mesh.position.z,
            );
            const enemyAimDirection = enemyAimDirectionScratch.copy(predictedTarget).sub(enemyAimOrigin);
            (enemy.mesh.userData.gunPitch as THREE.Object3D).rotation.x = cannonPitchFromDirection(enemyAimDirection);

            if (
              enemy.isDuelist
              && distance < DUEL_MIN_DISTANCE
              && enemy.tactic !== 'relocate'
            ) {
              setEnemyTactic(enemy, 'relocate');
            }

            enemy.tacticTimer -= deltaTime;
            if (enemy.tacticTimer <= 0) {
              if (enemy.isDuelist) {
                const movementIntent = duelMovementIntent(
                  distance,
                  hasLineOfSight,
                  enemyCannonInRange(distance),
                );
                if (movementIntent === 'retreat') {
                  setEnemyTactic(enemy, 'relocate');
                } else if (movementIntent === 'pressure') {
                  const pressureGoal = duelLateralPressureGoal(
                    enemy.mesh.position,
                    player.position,
                    enemy.avoidDirection,
                  );
                  const playablePressureGoal = closestPointOnPlayableSurface(
                    pressureGoal,
                    arenaSurfaces,
                  );
                  const pressureDistance = Math.hypot(
                    playablePressureGoal.x - player.position.x,
                    playablePressureGoal.z - player.position.z,
                  );
                  const preservesDistance = pressureDistance >= Math.max(
                    DUEL_MIN_DISTANCE,
                    distance - 0.35,
                  );
                  enemy.tactic = 'suppress';
                  if (
                    preservesDistance
                    && !tankPositionBlocked(playablePressureGoal, obstacles)
                  ) {
                    enemy.goalPosition.set(
                      playablePressureGoal.x,
                      0,
                      playablePressureGoal.z,
                    );
                  } else {
                    enemy.goalPosition.copy(enemy.mesh.position);
                    enemy.avoidDirection *= -1;
                  }
                  enemy.tacticTimer = 0.52 + (1 - enemy.navigation) * 0.32;
                  enemy.cooldown = Math.min(enemy.cooldown, 0.2);
                } else {
                  const intercept = bridgeInterceptionPoint(
                    enemy.mesh.position,
                    player.position,
                    playerVelocity,
                    arenaSectors,
                    arenaBridges,
                  );
                  const safeIntercept = clampDuelGoalDistance(intercept, player.position);
                  const playableIntercept = closestPointOnPlayableSurface(
                    safeIntercept,
                    arenaSurfaces,
                  );
                  enemy.tactic = 'flank';
                  enemy.goalPosition.set(playableIntercept.x, 0, playableIntercept.z);
                  enemy.tacticTimer = 0.65 + (1 - enemy.navigation) * 0.55;
                  enemy.cooldown = Math.min(enemy.cooldown, 0.24);
                }
              } else if (enemy.role === 'marksman') {
                setEnemyTactic(enemy, enemy.tactic === 'peek' ? 'relocate' : 'peek');
              } else if (enemy.role === 'sprinter') {
                setEnemyTactic(enemy, enemy.tactic === 'flank' ? 'suppress' : 'flank');
              } else if (enemy.role === 'dodger') {
                setEnemyTactic(enemy, enemy.tactic === 'peek' ? 'relocate' : 'peek');
              } else if (enemy.role === 'navigator') {
                setEnemyTactic(enemy, enemy.tactic === 'relocate' ? 'suppress' : 'relocate');
              } else if (enemy.role === 'interceptor') {
                const intercept = bridgeInterceptionPoint(
                  enemy.mesh.position,
                  player.position,
                  playerVelocity,
                  arenaSectors,
                  arenaBridges,
                );
                enemy.tactic = 'flank';
                enemy.goalPosition.set(intercept.x, 0, intercept.z);
                enemy.tacticTimer = 0.8 + (1 - enemy.navigation) * 0.8;
                enemy.cooldown = Math.min(enemy.cooldown, 0.24);
              } else {
                setEnemyTactic(enemy, enemy.tactic === 'cover' ? 'relocate' : 'cover');
              }
            }

            if (enemy.isDuelist && !enemy.pendingDodgeShot) {
              const dodgeCandidate = shots.find((shot) => {
                if (shot.enemy || shot.weapon !== 'cannon') return false;
                const consideredBy = shot.mesh.userData.duelDodgeConsideredBy as string[] | undefined;
                if (consideredBy?.includes(enemy.genome.id)) return false;
                const toEnemy = shotThreatScratch
                  .copy(enemy.mesh.position)
                  .sub(shot.mesh.position)
                  .setY(0);
                return toEnemy.lengthSq() < DUEL_DODGE_DETECTION_RANGE ** 2
                  && shot.velocity.dot(toEnemy) > 0;
              });
              if (dodgeCandidate) {
                const consideredBy = dodgeCandidate.mesh.userData.duelDodgeConsideredBy as string[] | undefined;
                const consideration = registerDuelDodgeConsideration(
                  consideredBy,
                  enemy.genome.id,
                );
                dodgeCandidate.mesh.userData.duelDodgeConsideredBy = consideration.consideredBy;
                if (consideration.firstConsideration && duelShouldDodge(Math.random())) {
                  enemy.pendingDodgeShot = dodgeCandidate;
                  enemy.dodgeReactionTimer = DUEL_DODGE_REACTION_SECONDS;
                }
              }
            }

            if (
              enemy.isDuelist
              && enemy.pendingDodgeShot
              && enemy.dodgeReactionTimer <= 0
            ) {
              const pendingShot = enemy.pendingDodgeShot;
              enemy.pendingDodgeShot = undefined;
              const toEnemy = shotThreatScratch
                .copy(enemy.mesh.position)
                .sub(pendingShot.mesh.position)
                .setY(0);
              if (
                pendingShot.life > 0
                && pendingShot.velocity.dot(toEnemy) > 0
              ) {
                const shotDirection = shotDirectionScratch
                  .copy(pendingShot.velocity)
                  .setY(0)
                  .normalize();
                const dodgeOffset = dodgeOffsetScratch.set(
                  -shotDirection.z * DUEL_DODGE_DISTANCE * enemy.avoidDirection,
                  0,
                  shotDirection.x * DUEL_DODGE_DISTANCE * enemy.avoidDirection,
                );
                const desiredDodge = enemy.mesh.position.clone().add(dodgeOffset);
                const safeDodge = clampDuelGoalDistance(desiredDodge, player.position);
                const playableDodge = closestPointOnPlayableSurface(safeDodge, arenaSurfaces);
                enemy.goalPosition.set(playableDodge.x, 0, playableDodge.z);
                enemy.tactic = 'flank';
                enemy.tacticTimer = 0.42;
                enemy.fitness += enemyCombatOutcomeFitness('cannon-dodge');
                duelDodgeCount += 1;
              }
            } else if (
              !enemy.isDuelist
              && evolvedEnemyDodgesWeapon(enemy.role, 'cannon', enemy.evasion)
            ) {
              const incomingCannon = shots.find((shot) => {
                if (shot.enemy || shot.weapon !== 'cannon') return false;
                const toEnemy = shotThreatScratch.copy(enemy.mesh.position).sub(shot.mesh.position).setY(0);
                const detectionRadius = 12 + enemy.evasion * 10;
                return toEnemy.lengthSq() < detectionRadius * detectionRadius && shot.velocity.dot(toEnemy) > 0;
              });
              if (incomingCannon) {
                const shotDirection = shotDirectionScratch.copy(incomingCannon.velocity).setY(0).normalize();
                const dodgeSide = enemy.avoidDirection;
                const dodgeDistance = 3 + enemy.evasion * 5;
                const dodgeOffset = dodgeOffsetScratch.set(
                  -shotDirection.z * dodgeDistance * dodgeSide,
                  0,
                  shotDirection.x * dodgeDistance * dodgeSide,
                );
                enemy.goalPosition.copy(enemy.mesh.position).add(dodgeOffset);
                const playableDodge = closestPointOnPlayableSurface(enemy.goalPosition, arenaSurfaces);
                enemy.goalPosition.set(playableDodge.x, 0, playableDodge.z);
                enemy.tactic = 'relocate';
                enemy.tacticTimer = Math.max(0.28, 0.65 - enemy.evasion * 0.28);
                const dodgedBy = incomingCannon.mesh.userData.dodgedBy as string[] | undefined;
                if (!dodgedBy?.includes(enemy.genome.id)) {
                  incomingCannon.mesh.userData.dodgedBy = [...(dodgedBy ?? []), enemy.genome.id];
                  enemy.fitness += enemyCombatOutcomeFitness('cannon-dodge');
                }
              }
            }

            const routeWaypoint = bridgeRouteWaypoint(
              enemy.mesh.position,
              enemy.goalPosition,
              arenaSectors,
              arenaBridges,
            );
            const directionToGoal = directionToGoalScratch
              .set(routeWaypoint.x, 0, routeWaypoint.z)
              .sub(enemy.mesh.position);
            directionToGoal.y = 0;
            if (directionToGoal.length() > 0.35) {
              if (enemy.avoidTimer > 0) {
                enemy.avoidTimer -= deltaTime;
                enemy.mesh.rotation.y += enemy.avoidDirection * deltaTime * 2.1;
              } else {
                const moveAngle = Math.atan2(-directionToGoal.x, -directionToGoal.z);
                const angleDifference = ((moveAngle - enemy.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                enemy.mesh.rotation.y += clamp(angleDifference, -1, 1) * deltaTime * (1.25 + enemy.navigation * 0.95);
              }
              const before = previousEnemyPositionScratch.copy(enemy.mesh.position);
              const step = enemyStepScratch.set(
                -Math.sin(enemy.mesh.rotation.y),
                0,
                -Math.cos(enemy.mesh.rotation.y),
              ).multiplyScalar(enemy.speed * (enemy.wounded ? WOUNDED_SPEED_MULTIPLIER : 1) * deltaTime);
              const proposedX = before.x + step.x;
              const proposedZ = before.z + step.z;
              const proposedDistance = Math.hypot(
                proposedX - player.position.x,
                proposedZ - player.position.z,
              );
              if (
                enemy.isDuelist
                && proposedDistance < DUEL_MIN_DISTANCE
                && proposedDistance < distance
              ) {
                setEnemyTactic(enemy, 'relocate');
              } else {
                tryMoveTank(enemy.mesh, proposedX, proposedZ);
              }
              if (enemy.mesh.position.distanceToSquared(before) < 0.0001) {
                enemy.avoidTimer = Math.max(0.32, 1.05 - enemy.navigation * 0.55 + Math.random() * 0.3);
                enemy.avoidDirection = Math.random() > 0.5 ? 1 : -1;
                enemy.mesh.rotation.y += enemy.avoidDirection * deltaTime * 2.1;
                enemy.goalPosition.copy(chooseTacticalGoal(enemy, enemy.tactic !== 'suppress', enemy.tactic === 'flank'));
              }
            } else if (enemy.tactic === 'flank') {
              setEnemyTactic(enemy, 'suppress');
            }

            enemy.cooldown -= deltaTime;
            enemy.mortarCooldown -= deltaTime;
            enemy.grenadeCooldown -= deltaTime;
            const underCannonThreat = !enemy.isDuelist && shots.some((shot) => {
              if (shot.enemy || shot.weapon !== 'cannon') return false;
              const toEnemy = shotThreatScratch.copy(enemy.mesh.position).sub(shot.mesh.position).setY(0);
              return toEnemy.lengthSq() < 11 * 11 && shot.velocity.dot(toEnemy) > 0;
            });
            let tacticalGrenadeThrown = false;
            if (
              enemy.smokeGrenades > 0
              && enemy.engagementDelay <= 0
              && enemy.grenadeCooldown <= 0
              && (
                enemy.isDuelist
                  ? enemy.damageResponseTimer > 0 || enemy.hp <= 2
                  : enemy.wounded || underCannonThreat
              )
            ) {
              tacticalGrenadeThrown = throwEnemyTacticalGrenade(
                enemy,
                'smoke',
                enemy.mesh.position.clone(),
              );
            } else if (
              enemy.flashGrenades > 0
              && enemy.engagementDelay <= 0
              && enemy.grenadeCooldown <= 0
              && distance <= (
                enemy.isDuelist
                  ? DUEL_TACTICAL_GRENADE_RANGE * currentEnemyPower()
                  : ENEMY_TACTICAL_GRENADE_RANGE
              )
                + FLASH_RADIUS
              && (hasLineOfSight || enemy.memoryTimer > 0)
            ) {
              tacticalGrenadeThrown = throwEnemyTacticalGrenade(enemy, 'flash', predictedTarget);
            }
            if (
              !tacticalGrenadeThrown
              &&
              (enemy.role === 'artillery' || enemy.isDuelist)
              && enemy.engagementDelay <= 0
              && enemy.blindTimer <= 0
              && !smokeObscured
              && enemy.memoryTimer > 0
              && enemy.mortarCooldown <= 0
              && fireEnemyMortar(enemy)
            ) {
              if (enemy.isDuelist) {
                enemy.tactic = 'flank';
                enemy.tacticTimer = Math.max(enemy.tacticTimer, 0.45);
              } else {
                setEnemyTactic(enemy, 'relocate');
              }
            }

            const canApplyPressure = enemy.tactic === 'peek'
              || enemy.tactic === 'suppress'
              || enemy.tactic === 'flank'
              || (enemy.tactic === 'cover' && hasLineOfSight);
            if (enemy.isDuelist) {
              duelMinimumDistance = Math.min(duelMinimumDistance, distance);
              if (canApplyPressure) duelPressureSeconds += deltaTime;
              if (enemy.tactic === 'relocate') duelRelocationSeconds += deltaTime;
            }
            if (
              !tacticalGrenadeThrown
              && canApplyPressure
              && enemy.blindTimer <= 0
              && enemy.engagementDelay <= 0
              && enemyCannonInRange(distance)
              && enemy.cooldown <= 0
              && (hasLineOfSight || enemy.memoryTimer > 0)
            ) {
              if (fire(true, enemy, false, predictedTarget)) {
                enemy.shotsFired += 1;
                if (enemy.isDuelist) {
                  enemy.cooldown = duelEnemyCannonCooldown(
                    Math.random(),
                    currentEnemyPower(),
                    enemy.aggression,
                    enemyCannonCooldownMultiplier(distance),
                    interceptorBridgeFireMultiplier(enemy.role, playerOnBridge),
                  );
                  enemy.burstShotsRemaining -= 1;
                  if (enemy.burstShotsRemaining <= 0) {
                    enemy.burstShotsRemaining = duelBurstSize(Math.random());
                    if (enemy.damageResponseTimer > 0 || Math.random() < 0.35) {
                      setEnemyTactic(enemy, 'relocate');
                    } else {
                      enemy.tactic = 'flank';
                      enemy.tacticTimer = Math.max(enemy.tacticTimer, 0.45);
                    }
                  }
                } else {
                  const baseCooldown = enemy.fire
                    * enemyCannonCooldownMultiplier(distance)
                    * interceptorBridgeFireMultiplier(enemy.role, playerOnBridge)
                    + Math.random() * (1.05 - enemy.aggression * 0.55)
                      / ENEMY_STARTING_POWER;
                  enemy.cooldown = enemyCannonCooldownForGeneration(baseCooldown, wave);
                }
                if (!enemy.isDuelist && enemy.role === 'marksman') {
                  setEnemyTactic(enemy, 'relocate');
                }
              }
            }
            enemy.fitness += enemyPresenceFitness(
              deltaTime,
              distance >= 10 && distance <= 44,
              hasLineOfSight,
              canApplyPressure,
            );
          });

          shots.forEach((shot) => {
            if (shot.life <= 0) return;
            if (shot.weapon === 'mortar') {
              shot.velocity.y -= 22 * deltaTime;
              shot.mesh.position.addScaledVector(shot.velocity, deltaTime);
              shot.life -= deltaTime;
              shot.trail -= deltaTime;
              if (shot.marker) {
                const warningPulse = 0.9 + Math.sin(now * 0.025) * 0.1;
                shot.marker.scale.setScalar(warningPulse);
                (shot.marker.material as THREE.MeshBasicMaterial).opacity = 0.42 + Math.abs(Math.sin(now * 0.018)) * 0.4;
              }
              if (shot.trail <= 0) {
                createMortarTrail(shot.mesh.position);
                shot.trail = 0.085;
              }
              if (
                projectileBlockedBySolidCover(shot.mesh.position)
                || (shot.mesh.position.y <= 0.12 && shot.velocity.y < 0)
                || shot.life <= 0
              ) {
                if (shot.enemy) detonateEnemyMortar(shot);
                else detonateMortar(shot);
              }
              return;
            }

            shot.mesh.position.addScaledVector(shot.velocity, deltaTime);
            shot.life -= deltaTime;
            const hitPole = utilityPoles.find((pole) => (
              !pole.fallen
              && shot.mesh.position.y <= 3.7
              && Math.hypot(
                shot.mesh.position.x - pole.base.x,
                shot.mesh.position.z - pole.base.z,
              ) < 0.55
            ));
            if (hitPole) {
              shot.life = 0;
              shot.mesh.userData.resolved = true;
              toppleUtilityPole(hitPole, shot.mesh.position);
              createExplosion(shot.mesh.position, 0x8ffcff);
              if (shot.enemy && shot.source) {
                shot.source.fitness += enemyCombatOutcomeFitness('cannon-wall');
              }
              return;
            }
            const hitObstacle = obstacles.find((obstacle) => (
              shot.mesh.position.y <= obstacle.height
              && projectileHitsObstacle(shot.mesh.position, [obstacle])
            ));
            if (hitObstacle) {
              const hitBuilding = hitObstacle.buildingIndex === undefined
                ? undefined
                : cityBuildings[hitObstacle.buildingIndex];
              const passesThroughBreach = hitBuilding?.breaches.some((breach) => (
                pointInsideBreach(shot.mesh.position, breach, BREACH_RADIUS * 0.86)
              ));
              if (!passesThroughBreach) {
                shot.life = 0;
                shot.mesh.userData.resolved = true;
                if (shot.enemy && shot.source) {
                  shot.source.fitness += enemyCombatOutcomeFitness('cannon-wall');
                }
                createExplosion(shot.mesh.position, 0xffd172);
                damageBuilding(hitObstacle, shot.mesh.position, 1, true, true);
                return;
              }
            }

            if (shot.enemy) {
              if (projectileHitsTank(shot.mesh.position, player.position)) {
                lives = Math.max(0, lives - 1);
                if (shot.source) {
                  shot.source.fitness += enemyCombatOutcomeFitness('cannon-hit');
                  shot.source.cannonHits += 1;
                }
                shot.life = 0;
                shot.mesh.userData.resolved = true;
                createExplosion(shot.mesh.position, 0x00b8db);
                combatAudio.play('tank-hit', 0.95);
                damageShake = 1;
                onPlayerDamage();
              }
              return;
            }

            enemies.forEach((enemy) => {
              if (shot.life <= 0 || !projectileHitsTank(shot.mesh.position, enemy.mesh.position)) return;
              const cannonDamage = enemy.isDuelist ? 1 : 2;
              enemy.hp = Math.max(0, enemy.hp - cannonDamage);
              enemy.damageTaken += cannonDamage;
              if (enemy.isDuelist) {
                enemy.damageResponseTimer = 1.4;
                // A cannon impact reveals the attacker's elevated position even
                // if smoke or a roof edge briefly interrupts direct optics.
                enemy.lastKnownPlayer.copy(player.position);
                enemy.lastKnownVelocity.copy(playerVelocity);
                enemy.memoryTimer = Math.max(enemy.memoryTimer, enemyMemorySeconds);
                squadLastKnownPlayer.copy(player.position);
                squadLastKnownVelocity.copy(playerVelocity);
                squadMemoryTimer = Math.max(squadMemoryTimer, enemyMemorySeconds);
              }
              enemy.fitness -= 3;
              shot.life = 0;
              score += 35;
              createExplosion(shot.mesh.position, 0x00cfc0);
              playWorldSound('tank-hit', enemy.mesh.position, 0.78);
              if (enemy.hp <= 0) destroyEnemy(enemy);
              else if (enemy.isDuelist && enemy.hp <= 2) woundEnemy(enemy);
            });
          });

          for (let shotIndex = shots.length - 1; shotIndex >= 0; shotIndex -= 1) {
            const shot = shots[shotIndex];
            if (shot.life > 0) continue;
            if (
              shot.enemy
              && shot.weapon === 'cannon'
              && shot.source
              && !shot.mesh.userData.resolved
            ) {
              shot.source.fitness += enemyCombatOutcomeFitness('cannon-miss');
              shot.mesh.userData.resolved = true;
            }
            removeTransientObject(shot.mesh);
            if (shot.marker) removeTransientObject(shot.marker);
            shots.splice(shotIndex, 1);
          }

          if (lives <= 0 && !gameEnded) {
            gameEnded = true;
            fireHeld = false;
            mortarBurstRemaining = 0;
            removeShots();
            createExplosion(player.position, 0xffffff);
            combatAudio.play('tank-destroyed', 1);
            const finalHud: GameHud = {
              mode,
              wave,
              enemies: enemies.length,
              lives: 0,
              maxLives,
              opponentLives: duelMode ? enemies[0]?.hp ?? 0 : 0,
              opponentMaxLives: duelMode ? DUEL_STARTING_LIVES : 0,
              playerPower: currentPlayerPower(),
              enemyPower: currentEnemyPower(),
              score,
              multiplier: 1 + Math.min(wave * 0.35, 4),
              status: 'GAME OVER',
              bestFitness: best,
              mutation: mutationPercent,
              camera: cameraMode ? 'COCKPIT' : 'TACTICAL',
              weapon: weaponMode === 'mortar' ? 'MORTAR' : 'CANNON',
              mortarAmmo,
              mortarMaxAmmo,
              mortarRange,
              mortarElevation,
              artilleryActive: enemies.some((enemy) => enemy.role === 'artillery' || enemy.isDuelist),
              enemyMortarIncoming: enemyMortarInFlight(),
              flashEffectSeconds: playerBlindTimer,
              smokeEffectSeconds: playerSmokeTimer,
              smokeGrenades,
              flashGrenades,
              enemyCountermeasures: enemies.some((enemy) => enemy.smokeGrenades + enemy.flashGrenades > 0),
            };
            onHud(finalHud);
            onGameOver(finalHud);
          } else if (enemies.length === 0) {
            onWaveComplete({
              mode,
              wave,
              score,
              livesRemaining: lives,
              elapsedSeconds: generationElapsed,
            });
            if (duelMode) {
              wave += 1;
              maxLives = DUEL_STARTING_LIVES;
              lives = maxLives;
              mutationPercent = 0;
              best = 0;
              spawnWave();
            } else {
              const evolution = evolveEnemyGenomes(
                generationResults,
                evolutionRng,
                wave + 1,
                { adaptiveMutation: shouldUseAdaptiveMutation(plateauStreak) },
              );
              const generationRecord = createGenerationRecord({
                generation: wave,
                results: generationResults,
                evolution,
                previousPlateauStreak: plateauStreak,
                durationSeconds: generationElapsed,
                score,
                livesRemaining: lives,
              });
              plateauStreak = generationRecord.plateauStreak;
              onGenerationComplete(generationRecord);
              enemyGenomes = evolution.genomes;
              mutationPercent = evolution.mutationPercent;
              wave += 1;
              maxLives = livesForGeneration(wave);
              lives = maxLives;
              spawnWave();
            }
          }
        }

        cityBuildings.forEach((building) => {
          const damageRatio = building.damage / building.maxDamage;
          if (damageRatio < 0.42) return;
          building.smokeTimer -= deltaTime;
          if (building.smokeTimer <= 0) {
            const smokeOrigin = building.mesh.position.clone();
            smokeOrigin.y = building.height * (0.55 + Math.random() * 0.28);
            createSmoke(smokeOrigin);
            building.smokeTimer = Math.max(0.28, 1.15 - damageRatio * 0.72) + Math.random() * 0.25;
          }
        });

        utilityPoles.forEach((pole) => {
          if (!pole.fallen || pole.fallProgress >= 1) return;
          pole.fallProgress = Math.min(1, pole.fallProgress + deltaTime * 1.42);
          const easedFall = pole.fallProgress * pole.fallProgress * (3 - 2 * pole.fallProgress);
          const fallAngle = easedFall * Math.PI * 0.48;
          pole.group.rotation.x = pole.fallDirection.y * fallAngle;
          pole.group.rotation.z = -pole.fallDirection.x * fallAngle;
          pole.sparkTimer -= deltaTime;
          if (pole.sparkTimer <= 0 && pole.fallProgress < 0.68) {
            createElectricSparks(pole.base);
            pole.sparkTimer = 0.16 + Math.random() * 0.14;
          }
          if (!pole.thudPlayed && pole.fallProgress >= 0.72) {
            pole.thudPlayed = true;
            playWorldSound('pole-fall', pole.base, 0.95);
            createConcreteDebris(pole.base, 4);
          }
        });

        effects.forEach((effect) => {
          effect.life -= deltaTime;
          const remaining = Math.max(0, effect.life / effect.max);
          const maxScale = effect.maxScale ?? 1.8;
          const scale = effect.grow
            ? 0.22 + (1 - remaining) * maxScale
            : Math.max(0.1, remaining) * maxScale;
          effect.mesh.scale.setScalar(scale);
          (effect.mesh.material as THREE.MeshBasicMaterial).opacity = remaining;
          const velocity = effect.mesh.userData.velocity as THREE.Vector3 | undefined;
          if (velocity) {
            if (effect.mesh.userData.gravity) velocity.y -= effect.mesh.userData.gravity * deltaTime;
            effect.mesh.position.addScaledVector(velocity, deltaTime);
            if (effect.mesh.position.y < 0.06 && effect.mesh.userData.gravity) {
              effect.mesh.position.y = 0.06;
              velocity.x *= 0.55;
              velocity.y = 0;
              velocity.z *= 0.55;
            }
          }
          const angularVelocity = effect.mesh.userData.angularVelocity as THREE.Vector3 | undefined;
          if (angularVelocity) {
            effect.mesh.rotation.x += angularVelocity.x * deltaTime;
            effect.mesh.rotation.y += angularVelocity.y * deltaTime;
            effect.mesh.rotation.z += angularVelocity.z * deltaTime;
          }
        });
        for (let effectIndex = effects.length - 1; effectIndex >= 0; effectIndex -= 1) {
          const effect = effects[effectIndex];
          if (effect.life > 0) continue;
          removeTransientObject(effect.mesh);
          effects.splice(effectIndex, 1);
        }

        hudTick += deltaTime;
        if (hudTick > 0.1) {
          hudTick = 0;
          if (duelMode && import.meta.env.DEV) {
            const duelist = enemies[0];
            host.dataset.duelMetrics = JSON.stringify({
              round: wave,
              elapsedSeconds: Number(generationElapsed.toFixed(2)),
              shotsFired: duelist?.shotsFired ?? 0,
              pressurePercent: generationElapsed > 0
                ? Number((duelPressureSeconds / generationElapsed * 100).toFixed(1))
                : 0,
              relocationPercent: generationElapsed > 0
                ? Number((duelRelocationSeconds / generationElapsed * 100).toFixed(1))
                : 0,
              minimumDistance: Number.isFinite(duelMinimumDistance)
                ? Number(duelMinimumDistance.toFixed(2))
                : null,
              dodges: duelDodgeCount,
            });
          }
          if (weaponMode === 'mortar') {
            const mortarOrigin = new THREE.Vector3();
            if (cameraMode === 1) cockpitMuzzle.getWorldPosition(mortarOrigin);
            else (player.userData.muzzle as THREE.Object3D).getWorldPosition(mortarOrigin);
            mortarRange = playerAimTarget(mortarOrigin, true).length();
            mortarElevation = cameraMode === 1
              ? THREE.MathUtils.radToDeg(clamp(aimPitch, 0, Math.PI / 2))
              : 45;
          }
          const status = gameEnded
            ? 'GAME OVER'
            : deploymentTimer > 0
              ? `DEPLOYMENT LOCK · ${deploymentTimer.toFixed(1)}S`
              : enemyMortarInFlight()
                ? 'INCOMING ARTILLERY · MOVE'
              : playerBlindTimer > 0
                ? `FLASH HIT · ${Math.ceil(playerBlindTimer)}`
              : playerSmokeTimer > 0
                ? `SMOKE HIT · ${Math.ceil(playerSmokeTimer)}`
              : countermeasureMessageTimer > 0
                ? countermeasureMessage
              : breachMessageTimer > 0
                ? breachMessage
              : mortarBurstRemaining > 0
                ? `MORTAR BURST · ${mortarBurstRemaining} SHELLS`
              : weaponMode === 'mortar' && mortarAmmo === 0
                ? `MORTAR RECHARGING · ${Math.max(0, mortarRecharge).toFixed(1)}S`
              : cameraMode === 1 && !pointerLocked && !pointerLockUnavailable
                ? 'CLICK ARENA TO CAPTURE MOUSE'
                : !aimEngaged
                  ? 'MOVE MOUSE TO AIM'
                  : cameraMode === 0 && Math.hypot(tacticalPanX, tacticalPanZ) > 0.75
                    ? 'TACTICAL LOOK-AHEAD'
                  : duelMode
                    ? '1 × 1 DUEL LIVE'
                    : enemies.length < 3 ? 'ROUND ALMOST CLEAR' : 'ROUND LIVE';
          onHud({
            mode,
            wave,
            enemies: enemies.length,
            lives,
            maxLives,
            opponentLives: duelMode ? enemies[0]?.hp ?? 0 : 0,
            opponentMaxLives: duelMode ? DUEL_STARTING_LIVES : 0,
            playerPower: currentPlayerPower(),
            enemyPower: currentEnemyPower(),
            score,
            multiplier: 1 + Math.min(wave * 0.35, 4),
            status,
            bestFitness: best,
            mutation: mutationPercent,
            camera: cameraMode ? 'COCKPIT' : 'TACTICAL',
            weapon: weaponMode === 'mortar' ? 'MORTAR' : 'CANNON',
            mortarAmmo,
            mortarMaxAmmo,
            mortarRange,
            mortarElevation,
            artilleryActive: enemies.some((enemy) => enemy.role === 'artillery' || enemy.isDuelist),
            enemyMortarIncoming: enemyMortarInFlight(),
            flashEffectSeconds: playerBlindTimer,
            smokeEffectSeconds: playerSmokeTimer,
            smokeGrenades,
            flashGrenades,
            enemyCountermeasures: enemies.some((enemy) => enemy.smokeGrenades + enemy.flashGrenades > 0),
          });
        }

        if (cameraMode === 0) {
          player.visible = true;
          cockpitWeapon.visible = false;
          const projectionDamping = 1 - Math.exp(-deltaTime * 8);
          camera.fov = THREE.MathUtils.lerp(camera.fov, 62, projectionDamping);
          camera.updateProjectionMatrix();

          const desiredLookAhead = tacticalLookAhead(pointer.x, pointer.y, 12.5);
          const lookAheadDamping = 1 - Math.exp(-deltaTime * 5.5);
          tacticalPanX = THREE.MathUtils.lerp(tacticalPanX, desiredLookAhead.x, lookAheadDamping);
          tacticalPanZ = THREE.MathUtils.lerp(tacticalPanZ, desiredLookAhead.z, lookAheadDamping);
          const constrainedPan = constrainTacticalPan(tacticalPanX, tacticalPanZ, 12.5);
          tacticalPanX = constrainedPan.x;
          tacticalPanZ = constrainedPan.z;

          const tacticalFocus = cameraFocusScratch
            .copy(player.position)
            .add(dodgeOffsetScratch.set(tacticalPanX, 0, tacticalPanZ));
          const desired = cameraDesiredScratch.copy(tacticalFocus).add(cameraOffsetScratch);
          const cameraDamping = 1 - Math.exp(-deltaTime * 8.5);
          camera.position.lerp(desired, cameraDamping);
          camera.lookAt(tacticalFocus.x, tacticalFocus.y, tacticalFocus.z);

          // Screen-space guard: if the player approaches the viewport margin,
          // shorten look-ahead and snap the camera back into its safe framing.
          camera.updateMatrixWorld();
          const projectedPlayer = projectedPlayerScratch
            .copy(player.position)
            .add(dodgeOffsetScratch.set(0, 0.75, 0))
            .project(camera);
          const safeOverflow = Math.max(Math.abs(projectedPlayer.x) / 0.68, Math.abs(projectedPlayer.y) / 0.62);
          if (safeOverflow > 1) {
            const correction = 0.94 / safeOverflow;
            tacticalPanX *= correction;
            tacticalPanZ *= correction;
            tacticalFocus
              .copy(player.position)
              .add(dodgeOffsetScratch.set(tacticalPanX, 0, tacticalPanZ));
            desired.copy(tacticalFocus).add(cameraOffsetScratch);
            camera.position.copy(desired);
            camera.lookAt(tacticalFocus.x, tacticalFocus.y, tacticalFocus.z);
          }
        } else {
          player.visible = false;
          cockpitWeapon.visible = true;
          camera.fov = THREE.MathUtils.lerp(camera.fov, 58, 0.1);
          camera.updateProjectionMatrix();
          const desired = cameraDesiredScratch
            .set(0, 1.45, -0.2)
            .applyAxisAngle(THREE.Object3D.DEFAULT_UP, aimAngle)
            .add(player.position);
          camera.position.copy(desired);
          camera.rotation.order = 'YXZ';
          camera.rotation.set(aimPitch, aimAngle, 0);
        }

        if (damageShake > 0) {
          const shakeStrength = damageShake * 0.13;
          camera.position.x += (Math.random() - 0.5) * shakeStrength;
          camera.position.y += (Math.random() - 0.5) * shakeStrength;
          camera.position.z += (Math.random() - 0.5) * shakeStrength;
        }
      }

      renderer.render(scene, camera);
    };
    animationFrame = requestAnimationFrame(loop);

    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(renderPixelRatio(host.clientWidth));
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationFrame);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('resize', resize);
      host.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      if (document.pointerLockElement === host) document.exitPointerLock();
      document.documentElement.style.removeProperty('--aim-x');
      document.documentElement.style.removeProperty('--aim-y');
      delete host.dataset.duelMetrics;
      combatAudio.close();
      disposeObjectResources(scene);
      Object.values(projectileGeometry).forEach((geometry) => geometry.dispose());
      Object.values(projectileMaterial).forEach((material) => material.dispose());
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [
    arenaId,
    mode,
    onGameOver,
    onGenerationComplete,
    onHud,
    onPlayerDamage,
    onPlayerFlash,
    onWaveComplete,
  ]);

  return <div ref={mount} className="game-canvas" aria-label="APEX EVOLVE 3D combat arena" />;
}
