import { EventBus } from '../game/EventBus';
import type { UiState } from '../game/types';

interface TopBarProps {
  ui: UiState;
}

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export function TopBar({ ui }: TopBarProps) {
  const progress = Math.min(100, (ui.totalFoodEaten / ui.objectiveTarget) * 100);
  const pauseLabel = ui.status === 'paused' ? 'Resume simulation' : 'Pause simulation';

  return (
    <header className="top-bar panel">
      <div className="metric">
        <span>Generation</span>
        <strong>{ui.generation}</strong>
      </div>
      <div className="objective">
        <div className="objective-copy">
          <span>Objective</span>
          <strong>Eat {ui.objectiveTarget} food & keep survivors</strong>
          <b>{ui.totalFoodEaten}/{ui.objectiveTarget}</b>
        </div>
        <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="metric">
        <span>Alive</span>
        <strong>{ui.status === 'design' ? '—' : ui.aliveCreatures}</strong>
      </div>
      <div className="metric">
        <span>Time left</span>
        <strong>{formatTime(ui.timeLeftSeconds)}</strong>
      </div>
      <div className="run-controls" aria-label="Playback controls">
        <button
          type="button"
          title={pauseLabel}
          aria-label={pauseLabel}
          onClick={() => EventBus.emit('toggle-pause')}
          disabled={ui.status !== 'running' && ui.status !== 'paused'}
        >
          {ui.status === 'paused' ? '▶' : 'Ⅱ'}
        </button>
        <div className="speed-controls compact" aria-label="Simulation speed">
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              type="button"
              className={ui.speedMultiplier === speed ? 'active' : ''}
              title={`${speed}x speed`}
              onClick={() => EventBus.emit('set-speed', speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
