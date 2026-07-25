import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import type {
  ArenaObjectCounts,
  ArenaRulesState,
  CreatureSnapshot,
  DeathCause,
  Genome,
  LeaderSnapshot,
  SimulationStatus,
  ToolType,
  UiState,
} from '../types';
import {
  CREATURE_MAX_ENERGY,
  CREATURE_MAX_HEALTH,
  FOOD_ENERGY_GAIN,
  GENERATION_DURATION_MS,
  OBJECTIVE_TARGET,
  POISON_DAMAGE,
  POPULATION_SIZE,
  PREDATOR_DAMAGE,
} from '../../simulation/constants';
import { calculateCreatureFitness, summarizeScoredGenomes } from '../../simulation/fitness';
import {
  createNextPopulation,
  createRandomGenome,
  describeGenomeTraits,
  type ScoredGenome,
} from '../../simulation/genome';
import { createMathRandomSource, type RandomSource } from '../../simulation/random';

interface CreatureAgent {
  sprite: Phaser.GameObjects.Arc;
  visual: Phaser.GameObjects.Container;
  bodyVisual: Phaser.GameObjects.Ellipse;
  tail: Phaser.GameObjects.Graphics;
  trail: Phaser.GameObjects.Graphics;
  genome: Genome;
  fitness: number;
  foodEaten: number;
  ageSeconds: number;
  health: number;
  energy: number;
  alive: boolean;
  deathCause: DeathCause;
  wanderAngle: number;
  state: string;
  poisonHits: number;
  predatorHits: number;
  hazardCooldownUntil: number;
  lastTrailPoint: Phaser.Math.Vector2;
}

interface PredatorAgent {
  sprite: Phaser.GameObjects.Arc;
  visual: Phaser.GameObjects.Container;
  bodyVisual: Phaser.GameObjects.Ellipse;
  jaw: Phaser.GameObjects.Graphics;
  wanderAngle: number;
}

const ARENA_PADDING = 24;
const WALL_SIZE = 34;
const UI_EMIT_INTERVAL_MS = 100;
const MIN_FOOD_REQUIRED = 5;
const HATCHERY_ZONE = { x: 54, y: 150, width: 244, height: 190 };
const OBJECT_COSTS: ArenaObjectCounts = { food: 0, poison: 2, wall: 1, predator: 5 };

type PlaceableTool = keyof ArenaObjectCounts;
type PlacementCheck = { ok: true } | { ok: false; message: string };

