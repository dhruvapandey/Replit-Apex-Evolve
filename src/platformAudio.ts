export type PlatformMuteReason = 'platform-setting' | 'advertisement';

const muteReasons = new Set<PlatformMuteReason>();
const listeners = new Set<(muted: boolean) => void>();

export function isPlatformAudioMuted() {
  return muteReasons.size > 0;
}

export function setPlatformMuteReason(reason: PlatformMuteReason, muted: boolean) {
  const wasMuted = isPlatformAudioMuted();
  if (muted) muteReasons.add(reason);
  else muteReasons.delete(reason);
  const isMuted = isPlatformAudioMuted();
  if (isMuted !== wasMuted) listeners.forEach((listener) => listener(isMuted));
}

export function subscribeToPlatformMute(listener: (muted: boolean) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetPlatformMuteForTests() {
  muteReasons.clear();
  listeners.clear();
}
