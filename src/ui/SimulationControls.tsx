import { EventBus } from '../game/EventBus';
import type { UiState } from '../game/types';

export function SimulationControls({ ui }: { ui: UiState }) {
  const startBlocked = (ui.status === 'design' || ui.status === 'complete') && !ui.arenaRules.canStart;
  const buttonLabel =
    startBlocked
      ? 'Complete arena rules'
      : ui.status === 'complete'
      ? 'Evolve next generation'
      : ui.status === 'running'
        ? 'Pause'
        : ui.status === 'paused'
          ? 'Resume'
          : 'Start generation';
  const helper =
    startBlocked
      ? ui.arenaRules.message
      : ui.status === 'complete'
      ? 'Breed from strongest 20%'
      : ui.status === 'running'
        ? 'Freeze the current run'
        : ui.status === 'paused'
          ? 'Continue observing'
          : '10 specimens · 20 seconds';

  return (
    <div className="simulation-controls">
      <label className="trail-toggle" title="Show or hide creature movement trails">
        <input
          type="checkbox"
          checked={ui.trailsEnabled}
          onChange={(event) => EventBus.emit('set-trails', event.currentTarget.checked)}
        />
        Trails
      </label>
      <button
        className="primary-button"
        type="button"
        onClick={() => EventBus.emit('start-generation')}
        disabled={startBlocked}
      >
        {buttonLabel}
        <small>{helper}</small>
      </button>
    </div>
  );
}
