import type { CreatureSnapshot, GenerationSummary } from '../game/types';

interface InspectorProps {
  creature: CreatureSnapshot | null;
  summary: GenerationSummary | null;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const statPercent = (value: number) => `${Math.max(0, Math.round(value))}/100`;

export function Inspector({ creature, summary }: InspectorProps) {
  return (
    <aside className="inspector panel">
      <div className="inspector-heading">
        <div className="specimen-avatar" aria-hidden="true" />
        <div>
          <p className="eyebrow">Selected specimen</p>
          <h2>{creature ? `Species ${creature.id}` : 'No creature selected'}</h2>
        </div>
      </div>

      {creature ? (
        <>
          <div className="status-pill">{creature.state}</div>
          <dl className="stat-list">
            <div><dt>Health</dt><dd>{statPercent(creature.health)}</dd></div>
            <div><dt>Energy</dt><dd>{statPercent(creature.energy)}</dd></div>
            <div><dt>Fitness</dt><dd>{creature.fitness.toFixed(1)}</dd></div>
            <div><dt>Food eaten</dt><dd>{creature.foodEaten}</dd></div>
            <div><dt>Age</dt><dd>{creature.ageSeconds.toFixed(1)}s</dd></div>
            <div><dt>Speed gene</dt><dd>{percent(creature.genome.speed)}</dd></div>
            <div><dt>Food drive</dt><dd>{percent(creature.genome.foodAttraction)}</dd></div>
            <div><dt>Poison avoidance</dt><dd>{percent(creature.genome.poisonAvoidance)}</dd></div>
            <div><dt>Predator avoidance</dt><dd>{percent(creature.genome.predatorAvoidance)}</dd></div>
            <div><dt>Vision</dt><dd>{Math.round(creature.genome.vision)}</dd></div>
            <div><dt>Efficiency</dt><dd>{percent(creature.genome.energyEfficiency)}</dd></div>
          </dl>
          <p className="eyebrow traits-title">Traits</p>
          <div className="trait-list">
            {creature.traits.map((trait) => <span key={trait}>{trait}</span>)}
          </div>
          <p className="eyebrow traits-title">Ancestry</p>
          <p className="ancestry-copy">
            {creature.parentIds.length > 0 ? creature.parentIds.join(' + ') : 'Founder generation'}
          </p>
          {!creature.alive && creature.deathCause && (
            <p className="death-copy">Cause: {creature.deathCause}</p>
          )}
        </>
      ) : (
        <p className="empty-copy">Start a generation, then click a blob to inspect its behavior and DNA.</p>
      )}

      {summary && (
        <div className="generation-card">
          <p className="eyebrow">Generation {summary.generation} complete</p>
          <strong>{summary.totalFoodEaten} food collected</strong>
          <span>Best fitness: {summary.bestFitness.toFixed(1)}</span>
          <span>Average fitness: {summary.averageFitness.toFixed(1)}</span>
          <span>Best food count: {summary.bestFoodCount}</span>
          <span>Survivors: {summary.survivors}/{summary.population}</span>
          <span>Parents selected: {summary.parentIds.length > 0 ? summary.parentIds.join(', ') : 'fresh founders'}</span>
          <span>
            Improvement:{' '}
            {summary.improvementFromPrevious === null
              ? 'baseline'
              : `${summary.improvementFromPrevious >= 0 ? '+' : ''}${summary.improvementFromPrevious.toFixed(1)}`}
          </span>
        </div>
      )}
    </aside>
  );
}
