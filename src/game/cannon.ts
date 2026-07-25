export const CANNON_MIN_PITCH = -Math.PI / 3;
export const CANNON_MAX_PITCH = Math.PI / 2;

export function clampCannonPitch(pitch: number) {
  return Math.min(CANNON_MAX_PITCH, Math.max(CANNON_MIN_PITCH, pitch));
}

export function cannonPitchFromPointer(pointerY: number) {
  const normalized = Math.min(1, Math.max(-1, pointerY));
  return normalized >= 0
    ? normalized * CANNON_MAX_PITCH
    : -Math.abs(normalized) * Math.abs(CANNON_MIN_PITCH);
}

export function cannonDirectionForAngles(yaw: number, pitch: number) {
  const elevation = clampCannonPitch(pitch);
  const horizontal = Math.cos(elevation);
  return {
    x: -Math.sin(yaw) * horizontal,
    y: Math.sin(elevation),
    z: -Math.cos(yaw) * horizontal,
  };
}

export function cannonPitchFromDirection(direction: { x: number; y: number; z: number }) {
  return clampCannonPitch(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)));
}

export function convergedCannonTarget(
  muzzle: { x: number; y: number; z: number },
  viewOrigin: { x: number; y: number; z: number },
  viewDirection: { x: number; y: number; z: number },
  distance = 220,
) {
  return {
    x: viewOrigin.x + viewDirection.x * distance - muzzle.x,
    y: viewOrigin.y + viewDirection.y * distance - muzzle.y,
    z: viewOrigin.z + viewDirection.z * distance - muzzle.z,
  };
}
