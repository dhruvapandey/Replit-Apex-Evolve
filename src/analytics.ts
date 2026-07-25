import type { ArenaId } from './game/arenas';
import type { CombatMode } from './game/combatMode';
import { allowsGoogleAnalytics } from './distribution';

type AnalyticsConsent = 'granted' | 'denied' | 'unknown';
type AnalyticsValue = string | number | boolean;
type AnalyticsParameters = Record<string, AnalyticsValue | undefined>;
type Gtag = (
  command: 'config' | 'event' | 'js',
  target: string | Date,
  parameters?: Record<string, AnalyticsValue>,
) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const CONSENT_KEY = 'apex-evolve:analytics-consent:v1';
const PLAY_SESSION_KEY = 'apex-evolve:play-session-count:v1';
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? '';
let initialized = false;
let playSession: PlaySession | null = null;

export type PlaySession = {
  sessionNumber: number;
  returningPlayer: boolean;
};

export type GameAnalyticsContext = {
  mode: CombatMode;
  arena: ArenaId;
  wave: number;
  score?: number;
  lives?: number;
  elapsedSeconds?: number;
};

export function validGoogleMeasurementId(value: string) {
  return /^G-[A-Z0-9]{6,20}$/.test(value);
}

export function analyticsConfigured() {
  return allowsGoogleAnalytics() && validGoogleMeasurementId(MEASUREMENT_ID);
}

export function getAnalyticsConsent(storage: Pick<Storage, 'getItem'> = localStorage): AnalyticsConsent {
  const value = storage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}

export function setAnalyticsConsent(
  consent: Exclude<AnalyticsConsent, 'unknown'>,
  storage: Pick<Storage, 'setItem'> = localStorage,
) {
  storage.setItem(CONSENT_KEY, consent);
  if (consent === 'granted') initializeAnalytics();
}

export function createPlaySession(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): PlaySession {
  const parsed = Number.parseInt(storage.getItem(PLAY_SESSION_KEY) ?? '0', 10);
  const previousSessions = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const sessionNumber = previousSessions + 1;
  storage.setItem(PLAY_SESSION_KEY, String(sessionNumber));
  return { sessionNumber, returningPlayer: previousSessions > 0 };
}

export function initializeAnalytics() {
  if (
    initialized
    || !analyticsConfigured()
    || getAnalyticsConsent() !== 'granted'
  ) return false;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(...args: Parameters<Gtag>) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: true,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
  initialized = true;
  return true;
}

export function trackEvent(name: string, parameters: AnalyticsParameters = {}) {
  if (!initialized || !window.gtag) return false;
  const cleanParameters = Object.fromEntries(
    Object.entries(parameters).filter((entry): entry is [string, AnalyticsValue] => (
      entry[1] !== undefined
    )),
  );
  window.gtag('event', name, cleanParameters);
  return true;
}

export function trackModeSelected(mode: CombatMode) {
  trackEvent('select_content', {
    content_type: 'combat_mode',
    item_id: mode,
  });
}

export function trackArenaSelected(arena: ArenaId) {
  trackEvent('select_content', {
    content_type: 'combat_arena',
    item_id: arena,
  });
}

export function trackGameStarted(context: GameAnalyticsContext) {
  playSession ??= createPlaySession();
  trackEvent('game_session_start', {
    game_mode: context.mode,
    arena_id: context.arena,
    local_session_number: playSession.sessionNumber,
    returning_player: playSession.returningPlayer,
  });
  trackEvent('level_start', levelParameters(context));
}

export function trackWaveCompleted(context: GameAnalyticsContext) {
  trackEvent('level_end', {
    ...levelParameters(context),
    success: true,
  });
  trackEvent('level_start', levelParameters({
    ...context,
    wave: context.wave + 1,
    score: undefined,
    lives: undefined,
    elapsedSeconds: undefined,
  }));
}

export function trackGameOver(context: GameAnalyticsContext) {
  trackEvent('level_end', {
    ...levelParameters(context),
    success: false,
  });
  trackEvent('game_session_end', {
    game_mode: context.mode,
    arena_id: context.arena,
    wave_reached: context.wave,
    score: context.score,
    play_time_seconds: context.elapsedSeconds,
  });
}

function levelParameters(context: GameAnalyticsContext) {
  return {
    level_name: `${context.mode}_${context.wave}`,
    level_number: context.wave,
    game_mode: context.mode,
    arena_id: context.arena,
    score: context.score,
    lives_remaining: context.lives,
    play_time_seconds: context.elapsedSeconds,
  };
}

export function resetAnalyticsForTests() {
  initialized = false;
  playSession = null;
}
