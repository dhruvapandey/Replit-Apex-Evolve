import { EventBus } from '../game/EventBus';
import type { ToolType, UiState } from '../game/types';

type PlaceableTool = 'food' | 'poison' | 'wall' | 'predator';

const toolCosts: Record<PlaceableTool, number> = { food: 0, poison: 2, wall: 1, predator: 5 };

const tools: Array<{ id: ToolType; icon: string; label: string }> = [
  { id: 'inspect', icon: '⌖', label: 'Inspect' },
  { id: 'food', icon: '🍎', label: 'Food' },
  { id: 'poison', icon: '☠️', label: 'Poison' },
  { id: 'wall', icon: '🧱', label: 'Wall' },
  { id: 'predator', icon: '👾', label: 'Predator' },
  { id: 'erase', icon: '⌫', label: 'Erase' },
];

const asPlaceableTool = (tool: ToolType): PlaceableTool | null => {
  if (tool === 'food' || tool === 'poison' || tool === 'wall' || tool === 'predator') return tool;
  return null;
};

export function ToolBar({ ui }: { ui: UiState }) {
  const editingLocked = ui.status === 'running' || ui.status === 'paused';
  const rules = ui.arenaRules;
  const remainingBudget = rules.budgetMax - rules.budgetUsed;
  const foodReady = rules.counts.food >= rules.foodRequired;
  const pressureReady = rules.pressureUsed >= rules.pressureRequired;

  const toolDisabled = (tool: ToolType) => {
    if (editingLocked) return tool !== 'inspect';
    const placeable = asPlaceableTool(tool);
    if (!placeable) return false;
    if (rules.counts[placeable] >= rules.limits[placeable]) return true;
    return toolCosts[placeable] > remainingBudget;
  };

  return (
    <div className="toolbar">
      <div className="toolbar-intro">
        <p className="eyebrow">Environment tools</p>
        <p className="toolbar-help">
          {editingLocked ? 'Editing is locked while a generation is active.' : `Challenge level ${rules.challengeLevel}: build a fair failure test.`}
        </p>
      </div>
      <div className="toolbar-main">
        <div className="rule-strip" aria-label="Arena constraints">
          <span className={`rule-chip ${foodReady ? 'ok' : 'warn'}`}>Food {rules.counts.food}/{rules.foodRequired} min</span>
          <span className={`rule-chip ${pressureReady ? 'ok' : 'warn'}`}>Pressure {rules.pressureUsed}/{rules.pressureRequired}</span>
          <span className="rule-chip">Budget {rules.budgetUsed}/{rules.budgetMax}</span>
          <span className="rule-chip muted">
            Caps F{rules.counts.food}/{rules.limits.food} P{rules.counts.poison}/{rules.limits.poison} W{rules.counts.wall}/{rules.limits.wall} X{rules.counts.predator}/{rules.limits.predator}
          </span>
        </div>
        <div className="tool-list">
          {tools.map((tool) => {
            const placeable = asPlaceableTool(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                className={`tool-button ${ui.selectedTool === tool.id ? 'active' : ''}`}
                title={placeable ? `${tool.label}: ${rules.counts[placeable]}/${rules.limits[placeable]}` : `${tool.label} tool`}
                onClick={() => EventBus.emit('set-tool', tool.id)}
                disabled={toolDisabled(tool.id)}
              >
                <span>{tool.icon}</span>
                {tool.label}
                {placeable && <small>{rules.counts[placeable]}/{rules.limits[placeable]}</small>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="toolbar-actions">
        <button
          type="button"
          className="secondary-button"
          title="Clear placed environment objects"
          onClick={() => EventBus.emit('clear-arena')}
          disabled={editingLocked}
        >
          Clear
        </button>
        <button
          type="button"
          className="secondary-button"
          title="Reset the experiment"
          onClick={() => EventBus.emit('reset-experiment')}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
