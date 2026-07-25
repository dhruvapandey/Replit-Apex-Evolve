import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isPlatformAudioMuted,
  resetPlatformMuteForTests,
  setPlatformMuteReason,
  subscribeToPlatformMute,
} from './platformAudio';

afterEach(resetPlatformMuteForTests);

describe('platform audio muting', () => {
  it('keeps audio muted until every platform reason clears', () => {
    setPlatformMuteReason('platform-setting', true);
    setPlatformMuteReason('advertisement', true);
    setPlatformMuteReason('advertisement', false);
    expect(isPlatformAudioMuted()).toBe(true);
    setPlatformMuteReason('platform-setting', false);
    expect(isPlatformAudioMuted()).toBe(false);
  });

  it('notifies listeners only when effective mute state changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPlatformMute(listener);
    setPlatformMuteReason('advertisement', true);
    setPlatformMuteReason('platform-setting', true);
    setPlatformMuteReason('advertisement', false);
    setPlatformMuteReason('platform-setting', false);
    unsubscribe();
    expect(listener).toHaveBeenNthCalledWith(1, true);
    expect(listener).toHaveBeenNthCalledWith(2, false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
