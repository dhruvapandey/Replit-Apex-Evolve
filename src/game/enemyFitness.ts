export type EnemyCombatOutcome =
  | 'cannon-hit'
  | 'mortar-hit'
  | 'cannon-wall'
  | 'cannon-miss'
  | 'mortar-miss'
  | 'cannon-dodge';

const OUTCOME_FITNESS: Record<EnemyCombatOutcome, number> = {
  'cannon-hit': 45,
  'mortar-hit': 55,
  'cannon-wall': -1.5,
  'cannon-miss': -1,
  'mortar-miss': -2,
  'cannon-dodge': 3,
};

export function enemyCombatOutcomeFitness(outcome: EnemyCombatOutcome) {
  return OUTCOME_FITNESS[outcome];
}

export function enemyPresenceFitness(
  deltaSeconds: number,
  inEffectiveRange: boolean,
  hasLineOfSight: boolean,
  applyingPressure: boolean,
) {
  const survival = 0.22;
  const usefulRange = inEffectiveRange ? 0.12 : 0;
  const pressure = hasLineOfSight && applyingPressure ? 0.16 : 0;
  return Math.max(0, deltaSeconds) * (survival + usefulRange + pressure);
}
