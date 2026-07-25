import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameHud } from './game/GameCanvas';
import { LIVES_PER_GENERATION } from './game/progression';
import {
  appendGenerationRecord,
  emptyEvolutionArchive,
  parseEvolutionArchive,
  startEvolutionRun,
  type GenerationRecord,
} from './game/evolutionTelemetry';
import { ARENA_CHOICES, ARENA_CONFIGS, type ArenaId } from './game/arenas';
import { ENEMY_STARTING_POWER } from './game/enemyAi';
import {
  DUEL_STARTING_LIVES,
  enemyCountForMode,
  type CombatMode,
} from './game/combatMode';

const DEVELOPMENT_TELEMETRY = import.meta.env.DEV;
const EVOLUTION_STORAGE_KEY = 'apex-evolve:development-telemetry:v1';

const initialHudForMode = (mode: CombatMode): GameHud => ({
  mode,
  wave: 1,
  enemies: enemyCountForMode(mode),
  lives: mode === 'duel' ? DUEL_STARTING_LIVES : LIVES_PER_GENERATION,
  maxLives: mode === 'duel' ? DUEL_STARTING_LIVES : LIVES_PER_GENERATION,
  opponentLives: mode === 'duel' ? DUEL_STARTING_LIVES : 0,
  opponentMaxLives: mode === 'duel' ? DUEL_STARTING_LIVES : 0,
  playerPower: 1,
  enemyPower: mode === 'duel' ? 1 : ENEMY_STARTING_POWER,
  score: 0, multiplier: 1,
  status: 'READY', bestFitness: 0, mutation: 0, camera: 'COCKPIT',
  weapon: 'CANNON', mortarAmmo: 3, mortarMaxAmmo: 3, mortarRange: 0, mortarElevation: 45,
  artilleryActive: true, enemyMortarIncoming: false,
  flashEffectSeconds: 0, smokeEffectSeconds: 0,
  smokeGrenades: 2, flashGrenades: 2,
  enemyCountermeasures: true,
});