export class ArenaScene extends Phaser.Scene {
  private rng: RandomSource = createMathRandomSource();
  private generation = 1;
  private status: SimulationStatus = 'design';
  private selectedTool: ToolType = 'food';
  private speedMultiplier = 1;
  private trailsEnabled = true;
  private timeRemainingMs = GENERATION_DURATION_MS;
  private populationGenomes: Genome[] = [];
  private nextGenerationGenomes: Genome[] | null = null;
  private creatures: CreatureAgent[] = [];
  private food: Phaser.GameObjects.Arc[] = [];
  private poison: Phaser.GameObjects.Arc[] = [];
  private walls: Phaser.GameObjects.Rectangle[] = [];
  private predators: PredatorAgent[] = [];
  private totalFoodEaten = 0;
  private lastUiEmitAt = 0;
  private lastTickAt = Date.now();
  private blockPlacementUntil = 0;
  private selectedCreatureId: string | null = null;
  private lastSummary = null as ReturnType<typeof summarizeScoredGenomes> | null;
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private leaderRing!: Phaser.GameObjects.Graphics;
  private rankBadges: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('ArenaScene');
  }

  create() {
    this.drawArena();
    this.wallGroup = this.physics.add.staticGroup();
    this.selectionRing = this.add.graphics().setDepth(40);
    this.leaderRing = this.add.graphics().setDepth(41);
    this.rankBadges = this.createRankBadges();
    this.populationGenomes = Array.from({ length: POPULATION_SIZE }, () => createRandomGenome(this.rng, 1));
    this.seedStarterArena();
    this.bindEvents();
    this.emitUiState();
  }

  update(_time: number, _delta: number) {
    if (this.status !== 'running') {
      this.updateSelectionRing();
      this.updateLeaderMarker();
      return;
    }

    const now = Date.now();
    const scaledDelta = (now - this.lastTickAt) * this.speedMultiplier;
    this.lastTickAt = now;
    this.timeRemainingMs -= scaledDelta;

    this.updateCreatures(scaledDelta);
    this.updatePredators();
    this.resolveFoodAndHazards();
    this.updateSelectionRing();
    this.updateLeaderMarker();

    if (this.time.now - this.lastUiEmitAt > UI_EMIT_INTERVAL_MS) {
      this.lastUiEmitAt = this.time.now;
      this.emitSelectedCreature();
      this.emitUiState();
    }

    const living = this.creatures.filter((creature) => creature.alive).length;
    if (this.timeRemainingMs <= 0 || living === 0) {
      this.endGeneration();
    }
  }

  private drawArena() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x627d3c);
    this.add
      .rectangle(width / 2, height / 2, width - 20, height - 20, 0x78964a)
      .setStrokeStyle(4, 0x2c3e2e);

    const graphics = this.add.graphics().setAlpha(0.2);
    graphics.lineStyle(1, 0x213b22);
    for (let x = 20; x < width; x += 40) graphics.lineBetween(x, 10, x, height - 10);
    for (let y = 20; y < height; y += 40) graphics.lineBetween(10, y, width - 10, y);

    const patches = this.add.graphics().setAlpha(0.26);
    for (let index = 0; index < 18; index += 1) {
      patches.fillStyle(index % 2 === 0 ? 0x5e7a38 : 0x9ab05d, 1);
      patches.fillEllipse(
        this.rng.range(30, width - 30),
        this.rng.range(30, height - 30),
        this.rng.range(80, 180),
        this.rng.range(42, 90),
      );
    }

    const flecks = this.add.graphics().setAlpha(0.25);
    for (let index = 0; index < 120; index += 1) {
      flecks.fillStyle(index % 2 === 0 ? 0x9eb86a : 0x435d34, 1);
      flecks.fillCircle(this.rng.range(18, width - 18), this.rng.range(18, height - 18), this.rng.range(1, 2.6));
    }

    const hatchery = this.add.graphics().setDepth(13);
    hatchery.fillStyle(0x83e8a4, 0.08);
    hatchery.fillRect(HATCHERY_ZONE.x, HATCHERY_ZONE.y, HATCHERY_ZONE.width, HATCHERY_ZONE.height);
    hatchery.lineStyle(2, 0xd8ffd5, 0.2);
    hatchery.strokeRect(HATCHERY_ZONE.x, HATCHERY_ZONE.y, HATCHERY_ZONE.width, HATCHERY_ZONE.height);
    this.add
      .text(HATCHERY_ZONE.x + 12, HATCHERY_ZONE.y + 10, 'HATCHERY', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: '800',
        color: '#d8ffd5',
      })
      .setDepth(14)
      .setAlpha(0.45);

    for (let index = 0; index < 16; index += 1) {
      this.drawTinyPlant(this.rng.range(40, width - 40), this.rng.range(40, height - 40));
    }
  }

  private seedStarterArena() {
    const { width, height } = this.scale;
    const positions = [
      [width * 0.28, height * 0.25],
      [width * 0.52, height * 0.2],
      [width * 0.72, height * 0.36],
      [width * 0.35, height * 0.64],
      [width * 0.6, height * 0.7],
      [width * 0.82, height * 0.72],
      [width * 0.18, height * 0.48],
      [width * 0.5, height * 0.48],
    ];
    positions.forEach(([x, y]) => this.placeFood(x, y));
    this.placeWall(width * 0.46, height * 0.36);
    this.placeWall(width * 0.5, height * 0.36);
    this.placeWall(width * 0.54, height * 0.36);
  }

  private drawTinyPlant(x: number, y: number) {
    const plant = this.add.graphics().setDepth(12).setAlpha(0.8);
    plant.fillStyle(0x2f6b31, 1);
    plant.fillEllipse(x - 5, y, 6, 15);
    plant.fillEllipse(x + 5, y, 6, 15);
    plant.fillEllipse(x, y - 4, 7, 16);
    plant.lineStyle(2, 0x1b4b21, 0.85);
    plant.lineBetween(x, y + 8, x, y - 10);
  }

  private createCreatureVisual(genome: Genome, radius: number) {
    const hue = Phaser.Math.Clamp(0.22 + genome.foodAttraction * 0.2 - genome.wander * 0.04, 0.16, 0.55);
    const color = Phaser.Display.Color.HSVToRGB(hue, 0.68, 0.94).color;
    const accent = Phaser.Display.Color.HSVToRGB(Phaser.Math.Wrap(hue + 0.1, 0, 1), 0.58, 1).color;
    const bodyWidth = radius * (1.8 + genome.energyEfficiency * 0.36);
    const bodyHeight = radius * (1.35 + genome.size * 0.25);
    const tail = this.add.graphics();
    const bodyShadow = this.add.ellipse(3, 4, bodyWidth, bodyHeight, 0x13210f, 0.28);
    const body = this.add.ellipse(0, 0, bodyWidth, bodyHeight, color).setStrokeStyle(2, 0x17331d);
    const shine = this.add.ellipse(-radius * 0.35, -radius * 0.32, radius * 0.62, radius * 0.38, 0xf1ffd8, 0.45);
    const nucleus = this.add.circle(radius * 0.22, radius * 0.18, Math.max(2.4, radius * 0.22), accent, 0.85);
    const eyeSize = Phaser.Math.Clamp(2.2 + (genome.vision - 95) / 205 * 2.1, 2.2, 4.3);
    const eye = this.add.circle(radius * 0.52, -radius * 0.18, eyeSize, 0xf7fff1);
    const pupil = this.add.circle(radius * 0.72, -radius * 0.16, eyeSize * 0.45, 0x102016);
    const generationMark = this.add.circle(
      -radius * 0.15,
      radius * 0.48,
      Phaser.Math.Clamp(genome.generation, 1, 6),
      0xf6d45f,
      genome.generation > 1 ? 0.72 : 0.18,
    );

    const visual = this.add.container(0, 0, [tail, bodyShadow, body, shine, nucleus, eye, pupil, generationMark]);
    visual.setData('bodyVisual', body);
    visual.setData('tail', tail);
    visual.setData('tailLength', radius * (2.2 + genome.speed * 2.2));
    visual.setData('tailAmplitude', 4 + genome.wander * 5);
    visual.setData('bodyColor', color);
    return visual;
  }

  private updateCreatureVisual(creature: CreatureAgent, angle: number) {
    creature.visual.setPosition(creature.sprite.x, creature.sprite.y);
    creature.visual.setRotation(angle);

    const tailLength = creature.visual.getData('tailLength') as number;
    const amplitude = creature.visual.getData('tailAmplitude') as number;
    const wave = Math.sin(this.time.now * 0.018 + creature.genome.foodAttraction * 8) * amplitude;
    creature.tail.clear();
    creature.tail.lineStyle(3, 0xe8f4c9, creature.alive ? 0.82 : 0.28);
    creature.tail.beginPath();
    creature.tail.moveTo(-creature.sprite.radius * 0.78, 0);
    creature.tail.lineTo(-tailLength * 0.48, wave * 0.55);
    creature.tail.lineTo(-tailLength, -wave);
    creature.tail.strokePath();
    creature.tail.lineStyle(1.4, 0x416a2d, creature.alive ? 0.55 : 0.18);
    creature.tail.lineBetween(-creature.sprite.radius * 0.7, 1.5, -tailLength * 0.85, -wave * 0.6);
  }

  private createPredatorVisual(radius: number) {
    const shadow = this.add.ellipse(5, 6, radius * 2.35, radius * 1.65, 0x160d18, 0.34);
    const jaw = this.add.graphics();
    const body = this.add.ellipse(0, 0, radius * 2.25, radius * 1.5, 0x9a35a4).setStrokeStyle(3, 0x33133b);
    const back = this.add.ellipse(-radius * 0.22, -radius * 0.18, radius * 1.35, radius * 0.86, 0xbd5bcc, 0.55);
    const eye = this.add.circle(radius * 0.42, -radius * 0.32, radius * 0.2, 0xfff7d5);
    const pupil = this.add.circle(radius * 0.49, -radius * 0.31, radius * 0.09, 0x130615);
    const spikes = this.add.graphics();
    spikes.fillStyle(0x5d1d70, 1);
    for (let index = 0; index < 4; index += 1) {
      const spikeX = -radius * 0.65 + index * radius * 0.42;
      spikes.fillTriangle(spikeX, -radius * 0.64, spikeX + radius * 0.16, -radius * 1.08, spikeX + radius * 0.34, -radius * 0.58);
    }

    const visual = this.add.container(0, 0, [shadow, spikes, body, back, jaw, eye, pupil]);
    visual.setData('bodyVisual', body);
    visual.setData('jaw', jaw);
    return visual;
  }

  private updatePredatorVisual(predator: PredatorAgent, angle: number) {
    predator.visual.setPosition(predator.sprite.x, predator.sprite.y);
    predator.visual.setRotation(angle);
    const bite = Math.sin(this.time.now * 0.012) * 3;
    predator.jaw.clear();
    predator.jaw.fillStyle(0x2a0f2f, 1);
    predator.jaw.fillTriangle(8, -7 - bite, 30, -16, 30, 0);
    predator.jaw.fillTriangle(8, 7 + bite, 30, 16, 30, 0);
    predator.jaw.fillStyle(0xf7eed3, 1);
    predator.jaw.fillTriangle(18, -8, 23, -2, 27, -9);
    predator.jaw.fillTriangle(20, 8, 25, 2, 29, 9);
  }

  private destroyWithVisual(object: Phaser.GameObjects.GameObject) {
    const visual = object.getData('visual') as Phaser.GameObjects.GameObject | undefined;
    visual?.destroy();
    object.destroy();
  }

  private bindEvents() {
    EventBus.on('set-tool', this.handleSetTool);
    EventBus.on('start-generation', this.handleStartGeneration);
    EventBus.on('toggle-pause', this.handleTogglePause);
    EventBus.on('set-speed', this.handleSetSpeed);
    EventBus.on('set-trails', this.handleSetTrails);
    EventBus.on('reset-arena', this.handleResetExperiment);
    EventBus.on('reset-experiment', this.handleResetExperiment);
    EventBus.on('clear-arena', this.handleClearArena);

    this.input.on('gameobjectdown', this.handleGameObjectDown);
    this.input.on('pointerdown', this.handlePointerDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.unbindEvents);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.unbindEvents);
  }

  private unbindEvents = () => {
    EventBus.off('set-tool', this.handleSetTool);
    EventBus.off('start-generation', this.handleStartGeneration);
    EventBus.off('toggle-pause', this.handleTogglePause);
    EventBus.off('set-speed', this.handleSetSpeed);
    EventBus.off('set-trails', this.handleSetTrails);
    EventBus.off('reset-arena', this.handleResetExperiment);
    EventBus.off('reset-experiment', this.handleResetExperiment);
    EventBus.off('clear-arena', this.handleClearArena);
    this.input.off('gameobjectdown', this.handleGameObjectDown);
    this.input.off('pointerdown', this.handlePointerDown);
  };

  private handleSetTool = (tool: ToolType) => {
    if (!this.isSceneReady()) return;
    this.selectedTool = tool;
    this.emitUiState();
  };

  private handleStartGeneration = () => {
    if (!this.isSceneReady()) return;
    if (this.status === 'running') {
      this.pauseGeneration();
      return;
    }
    if (this.status === 'paused') {
      this.resumeGeneration();
      return;
    }
    this.startGeneration();
  };

  private handleTogglePause = () => {
    if (!this.isSceneReady()) return;
    if (this.status === 'running') this.pauseGeneration();
    else if (this.status === 'paused') this.resumeGeneration();
  };

  private handleSetSpeed = (speed: number) => {
    if (!this.isSceneReady()) return;
    this.speedMultiplier = Phaser.Math.Clamp(speed, 1, 5);
    this.emitUiState();
  };

  private handleSetTrails = (enabled: boolean) => {
    if (!this.isSceneReady()) return;
    this.trailsEnabled = enabled;
    if (!enabled) this.creatures.forEach((creature) => creature.trail.clear());
    this.emitUiState();
  };

  private handleResetExperiment = () => {
    if (!this.isSceneReady()) return;
    this.resetExperiment();
  };

  private handleClearArena = () => {
    if (!this.isSceneReady()) return;
    if (this.status === 'running' || this.status === 'paused') return;
    this.clearEnvironment();
    this.clearCreatures();
    this.selectedCreatureId = null;
    this.status = 'design';
    this.totalFoodEaten = 0;
    this.timeRemainingMs = GENERATION_DURATION_MS;
    EventBus.emit('creature-selected', null);
    EventBus.emit('generation-summary', null);
    this.emitUiState();
  };

  private isSceneReady() {
    if (!this.physics?.world) {
      this.unbindEvents();
      return false;
    }
    return true;
  }

  private handleGameObjectDown = (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
    const creature = this.creatures.find((agent) => agent.sprite === gameObject);
    if (!creature) return;

    this.blockPlacementUntil = this.time.now + 80;
    this.selectCreature(creature);
  };

  private handlePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (this.time.now < this.blockPlacementUntil) return;

    const x = Phaser.Math.Clamp(pointer.worldX, ARENA_PADDING, this.scale.width - ARENA_PADDING);
    const y = Phaser.Math.Clamp(pointer.worldY, ARENA_PADDING, this.scale.height - ARENA_PADDING);

    if (this.selectedTool === 'inspect') {
      this.selectNearestCreature(x, y);
      return;
    }

    if (this.status === 'running' || this.status === 'paused') return;

    if (this.selectedTool === 'erase') {
      this.eraseAt(x, y);
    } else {
      this.placeSelectedTool(x, y);
    }
    this.emitUiState();
  };

  private startGeneration() {
    const rules = this.arenaRules();
    if (!rules.canStart) {
      this.spawnFloatText(this.scale.width * 0.5, 76, rules.message, 0xffd65f);
      this.emitUiState();
      return;
    }

    if (this.nextGenerationGenomes) {
      this.generation += 1;
      this.populationGenomes = this.nextGenerationGenomes;
      this.nextGenerationGenomes = null;
    }

    this.clearCreatures();
    this.selectedCreatureId = null;
    this.totalFoodEaten = 0;
    this.timeRemainingMs = GENERATION_DURATION_MS;
    this.lastTickAt = Date.now();
    this.status = 'running';
    this.physics.world.isPaused = false;

    if (this.food.length === 0) this.seedStarterArena();
    this.populationGenomes.forEach((genome, index) => this.spawnCreature(genome, index));

    EventBus.emit('creature-selected', null);
    EventBus.emit('generation-summary', null);
    this.emitUiState();
  }

  private pauseGeneration() {
    this.status = 'paused';
    this.physics.world.isPaused = true;
    this.creatures.forEach((creature) => {
      const body = creature.sprite.body as Phaser.Physics.Arcade.Body | null;
      body?.setVelocity(0, 0);
    });
    this.predators.forEach((predator) => {
      const body = predator.sprite.body as Phaser.Physics.Arcade.Body | null;
      body?.setVelocity(0, 0);
    });
    this.emitUiState();
  }

  private resumeGeneration() {
    this.status = 'running';
    this.lastTickAt = Date.now();
    this.physics.world.isPaused = false;
    this.emitUiState();
  }

  private spawnCreature(genome: Genome, index: number) {
    const position = this.findSafeSpawn(index);
    const radius = 8 + genome.size * 5;
    const trail = this.add.graphics().setDepth(8).setAlpha(0.65);
    const sprite = this.add.circle(position.x, position.y, radius, 0xffffff, 0.01).setDepth(20);
    sprite.setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains);
    const visual = this.createCreatureVisual(genome, radius);
    visual.setPosition(position.x, position.y).setDepth(22);
    const bodyVisual = visual.getData('bodyVisual') as Phaser.GameObjects.Ellipse;
    const tail = visual.getData('tail') as Phaser.GameObjects.Graphics;

    this.physics.add.existing(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(radius);
    body.setCollideWorldBounds(true, 0.65, 0.65);
    body.setMaxVelocity(180, 180);
    this.physics.add.collider(sprite, this.wallGroup, () => {
      const creature = this.creatures.find((agent) => agent.sprite === sprite);
      if (creature) creature.wanderAngle += this.rng.range(-1.8, 1.8);
    });

    this.creatures.push({
      sprite,
      visual,
      bodyVisual,
      tail,
      trail,
      genome,
      fitness: 0,
      foodEaten: 0,
      ageSeconds: 0,
      health: CREATURE_MAX_HEALTH,
      energy: CREATURE_MAX_ENERGY,
      alive: true,
      deathCause: null,
      wanderAngle: this.rng.range(0, Math.PI * 2),
      state: 'Exploring',
      poisonHits: 0,
      predatorHits: 0,
      hazardCooldownUntil: 0,
      lastTrailPoint: position.clone(),
    });
  }

  private updateCreatures(deltaMs: number) {
    const dtSeconds = deltaMs / 1000;

    for (const creature of this.creatures) {
      if (!creature.alive) continue;

      creature.ageSeconds += dtSeconds;
      creature.energy -= (2.4 + creature.genome.speed * 3.6) * (1.2 - creature.genome.energyEfficiency * 0.55) * dtSeconds;
      if (creature.energy <= 0) {
        this.killCreature(creature, 'starvation');
        continue;
      }

      creature.wanderAngle += this.rng.range(-0.75, 0.75) * dtSeconds * 4.5;
      const position = new Phaser.Math.Vector2(creature.sprite.x, creature.sprite.y);
      const steering = new Phaser.Math.Vector2(
        Math.cos(creature.wanderAngle) * creature.genome.wander,
        Math.sin(creature.wanderAngle) * creature.genome.wander,
      );

      const nearestFood = this.nearestArc(position, this.food);
      if (nearestFood && nearestFood.distance <= creature.genome.vision) {
        const urgency = 1 + (creature.genome.vision - nearestFood.distance) / creature.genome.vision;
        steering.add(nearestFood.direction.scale(1.65 * creature.genome.foodAttraction * urgency));
        creature.state = 'Moving to food';
      } else {
        creature.state = 'Exploring';
      }

      const nearestPoison = this.nearestArc(position, this.poison);
      if (nearestPoison && nearestPoison.distance < creature.genome.vision * 0.75) {
        steering.add(nearestPoison.direction.scale(-2.35 * creature.genome.poisonAvoidance));
        creature.state = 'Avoiding poison';
      }

      const nearestPredator = this.nearestPredator(position);
      if (nearestPredator && nearestPredator.distance < creature.genome.vision) {
        steering.add(nearestPredator.direction.scale(-2.8 * creature.genome.predatorAvoidance));
        creature.state = 'Fleeing predator';
      }

      const nearestWall = this.nearestWall(position);
      if (nearestWall && nearestWall.distance < Math.min(76, creature.genome.vision * 0.35)) {
        steering.add(nearestWall.direction.scale(1.25));
      }

      this.addBoundaryAvoidance(position, steering);

      if (steering.lengthSq() < 0.001 || !Number.isFinite(steering.x) || !Number.isFinite(steering.y)) {
        steering.set(Math.cos(creature.wanderAngle), Math.sin(creature.wanderAngle));
      }
      steering.normalize();

      const speed = 48 + creature.genome.speed * 92;
      const body = creature.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(steering.x * speed * this.speedMultiplier, steering.y * speed * this.speedMultiplier);

      creature.fitness = calculateCreatureFitness(creature);
      this.updateCreatureVisual(creature, steering.angle());
      this.drawTrail(creature);
    }
  }

  private updatePredators() {
    for (const predator of this.predators) {
      const body = predator.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (!body) continue;

      const living = this.creatures.filter((creature) => creature.alive);
      if (living.length === 0) {
        body.setVelocity(0, 0);
        continue;
      }

      const nearest = living.reduce((best, candidate) => {
        const bestDistance = Phaser.Math.Distance.Between(predator.sprite.x, predator.sprite.y, best.sprite.x, best.sprite.y);
        const candidateDistance = Phaser.Math.Distance.Between(
          predator.sprite.x,
          predator.sprite.y,
          candidate.sprite.x,
          candidate.sprite.y,
        );
        return candidateDistance < bestDistance ? candidate : best;
      });

      const direction = new Phaser.Math.Vector2(
        nearest.sprite.x - predator.sprite.x,
        nearest.sprite.y - predator.sprite.y,
      );
      if (direction.lengthSq() < 0.001) {
        predator.wanderAngle += this.rng.range(-0.8, 0.8);
        direction.set(Math.cos(predator.wanderAngle), Math.sin(predator.wanderAngle));
      }
      direction.normalize();
      body.setVelocity(direction.x * 74 * this.speedMultiplier, direction.y * 74 * this.speedMultiplier);
      this.updatePredatorVisual(predator, direction.angle());
    }
  }

  private resolveFoodAndHazards() {
    for (const creature of this.creatures) {
      if (!creature.alive) continue;

      for (const food of [...this.food]) {
        if (Phaser.Math.Distance.Between(creature.sprite.x, creature.sprite.y, food.x, food.y) < creature.sprite.radius + 10) {
          creature.foodEaten += 1;
          creature.energy = Math.min(CREATURE_MAX_ENERGY, creature.energy + FOOD_ENERGY_GAIN);
          creature.health = Math.min(CREATURE_MAX_HEALTH, creature.health + 8);
          this.totalFoodEaten += 1;
          this.food = this.food.filter((item) => item !== food);
          this.spawnFloatText(food.x, food.y, '+food', 0xf8f3a2);
          this.destroyWithVisual(food);
        }
      }

      if (this.time.now >= creature.hazardCooldownUntil) {
        const hitPoison = this.poison.some(
          (poison) =>
            Phaser.Math.Distance.Between(creature.sprite.x, creature.sprite.y, poison.x, poison.y) <
            creature.sprite.radius + 12,
        );
        if (hitPoison) {
          creature.poisonHits += 1;
          creature.health -= POISON_DAMAGE;
          creature.state = 'Poisoned';
          creature.hazardCooldownUntil = this.time.now + 650;
          const originalFill = creature.bodyVisual.fillColor;
          creature.bodyVisual.setFillStyle(0xd58cff);
          this.time.delayedCall(140, () => creature.bodyVisual.setFillStyle(originalFill));
          this.spawnFloatText(creature.sprite.x, creature.sprite.y, '-health', 0xdba8ff);
          if (creature.health <= 0) this.killCreature(creature, 'poison');
        }
      }

      const hitPredator = this.predators.some(
        (predator) =>
          Phaser.Math.Distance.Between(creature.sprite.x, creature.sprite.y, predator.sprite.x, predator.sprite.y) <
          creature.sprite.radius + 18,
      );
      if (hitPredator) {
        creature.predatorHits += 1;
        creature.health -= PREDATOR_DAMAGE;
        this.spawnFloatText(creature.sprite.x, creature.sprite.y, 'caught', 0xff9b9b);
        this.killCreature(creature, 'predator');
      }

      creature.fitness = calculateCreatureFitness(creature);
    }
  }

  private endGeneration() {
    if (this.status !== 'running') return;
    this.status = 'complete';
    this.physics.world.isPaused = true;
    this.creatures.forEach((creature) => {
      const body = creature.sprite.body as Phaser.Physics.Arcade.Body | null;
      body?.setVelocity(0, 0);
      creature.fitness = calculateCreatureFitness(creature);
    });
    this.predators.forEach((predator) => {
      const body = predator.sprite.body as Phaser.Physics.Arcade.Body | null;
      body?.setVelocity(0, 0);
    });

    const scored = this.toScoredGenomes();
    const next = createNextPopulation(scored, this.rng, this.generation + 1);
    this.nextGenerationGenomes = next.genomes;
    const summary = summarizeScoredGenomes(
      this.generation,
      scored,
      next.parents.map((parent) => parent.id),
      this.lastSummary,
    );
    this.lastSummary = summary;

    const best = this.creatures
      .filter((creature) => creature.genome.id === summary.bestCreatureId)
      .at(0);
    if (best) this.selectCreature(best);
    else EventBus.emit('creature-selected', null);

    EventBus.emit('generation-summary', summary);
    this.emitUiState();
  }

  private killCreature(creature: CreatureAgent, cause: Exclude<DeathCause, null>) {
    if (!creature.alive) return;
    creature.alive = false;
    creature.deathCause = cause;
    creature.state = cause === 'starvation' ? 'Starved' : cause === 'poison' ? 'Poison death' : 'Predator caught it';
    creature.health = Math.max(0, creature.health);
    creature.energy = Math.max(0, creature.energy);
    creature.fitness = calculateCreatureFitness(creature);
    const body = creature.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    creature.visual.setAlpha(0.35);
    creature.sprite.setAlpha(0.26).setStrokeStyle(2, 0x3b3f45);
  }

  private nearestArc(position: Phaser.Math.Vector2, objects: Array<Phaser.GameObjects.Arc>) {
    let nearest: { distance: number; direction: Phaser.Math.Vector2 } | null = null;
    for (const object of objects) {
      const direction = new Phaser.Math.Vector2(object.x - position.x, object.y - position.y);
      const distance = direction.length();
      if (!nearest || distance < nearest.distance) nearest = { distance, direction: direction.normalize() };
    }
    return nearest;
  }

  private nearestPredator(position: Phaser.Math.Vector2) {
    let nearest: { distance: number; direction: Phaser.Math.Vector2 } | null = null;
    for (const predator of this.predators) {
      const direction = new Phaser.Math.Vector2(predator.sprite.x - position.x, predator.sprite.y - position.y);
      const distance = direction.length();
      if (!nearest || distance < nearest.distance) nearest = { distance, direction: direction.normalize() };
    }
    return nearest;
  }

  private nearestWall(position: Phaser.Math.Vector2) {
    let nearest: { distance: number; direction: Phaser.Math.Vector2 } | null = null;
    for (const wall of this.walls) {
      const bounds = wall.getBounds();
      const closestX = Phaser.Math.Clamp(position.x, bounds.left, bounds.right);
      const closestY = Phaser.Math.Clamp(position.y, bounds.top, bounds.bottom);
      const direction = new Phaser.Math.Vector2(position.x - closestX, position.y - closestY);
      const distance = Math.max(1, direction.length());
      if (!nearest || distance < nearest.distance) nearest = { distance, direction: direction.normalize() };
    }
    return nearest;
  }

  private addBoundaryAvoidance(position: Phaser.Math.Vector2, steering: Phaser.Math.Vector2) {
    const margin = 70;
    if (position.x < margin) steering.x += (margin - position.x) / margin;
    if (position.x > this.scale.width - margin) steering.x -= (position.x - (this.scale.width - margin)) / margin;
    if (position.y < margin) steering.y += (margin - position.y) / margin;
    if (position.y > this.scale.height - margin) steering.y -= (position.y - (this.scale.height - margin)) / margin;
  }

  private drawTrail(creature: CreatureAgent) {
    if (!this.trailsEnabled) return;
    const current = new Phaser.Math.Vector2(creature.sprite.x, creature.sprite.y);
    if (Phaser.Math.Distance.BetweenPoints(current, creature.lastTrailPoint) < 10) return;
    creature.trail.lineStyle(2, 0xf4f1d4, creature.alive ? 0.32 : 0.12);
    creature.trail.lineBetween(creature.lastTrailPoint.x, creature.lastTrailPoint.y, current.x, current.y);
    creature.lastTrailPoint = current;
  }

  private placeSelectedTool(x: number, y: number) {
    const placement = this.canPlaceTool(this.selectedTool, x, y);
    if (!placement.ok) {
      this.spawnFloatText(x, y, placement.message, 0xffd65f);
      return;
    }

    switch (this.selectedTool) {
      case 'food':
        this.placeFood(x, y);
        break;
      case 'poison':
        this.placePoison(x, y);
        break;
      case 'wall':
        this.placeWall(x, y);
        break;
      case 'predator':
        this.placePredator(x, y);
        break;
      case 'erase':
      case 'inspect':
        break;
    }
  }

  private canPlaceTool(tool: ToolType, x: number, y: number): PlacementCheck {
    const placeable = this.toPlaceableTool(tool);
    if (!placeable) return { ok: true };

    const rules = this.arenaRules();
    const counts = rules.counts;
    const label = this.toolLabel(placeable);
    const targetX = placeable === 'wall' ? Math.round(x / WALL_SIZE) * WALL_SIZE : x;
    const targetY = placeable === 'wall' ? Math.round(y / WALL_SIZE) * WALL_SIZE : y;

    if (counts[placeable] >= rules.limits[placeable]) {
      return { ok: false, message: `${label} cap reached` };
    }

    if (placeable !== 'food' && this.isInsideHatchery(targetX, targetY, placeable === 'wall' ? WALL_SIZE * 0.65 : 0)) {
      return { ok: false, message: 'Keep the hatchery open' };
    }

    if (placeable === 'wall' && this.walls.some((wall) => wall.x === targetX && wall.y === targetY)) {
      return { ok: false, message: 'Wall already placed' };
    }

    const nextBudget = rules.budgetUsed + OBJECT_COSTS[placeable];
    if (nextBudget > rules.budgetMax) {
      return { ok: false, message: 'Pressure budget full' };
    }

    return { ok: true };
  }

  private placeFood(x: number, y: number) {
    const item = this.add.circle(x, y, 12, 0xe95548, 0.01).setDepth(14);
    const visual = this.createFoodVisual(x, y);
    item.setData('visual', visual);
    this.food.push(item);
  }

  private placePoison(x: number, y: number) {
    const item = this.add.circle(x, y, 13, 0x8d50d2, 0.01).setDepth(14);
    const visual = this.createPoisonVisual(x, y);
    item.setData('visual', visual);
    this.poison.push(item);
  }

  private placeWall(x: number, y: number) {
    const snappedX = Math.round(x / WALL_SIZE) * WALL_SIZE;
    const snappedY = Math.round(y / WALL_SIZE) * WALL_SIZE;
    const wall = this.add.rectangle(snappedX, snappedY, WALL_SIZE, WALL_SIZE, 0x6c716d, 0.01).setDepth(16);
    const visual = this.createWallVisual(snappedX, snappedY);
    wall.setData('visual', visual);
    this.physics.add.existing(wall, true);
    this.wallGroup.add(wall);
    this.walls.push(wall);
  }

  private placePredator(x: number, y: number) {
    const sprite = this.add.circle(x, y, 20, 0x8a2c8e, 0.01).setDepth(18);
    const visual = this.createPredatorVisual(20);
    visual.setPosition(x, y).setDepth(24);
    this.physics.add.existing(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(20);
    body.setCollideWorldBounds(true, 0.9, 0.9);
    this.physics.add.collider(sprite, this.wallGroup);
    this.predators.push({
      sprite,
      visual,
      bodyVisual: visual.getData('bodyVisual') as Phaser.GameObjects.Ellipse,
      jaw: visual.getData('jaw') as Phaser.GameObjects.Graphics,
      wanderAngle: this.rng.range(0, Math.PI * 2),
    });
    this.updatePredatorVisual(this.predators[this.predators.length - 1], 0);
  }

  private createFoodVisual(x: number, y: number) {
    const berryA = this.add.circle(-5, 2, 7, 0xe95845).setStrokeStyle(2, 0x8e2a24);
    const berryB = this.add.circle(5, 1, 7, 0xf06a4d).setStrokeStyle(2, 0x8e2a24);
    const berryC = this.add.circle(0, -6, 6, 0xf04f43).setStrokeStyle(2, 0x8e2a24);
    const shine = this.add.circle(-7, -1, 2, 0xffd6b7, 0.75);
    const stem = this.add.rectangle(2, -13, 4, 10, 0x62412d).setAngle(18);
    const leaf = this.add.ellipse(8, -13, 10, 5, 0x4f9d38).setAngle(-24);
    return this.add.container(x, y, [stem, leaf, berryA, berryB, berryC, shine]).setDepth(18);
  }

  private createPoisonVisual(x: number, y: number) {
    const cloud = this.add.graphics();
    cloud.fillStyle(0x6935a7, 0.96);
    cloud.fillCircle(-7, 3, 7);
    cloud.fillCircle(5, 2, 8);
    cloud.fillCircle(0, -6, 6);
    cloud.lineStyle(2, 0x321c5c, 1);
    cloud.strokeCircle(-7, 3, 7);
    cloud.strokeCircle(5, 2, 8);
    cloud.strokeCircle(0, -6, 6);
    const sparkle = this.add.circle(4, -4, 2.2, 0xdcb6ff, 0.85);
    const drip = this.add.triangle(-1, 11, 0, 0, 5, 0, 2, 7, 0x4b1f7e, 0.9);
    return this.add.container(x, y, [cloud, sparkle, drip]).setDepth(18);
  }

  private createWallVisual(x: number, y: number) {
    const visual = this.add.container(x, y).setDepth(19);
    const shadow = this.add.rectangle(3, 5, WALL_SIZE, WALL_SIZE * 0.78, 0x1a1c1c, 0.26);
    const back = this.add.rectangle(0, 0, WALL_SIZE, WALL_SIZE * 0.78, 0x5f6461).setStrokeStyle(2, 0x2b3030);
    const top = this.add.rectangle(-2, -6, WALL_SIZE * 0.82, WALL_SIZE * 0.34, 0x858b85).setStrokeStyle(1, 0xa4aaa2);
    const chipA = this.add.rectangle(-9, 2, 8, 6, 0x747b76, 0.9);
    const chipB = this.add.rectangle(8, -2, 9, 7, 0x4c5350, 0.9);
    visual.add([shadow, back, top, chipA, chipB]);
    return visual;
  }

  private eraseAt(x: number, y: number) {
    const targetFood = this.food.find((item) => Phaser.Math.Distance.Between(x, y, item.x, item.y) <= 18);
    if (targetFood) {
      this.food = this.food.filter((item) => item !== targetFood);
      this.destroyWithVisual(targetFood);
      return;
    }

    const targetPoison = this.poison.find((item) => Phaser.Math.Distance.Between(x, y, item.x, item.y) <= 20);
    if (targetPoison) {
      this.poison = this.poison.filter((item) => item !== targetPoison);
      this.destroyWithVisual(targetPoison);
      return;
    }

    const targetPredator = this.predators.find(
      (predator) => Phaser.Math.Distance.Between(x, y, predator.sprite.x, predator.sprite.y) <= 24,
    );
    if (targetPredator) {
      this.predators = this.predators.filter((predator) => predator !== targetPredator);
      targetPredator.visual.destroy();
      targetPredator.sprite.destroy();
      return;
    }

    const targetWall = this.walls.find((wall) => wall.getBounds().contains(x, y));
    if (targetWall) {
      this.walls = this.walls.filter((wall) => wall !== targetWall);
      this.destroyWithVisual(targetWall);
    }
  }

  private resetExperiment() {
    this.physics.world.isPaused = false;
    this.clearEnvironment();
    this.clearCreatures();
    this.selectedCreatureId = null;
    this.status = 'design';
    this.generation = 1;
    this.timeRemainingMs = GENERATION_DURATION_MS;
    this.nextGenerationGenomes = null;
    this.lastSummary = null;
    this.populationGenomes = Array.from({ length: POPULATION_SIZE }, () => createRandomGenome(this.rng, 1));
    this.totalFoodEaten = 0;
    this.seedStarterArena();
    EventBus.emit('creature-selected', null);
    EventBus.emit('generation-summary', null);
    this.emitUiState();
  }

  private clearEnvironment() {
    this.food.forEach((object) => this.destroyWithVisual(object));
    this.poison.forEach((object) => this.destroyWithVisual(object));
    this.predators.forEach((predator) => {
      predator.visual.destroy();
      predator.sprite.destroy();
    });
    this.walls.forEach((wall) => this.destroyWithVisual(wall));
    this.wallGroup.clear(false, false);
    this.food = [];
    this.poison = [];
    this.walls = [];
    this.predators = [];
  }

  private clearCreatures() {
    this.creatures.forEach((creature) => {
      creature.trail.destroy();
      creature.visual.destroy();
      creature.sprite.destroy();
    });
    this.creatures = [];
    this.selectionRing.clear();
    this.leaderRing.clear();
  }

  private findSafeSpawn(index: number) {
    const columns = 5;
    const base = new Phaser.Math.Vector2(104 + (index % columns) * 32, 210 + Math.floor(index / columns) * 32);
    if (!this.pointInsideWall(base.x, base.y, 18)) return base;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = new Phaser.Math.Vector2(this.rng.range(70, 220), this.rng.range(120, this.scale.height - 90));
      if (!this.pointInsideWall(candidate.x, candidate.y, 18)) return candidate;
    }

    return new Phaser.Math.Vector2(70, 120 + index * 5);
  }

  private pointInsideWall(x: number, y: number, padding = 0) {
    return this.walls.some((wall) => {
      const bounds = wall.getBounds();
      return Phaser.Geom.Rectangle.Contains(
        new Phaser.Geom.Rectangle(bounds.x - padding, bounds.y - padding, bounds.width + padding * 2, bounds.height + padding * 2),
        x,
        y,
      );
    });
  }

  private isInsideHatchery(x: number, y: number, padding = 0) {
    return (
      x >= HATCHERY_ZONE.x - padding &&
      x <= HATCHERY_ZONE.x + HATCHERY_ZONE.width + padding &&
      y >= HATCHERY_ZONE.y - padding &&
      y <= HATCHERY_ZONE.y + HATCHERY_ZONE.height + padding
    );
  }

  private toPlaceableTool(tool: ToolType): PlaceableTool | null {
    if (tool === 'food' || tool === 'poison' || tool === 'wall' || tool === 'predator') return tool;
    return null;
  }

  private toolLabel(tool: PlaceableTool) {
    switch (tool) {
      case 'food':
        return 'Food';
      case 'poison':
        return 'Poison';
      case 'wall':
        return 'Wall';
      case 'predator':
        return 'Predator';
    }
  }

  private objectCounts(): ArenaObjectCounts {
    return {
      food: this.food.length,
      poison: this.poison.length,
      wall: this.walls.length,
      predator: this.predators.length,
    };
  }

  private nextRunGeneration() {
    return this.nextGenerationGenomes ? this.generation + 1 : this.generation;
  }

  private challengeLevel() {
    return Phaser.Math.Clamp(this.nextRunGeneration(), 1, 6);
  }

  private arenaLimits(level = this.challengeLevel()): ArenaObjectCounts {
    return {
      food: 10,
      poison: Math.min(8, 2 + level),
      wall: Math.min(18, 6 + level * 2),
      predator: level >= 4 ? 2 : 1,
    };
  }

  private arenaRules(): ArenaRulesState {
    const challengeLevel = this.challengeLevel();
    const counts = this.objectCounts();
    const limits = this.arenaLimits(challengeLevel);
    const pressureUsed =
      counts.wall * OBJECT_COSTS.wall + counts.poison * OBJECT_COSTS.poison + counts.predator * OBJECT_COSTS.predator;
    const pressureRequired = Math.min(8, 2 + challengeLevel);
    const budgetMax = Math.min(18, 10 + (challengeLevel - 1) * 2);
    const foodShortfall = Math.max(0, MIN_FOOD_REQUIRED - counts.food);
    const pressureShortfall = Math.max(0, pressureRequired - pressureUsed);
    const canStart = foodShortfall === 0 && pressureShortfall === 0 && pressureUsed <= budgetMax;
    let message = `Fair trial ready: ${counts.food} food, ${pressureUsed}/${pressureRequired} pressure. Start the 10-specimen run.`;

    if (foodShortfall > 0 && pressureShortfall > 0) {
      message = `Add ${foodShortfall} food and ${pressureShortfall} pressure before starting.`;
    } else if (foodShortfall > 0) {
      message = `Add ${foodShortfall} more food before starting.`;
    } else if (pressureShortfall > 0) {
      message = `Add ${pressureShortfall} pressure: walls, poison, or a predator.`;
    } else if (pressureUsed > budgetMax) {
      message = 'Remove pressure until the trial fits the budget.';
    }

    return {
      challengeLevel,
      foodRequired: MIN_FOOD_REQUIRED,
      budgetUsed: pressureUsed,
      pressureUsed,
      pressureRequired,
      budgetMax,
      counts,
      limits,
      canStart,
      message,
    };
  }

  private selectNearestCreature(x: number, y: number) {
    const target = this.creatures.find((creature) => Phaser.Math.Distance.Between(x, y, creature.sprite.x, creature.sprite.y) < 28);
    if (target) this.selectCreature(target);
    else {
      this.selectedCreatureId = null;
      EventBus.emit('creature-selected', null);
      this.selectionRing.clear();
    }
  }

  private selectCreature(creature: CreatureAgent) {
    this.selectedCreatureId = creature.genome.id;
    EventBus.emit('creature-selected', this.snapshotCreature(creature));
    this.updateSelectionRing();
  }

  private emitSelectedCreature() {
    if (!this.selectedCreatureId) return;
    const selected = this.creatures.find((creature) => creature.genome.id === this.selectedCreatureId);
    if (selected) EventBus.emit('creature-selected', this.snapshotCreature(selected));
  }

  private updateSelectionRing() {
    this.selectionRing.clear();
    if (!this.selectedCreatureId) return;
    const selected = this.creatures.find((creature) => creature.genome.id === this.selectedCreatureId);
    if (!selected) return;
    this.selectionRing.lineStyle(3, 0xf7f6ca, 0.95);
    this.selectionRing.strokeCircle(selected.sprite.x, selected.sprite.y, selected.sprite.radius + 8);
    this.selectionRing.lineStyle(1, 0x182412, 0.75);
    this.selectionRing.strokeCircle(selected.sprite.x, selected.sprite.y, selected.sprite.radius + 12);
  }

  private updateLeaderMarker() {
    this.leaderRing.clear();
    const ranked = this.rankedCreatures(3);
    this.rankBadges.forEach((badge) => badge.setVisible(false));

    ranked.forEach((creature, index) => {
      const badge = this.rankBadges[index];
      if (!badge) return;
      badge
        .setVisible(true)
        .setAlpha(creature.alive ? 1 : 0.48)
        .setPosition(creature.sprite.x, creature.sprite.y - creature.sprite.radius - 22);
    });

    const leader = ranked[0];
    if (!leader) return;

    const pulse = 1 + Math.sin(this.time.now * 0.008) * 0.06;
    const radius = (leader.sprite.radius + 15) * pulse;
    const x = leader.sprite.x;
    const y = leader.sprite.y;
    this.leaderRing.lineStyle(3, 0xffd65f, leader.alive ? 0.95 : 0.45);
    this.leaderRing.strokeCircle(x, y, radius);
    this.leaderRing.fillStyle(0xffd65f, leader.alive ? 0.95 : 0.45);
    this.leaderRing.fillTriangle(x - 11, y - radius - 5, x - 5, y - radius - 17, x + 1, y - radius - 5);
    this.leaderRing.fillTriangle(x - 1, y - radius - 5, x + 6, y - radius - 19, x + 13, y - radius - 5);
    this.leaderRing.fillRect(x - 12, y - radius - 6, 26, 5);
  }

  private createRankBadges() {
    const colors = [0xffd65f, 0xcbd8e8, 0xd29c66];
    return [1, 2, 3].map((rank, index) => {
      const halo = this.add.circle(0, 2, 15, 0x10171d, 0.68);
      const badge = this.add.circle(0, 0, 12, colors[index]).setStrokeStyle(2, 0x19202a);
      const label = this.add
        .text(0, 0, String(rank), {
          color: index === 0 ? '#211708' : '#10171d',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: '900',
        })
        .setOrigin(0.5);
      return this.add.container(0, 0, [halo, badge, label]).setDepth(70).setVisible(false);
    });
  }

  private rankedCreatures(limit = 3) {
    return [...this.creatures]
      .sort((a, b) => {
        const fitnessDelta = calculateCreatureFitness(b) - calculateCreatureFitness(a);
        if (Math.abs(fitnessDelta) > 0.001) return fitnessDelta;
        if (b.foodEaten !== a.foodEaten) return b.foodEaten - a.foodEaten;
        return Number(b.alive) - Number(a.alive);
      })
      .slice(0, limit);
  }

  private leaderSnapshots(): LeaderSnapshot[] {
    return this.rankedCreatures(3).map((creature, index) => ({
      id: creature.genome.id,
      rank: index + 1,
      fitness: calculateCreatureFitness(creature),
      foodEaten: creature.foodEaten,
      alive: creature.alive,
      state: creature.state,
    }));
  }

  private snapshotCreature(creature: CreatureAgent): CreatureSnapshot {
    return {
      id: creature.genome.id,
      generation: this.generation,
      alive: creature.alive,
      health: Math.max(0, creature.health),
      energy: Math.max(0, creature.energy),
      fitness: calculateCreatureFitness(creature),
      foodEaten: creature.foodEaten,
      ageSeconds: creature.ageSeconds,
      genome: creature.genome,
      traits: describeGenomeTraits(creature.genome),
      state: creature.state,
      parentIds: creature.genome.parentIds,
      deathCause: creature.deathCause,
    };
  }

  private toScoredGenomes(): ScoredGenome[] {
    return this.creatures.map((creature) => ({
      genome: creature.genome,
      fitness: calculateCreatureFitness(creature),
      foodEaten: creature.foodEaten,
      alive: creature.alive,
    }));
  }

  private spawnFloatText(x: number, y: number, copy: string, color: number) {
    const label = this.add.text(x, y - 16, copy, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px',
      fontStyle: '700',
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: '#111718',
      strokeThickness: 3,
    });
    label.setDepth(60);
    this.tweens.add({
      targets: label,
      y: y - 44,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private emitUiState() {
    const state: UiState = {
      generation: this.generation,
      status: this.status,
      timeLeftSeconds: Math.max(0, Math.ceil(this.timeRemainingMs / 1000)),
      totalFoodEaten: this.totalFoodEaten,
      objectiveTarget: OBJECTIVE_TARGET,
      speedMultiplier: this.speedMultiplier,
      selectedTool: this.selectedTool,
      aliveCreatures: this.creatures.filter((creature) => creature.alive).length,
      trailsEnabled: this.trailsEnabled,
      leaders: this.leaderSnapshots(),
      arenaRules: this.arenaRules(),
    };
    EventBus.emit('ui-state', state);
  }
}
