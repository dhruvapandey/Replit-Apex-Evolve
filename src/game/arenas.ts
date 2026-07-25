export type ArenaId = 'neon-bastion' | 'city-island';

export type CoverBlock = [
  x: number,
  z: number,
  width: number,
  height: number,
  depth: number,
];

export type PlayableRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: 'sector' | 'bridge';
};

export type ArenaBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type ArenaConfig = {
  id: ArenaId;
  name: string;
  location: string;
  description: string;
  environment: 'bastion' | 'city';
  playerSpawn: [x: number, z: number];
  cover: CoverBlock[];
  sectors: PlayableRect[];
  bridges: PlayableRect[];
  surfaces: PlayableRect[];
  bounds: ArenaBounds;
  enemySpawnCoverIndices: number[];
  rampBuildingIndices: [number, number];
  colors: {
    background: number;
    fog: number;
    floor: number;
    gridMajor: number;
    gridMinor: number;
    cover: number;
    accent: number;
  };
};

const BASTION_COVER: CoverBlock[] = [
  [-24, 2, 6, 3.8, 5], [24, -2, 6, 3.8, 5], [0, -25, 8, 3.4, 3],
  [-20, -21, 5, 2.8, 4], [20, -21, 5, 2.8, 4], [-27, 22, 4, 3, 7],
  [27, 22, 4, 3, 7], [-10, 7, 7, 2.4, 3], [12, 3, 5, 2.8, 4],
  [-4, -9, 4, 2.5, 6], [8, -15, 7, 3.2, 3], [-15, 18, 4, 2.6, 6],
  [0, 25, 8, 3.4, 3],
];

export const SECTOR_HALF_SIZE = 38;
export const SECTOR_GAP = 18;
export const LEFT_SECTOR_CENTER_X = -(SECTOR_HALF_SIZE + SECTOR_GAP / 2);
export const RIGHT_SECTOR_CENTER_X = SECTOR_HALF_SIZE + SECTOR_GAP / 2;

const SECTORS: PlayableRect[] = [
  {
    minX: LEFT_SECTOR_CENTER_X - SECTOR_HALF_SIZE,
    maxX: LEFT_SECTOR_CENTER_X + SECTOR_HALF_SIZE,
    minZ: -SECTOR_HALF_SIZE,
    maxZ: SECTOR_HALF_SIZE,
    kind: 'sector',
  },
  {
    minX: RIGHT_SECTOR_CENTER_X - SECTOR_HALF_SIZE,
    maxX: RIGHT_SECTOR_CENTER_X + SECTOR_HALF_SIZE,
    minZ: -SECTOR_HALF_SIZE,
    maxZ: SECTOR_HALF_SIZE,
    kind: 'sector',
  },
];

const BRIDGES: PlayableRect[] = [0].map((centerZ) => ({
  minX: -SECTOR_GAP / 2,
  maxX: SECTOR_GAP / 2,
  minZ: centerZ - 4.5,
  maxZ: centerZ + 4.5,
  kind: 'bridge' as const,
}));

const BOUNDS: ArenaBounds = {
  minX: SECTORS[0].minX,
  maxX: SECTORS[1].maxX,
  minZ: -SECTOR_HALF_SIZE,
  maxZ: SECTOR_HALF_SIZE,
};

function dualSectorCover(base: CoverBlock[]) {
  const left = base.map<CoverBlock>(([x, z, width, height, depth]) => [
    x + LEFT_SECTOR_CENTER_X,
    z,
    width,
    height,
    depth,
  ]);
  const right = base.map<CoverBlock>(([x, z, width, height, depth]) => [
    RIGHT_SECTOR_CENTER_X - x,
    -z,
    width,
    height,
    depth,
  ]);
  return [...left, ...right];
}

// Alternating entries keep three specialists on each island. Artillery starts on
// the far island while the interceptor starts close enough to contest the bridge.
const ENEMY_SPAWN_COVER_INDICES = [
  0,
  BASTION_COVER.length,
  1,
  BASTION_COVER.length + 1,
  BASTION_COVER.length + 2,
  2,
];

export const CITY_BUILDING_HEIGHT_SCALE = 0.72;

const CITY_ISLAND_BASE_COVER: CoverBlock[] = [
  [-24, -20, 8, 7.5, 9], [24, -20, 9, 8.5, 8], [-18, -4, 10, 6.5, 7],
  [18, -2, 9, 9, 7], [0, -24, 12, 5.5, 6], [-27, 11, 7, 6.5, 10],
  [27, 14, 8, 7.5, 9], [-9, 9, 7, 4.5, 7], [10, 12, 8, 5.5, 8],
  [-2, -10, 6, 5, 6], [15, -14, 6, 4.5, 7], [-18, 24, 8, 5, 6],
  [15, 27, 10, 6.5, 5],
];

const CITY_ISLAND_COVER: CoverBlock[] = CITY_ISLAND_BASE_COVER.map(([
  x,
  z,
  width,
  height,
  depth,
]) => [x, z, width, height * CITY_BUILDING_HEIGHT_SCALE, depth]);

const sharedTopology = () => ({
  sectors: SECTORS.map((sector) => ({ ...sector })),
  bridges: BRIDGES.map((bridge) => ({ ...bridge })),
  surfaces: [...SECTORS, ...BRIDGES].map((surface) => ({ ...surface })),
  bounds: { ...BOUNDS },
  enemySpawnCoverIndices: [...ENEMY_SPAWN_COVER_INDICES],
  rampBuildingIndices: [4, BASTION_COVER.length + 4] as [number, number],
});

export const ARENA_CONFIGS: Record<ArenaId, ArenaConfig> = {
  'neon-bastion': {
    id: 'neon-bastion',
    name: 'Neon Bastion',
    location: 'Twin-platform Arctic weapons facility',
    description: 'Two fortified platforms linked by one exposed central energy bridge.',
    environment: 'bastion',
    playerSpawn: [LEFT_SECTOR_CENTER_X, 13],
    cover: dualSectorCover(BASTION_COVER),
    ...sharedTopology(),
    colors: {
      background: 0x15384a,
      fog: 0x244c5b,
      floor: 0x31434a,
      gridMajor: 0x44b6b1,
      gridMinor: 0x36565d,
      cover: 0x69777c,
      accent: 0x168c8b,
    },
  },
  'city-island': {
    id: 'city-island',
    name: 'City Island',
    location: 'Twin-island flooded coastal district',
    description: 'Two full urban islands linked by one central combat bridge.',
    environment: 'city',
    playerSpawn: [LEFT_SECTOR_CENTER_X, 31],
    cover: dualSectorCover(CITY_ISLAND_COVER),
    ...sharedTopology(),
    colors: {
      background: 0x4f7184,
      fog: 0x6f8f9d,
      floor: 0x4d5355,
      gridMajor: 0x708080,
      gridMinor: 0x596466,
      cover: 0x777a79,
      accent: 0xd9a84f,
    },
  },
};

export const ARENA_CHOICES = Object.values(ARENA_CONFIGS);