export default function App() {
  const [selectedMode, setSelectedMode] = useState<CombatMode>('evolution');
  const [hud, setHud] = useState(() => initialHudForMode('evolution'));
  const [started, setStarted] = useState(false);
  const [showBrief, setShowBrief] = useState(true);
  const [runId, setRunId] = useState(0);
  const [selectedArena, setSelectedArena] = useState<ArenaId>('city-island');
  const [damagePulse, setDamagePulse] = useState(0);
  const [flashPulse, setFlashPulse] = useState(0);
  const [evolutionArchive, setEvolutionArchive] = useState(() => (
    DEVELOPMENT_TELEMETRY
      ? parseEvolutionArchive(localStorage.getItem(EVOLUTION_STORAGE_KEY))
      : emptyEvolutionArchive()
  ));
  const activeEvolutionRun = useRef<string | null>(null);
  const onHud = useCallback((next: GameHud) => setHud(next), []);
  const onGameOver = useCallback(() => setStarted(false), []);
  const onPlayerDamage = useCallback(() => setDamagePulse((current) => current + 1), []);
  const onPlayerFlash = useCallback(() => setFlashPulse((current) => current + 1), []);
  const onGenerationComplete = useCallback((record: GenerationRecord) => {
    if (!DEVELOPMENT_TELEMETRY || !activeEvolutionRun.current) return;
    setEvolutionArchive((current) => appendGenerationRecord(current, activeEvolutionRun.current!, record));
  }, []);
  const selectMode = (mode: CombatMode) => {
    setSelectedMode(mode);
    setHud(initialHudForMode(mode));
  };

  useEffect(() => {
    if (DEVELOPMENT_TELEMETRY) {
      localStorage.setItem(EVOLUTION_STORAGE_KEY, JSON.stringify(evolutionArchive));
    }
  }, [evolutionArchive]);

  const startRun = () => {
    if (DEVELOPMENT_TELEMETRY && selectedMode === 'evolution') {
      const telemetryRunId = `run-${Date.now()}-${runId + 1}`;
      activeEvolutionRun.current = telemetryRunId;
      setEvolutionArchive((current) => startEvolutionRun(current, telemetryRunId));
    } else {
      activeEvolutionRun.current = null;
    }
    setHud(initialHudForMode(selectedMode));
    setDamagePulse(0);
    setFlashPulse(0);
    setRunId((current) => current + 1);
    setStarted(true);
    setShowBrief(false);
  };

  const activeTacticalEffect = hud.flashEffectSeconds > 0
    ? {
      kind: 'flash',
      label: 'FLASH HIT',
      seconds: Math.ceil(hud.flashEffectSeconds),
    }
    : hud.smokeEffectSeconds > 0
      ? {
        kind: 'smoke',
        label: 'SMOKE HIT',
        seconds: Math.ceil(hud.smokeEffectSeconds),
      }
      : null;

  return (
    <main className="apex-shell">
      <GameCanvas
        key={`run-${runId}-${selectedArena}-${selectedMode}`}
        arenaId={selectedArena}
        mode={selectedMode}
        active={started}
        onHud={onHud}
        onGameOver={onGameOver}
        onPlayerDamage={onPlayerDamage}
        onPlayerFlash={onPlayerFlash}
        onGenerationComplete={onGenerationComplete}
      />
      <div className="vignette" />
      <div key={`damage-${damagePulse}`} className={`damage-flash ${damagePulse > 0 ? 'hit' : ''}`} />
      <div key={`flash-${flashPulse}`} className={`enemy-flash ${flashPulse > 0 ? 'hit' : ''}`} />
      {activeTacticalEffect && (
        <div
          className={`effect-countdown ${activeTacticalEffect.kind}`}
          role="status"
          aria-live="polite"
        >
          <span>{activeTacticalEffect.label}</span>
          <strong>{activeTacticalEffect.seconds}</strong>
        </div>
      )}
      <header className="combat-hud">
        <section className="hud-block shield-block">
          <span className="hud-label">Lives</span>
          <strong>{hud.lives} / {hud.maxLives}</strong>
          <div className="meter"><i style={{ width: `${hud.maxLives ? (hud.lives / hud.maxLives) * 100 : 0}%` }} /></div>
        </section>
        <section className="wave-block">
          <span>{hud.mode === 'duel' ? 'Duel round' : 'Generation'}</span><strong>{String(hud.wave).padStart(2, '0')}</strong>
          <small>{hud.mode === 'duel' ? '1 RIVAL ACTIVE' : `${hud.enemies} HOSTILES ACTIVE`}</small>
        </section>
        <section className="hud-block score-block">
          <span className="hud-label">{hud.mode === 'duel' ? 'Rival armor' : 'Combat score'}</span>
          <strong>{hud.mode === 'duel' ? `${hud.opponentLives} / ${hud.opponentMaxLives}` : hud.score.toLocaleString()}</strong>
          <small>{hud.mode === 'duel' ? `POWER ×${hud.enemyPower.toFixed(2)}` : `MULTIPLIER ×${hud.multiplier.toFixed(1)}`}</small>
        </section>
      </header>

      <aside className="telemetry">
        <span className="hud-label">{hud.mode === 'duel' ? 'Duel telemetry' : 'Evolution telemetry'}</span>
        <div><b>×{hud.enemyPower.toFixed(2)}</b><small>{hud.mode === 'duel' ? 'RIVAL POWER' : 'THREAT POWER'}</small></div>
        {hud.mode === 'duel' ? (
          <div><b>×{hud.playerPower.toFixed(2)}</b><small>PLAYER POWER</small></div>
        ) : (
          <>
            <div><b>{hud.bestFitness.toFixed(0)}</b><small>BEST FITNESS</small></div>
            <div><b>{hud.mutation}%</b><small>MUTATION</small></div>
          </>
        )}
        <div><b>{hud.artilleryActive ? 'ONLINE' : 'NEUTRALIZED'}</b><small>ENEMY ARTILLERY</small></div>
        <div><b>S{hud.smokeGrenades} · F{hud.flashGrenades}</b><small>COUNTERMEASURES</small></div>
        <div><b>{hud.enemyCountermeasures ? 'ARMED' : 'DEPLETED'}</b><small>ENEMY TACTICAL</small></div>
        <div><b>{hud.weapon}</b><small>{hud.weapon === 'MORTAR' ? `${hud.mortarAmmo} / ${hud.mortarMaxAmmo} BURST ROUNDS` : 'WEAPON'}</small></div>
        <div><b>{hud.camera}</b><small>CAMERA</small></div>
      </aside>
      <div className={`reticle ${hud.weapon === 'MORTAR' ? 'mortar-reticle' : ''}`}><i /><b /><span>{hud.weapon === 'MORTAR' ? `BURST ×${hud.mortarAmmo} · ${hud.camera === 'COCKPIT' ? `${Math.round(hud.mortarElevation)}° · ` : 'AUTO · '}${Math.round(hud.mortarRange)}U` : ''}</span></div>
      <div className={`status-line ${hud.enemyMortarIncoming ? 'incoming' : ''}`}><i /> {hud.status}</div>
      <div className="controls-hint">
        {hud.camera === 'TACTICAL' ? (
          <><b>{hud.weapon === 'MORTAR' ? 'CLICK' : 'CLICK/HOLD'}</b> {hud.weapon === 'MORTAR' ? 'BURST' : 'FIRE'} <b>C</b> SMOKE ×{hud.smokeGrenades} <b>F</b> FLASH ×{hud.flashGrenades} <b>MOUSE</b> AIM <b>Q</b> WEAPON <b>WASD</b> MOVE <b>V</b> POV</>
        ) : (
          <><b>{hud.weapon === 'MORTAR' ? 'CLICK' : 'CLICK/HOLD'}</b> {hud.weapon === 'MORTAR' ? 'BURST' : 'FIRE'} <b>C</b> SMOKE ×{hud.smokeGrenades} <b>F</b> FLASH ×{hud.flashGrenades} <b>MOUSE</b> LOOK <b>Q</b> WEAPON <b>WASD</b> MOVE <b>V</b> TACTICAL</>
        )}
      </div>
      {showBrief && (
        <section className="briefing">
          <div className="brief-card">
            <p className="overline">{selectedMode === 'duel' ? 'SYMMETRIC DUEL SYSTEM // ONLINE' : 'NEUROEVOLUTION COMBAT SYSTEM // ONLINE'}</p>
            <h1>APEX <span>EVOLVE</span></h1>
            <p className="lede">{selectedMode === 'duel' ? 'One rival. Equal arsenal. Escalating power.' : 'Every enemy learns from the last generation.'}</p>
            <div className="brief-grid">
              {selectedMode === 'duel' ? (
                <>
                  <div><b>01</b><span>Five lives each</span><small>Cannon, mortar, smoke and flash abilities are available to both tanks.</small></div>
                  <div><b>02</b><span>Win the round</span><small>Break all five rival armor plates before losing your own.</small></div>
                  <div><b>03</b><span>Escalate</span><small>Rival power rises 10% and player power rises 5% every round.</small></div>
                </>
              ) : (
                <>
                  <div><b>01</b><span>Survive the arena</span><small>Drive, aim, and destroy the autonomous tank swarm.</small></div>
                  <div><b>02</b><span>Force adaptation</span><small>The strongest enemy genomes breed after every wave.</small></div>
                  <div><b>03</b><span>Break the loop</span><small>Later generations become faster, bolder, and more accurate.</small></div>
                </>
              )}
            </div>
            <div className="mode-selector">
              <div className="arena-selector-heading">
                <span>SELECT COMBAT MODE</span>
                <small>{selectedMode === 'duel' ? 'No genetic algorithm · fixed round upgrades' : 'Six evolving enemy specialists'}</small>
              </div>
              <div className="mode-options" role="radiogroup" aria-label="Select combat mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedMode === 'evolution'}
                  className={`mode-card ${selectedMode === 'evolution' ? 'selected' : ''}`}
                  onClick={() => selectMode('evolution')}
                >
                  <strong>EVOLUTION WAR</strong>
                  <small>6 specialists · crossover · mutation</small>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedMode === 'duel'}
                  className={`mode-card ${selectedMode === 'duel' ? 'selected' : ''}`}
                  onClick={() => selectMode('duel')}
                >
                  <strong>1 × 1 DUEL</strong>
                  <small>Equal arsenal · 5 lives · auto-upgrades</small>
                </button>
              </div>
            </div>
            <div className="arena-selector">
              <div className="arena-selector-heading">
                <span>SELECT COMBAT ZONE</span>
                <small>{ARENA_CONFIGS[selectedArena].location}</small>
              </div>
              <div className="arena-options" role="radiogroup" aria-label="Select combat arena">
                {ARENA_CHOICES.map((arena) => (
                  <button
                    key={arena.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedArena === arena.id}
                    className={`arena-card ${selectedArena === arena.id ? 'selected' : ''}`}
                    onClick={() => setSelectedArena(arena.id)}
                  >
                    <span className={`arena-preview ${arena.environment}`} aria-hidden="true"><i /><b /></span>
                    <span className="arena-copy">
                      <strong>{arena.name}</strong>
                      <small>{arena.description}</small>
                    </span>
                    <span className="arena-check">{selectedArena === arena.id ? 'SELECTED' : 'CHOOSE'}</span>
                  </button>
                ))}
              </div>
            </div>
            <button className="enter-arena" onClick={startRun}>
              {selectedMode === 'duel' ? 'START 1 × 1 DUEL' : `DEPLOY TO ${ARENA_CONFIGS[selectedArena].name.toUpperCase()}`} <span>→</span>
            </button>
            <small className="system-note">CLICK THE ARENA TO CAPTURE MOUSE • ESC RELEASES • V CHANGES VIEW</small>
          </div>
        </section>
      )}
      {!started && !showBrief && (
        <section className="game-over">
          <div className="game-over-card">
            <p className="overline">COMBAT SYSTEM // RUN TERMINATED</p>
            <h2>GAME OVER</h2>
            <p>All {hud.maxLives} lives lost in {hud.mode === 'duel' ? `Duel Round ${hud.wave}` : `Generation ${hud.wave}`}.</p>
            <div><span>FINAL SCORE</span><strong>{hud.score.toLocaleString()}</strong></div>
            <button onClick={startRun}>RESTART RUN <span>→</span></button>
          </div>
        </section>
      )}
    </main>
  );
}
