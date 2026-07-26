export function constrainTacticalPan(x: number, z: number, maxDistance = 11.5) {
  const distance = Math.hypot(x, z);
  if (distance <= maxDistance || distance === 0) return { x, z };
  const scale = maxDistance / distance;
  return { x: x * scale, z: z * scale };
}

export function tacticalLookAhead(
  pointerX: number,
  pointerY: number,
  maxDistance = 9.2,
  deadZone = 0.24,
) {
  const pointerDistance = Math.hypot(pointerX, pointerY);
  if (pointerDistance <= deadZone || pointerDistance === 0) return { x: 0, z: 0 };

  const normalizedStrength = Math.min(1, (pointerDistance - deadZone) / (1 - deadZone));
  const easedStrength = normalizedStrength * normalizedStrength * (3 - 2 * normalizedStrength);
  const distance = maxDistance * easedStrength;

  return {
    x: (pointerX / pointerDistance) * distance,
    z: (-pointerY / pointerDistance) * distance,
  };
}

const HELD_COMBAT_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ShiftLeft',
  'ShiftRight',
]);

const SUPPRESSED_COMBAT_KEYS = new Set([
  ...HELD_COMBAT_KEYS,
  'KeyQ',
  'KeyV',
  'KeyC',
  'KeyF',
  'KeyR',
  'KeyM',
  // These nearby accidental keys have no combat action. Suppressing their
  // browser defaults prevents focus from leaving the arena mid-movement.
  'Tab',
  'Backquote',
  'Digit1',
  'Digit2',
]);

export function isHeldCombatKey(code: string) {
  return HELD_COMBAT_KEYS.has(code);
}

export function shouldSuppressCombatKey(code: string) {
  return SUPPRESSED_COMBAT_KEYS.has(code);
}

export function isRestartRunKey(code: string, repeat: boolean) {
  return code === 'Enter' && !repeat;
}
