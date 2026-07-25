import { DISTRIBUTION_TARGET, type DistributionTarget } from './distribution';
import { setPlatformMuteReason } from './platformAudio';

type CrazyGamesEnvironment = 'local' | 'crazygames' | 'disabled';
type CrazyGamesSettings = {
  disableChat?: boolean;
  muteAudio?: boolean;
};
type CrazyGamesAdCallbacks = {
  adStarted: () => void;
  adFinished: () => void;
  adError: (error: unknown) => void;
};
type CrazyGamesSdk = {
  environment: CrazyGamesEnvironment;
  init: () => Promise<void>;
  game: {
    settings: CrazyGamesSettings;
    addSettingsChangeListener: (listener: (settings: CrazyGamesSettings) => void) => void;
    loadingStart: () => void;
    loadingStop: () => void;
    gameplayStart: () => void;
    gameplayStop: () => void;
    happytime: () => void;
    reportGameCompletedPercentage: (percentage: number) => void;
    setGameContext: (context: Record<string, string | number>) => void;
    clearGameContext: () => void;
  };
  ad: {
    requestAd: (type: 'midgame', callbacks: CrazyGamesAdCallbacks) => void;
  };
};

declare global {
  interface Window {
    CrazyGames?: {
      SDK: CrazyGamesSdk;
    };
  }
}

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
let initialized = false;
let settingsListenerRegistered = false;

export function shouldLoadCrazyGamesSdk(
  target: DistributionTarget,
  hostname: string,
  search: string,
) {
  const parameters = new URLSearchParams(search);
  return target === 'crazygames'
    || hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.endsWith('.crazygames.com')
    || parameters.get('useLocalSdk') === 'true'
    || parameters.get('isCrazyGames') === 'true';
}

function activeSdk() {
  const sdk = window.CrazyGames?.SDK;
  return initialized && sdk?.environment !== 'disabled' ? sdk : null;
}

function loadSdkScript() {
  if (window.CrazyGames?.SDK) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('CrazyGames SDK failed to load')), {
        once: true,
      });
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('CrazyGames SDK failed to load')), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

function applySettings(settings: CrazyGamesSettings) {
  setPlatformMuteReason('platform-setting', settings.muteAudio === true);
}

export async function initializeCrazyGames() {
  if (!shouldLoadCrazyGamesSdk(
    DISTRIBUTION_TARGET,
    window.location.hostname,
    window.location.search,
  )) return false;

  try {
    await loadSdkScript();
    const sdk = window.CrazyGames?.SDK;
    if (!sdk) return false;
    await sdk.init();
    initialized = sdk.environment !== 'disabled';
    if (!initialized) return false;
    applySettings(sdk.game.settings);
    if (!settingsListenerRegistered) {
      sdk.game.addSettingsChangeListener(applySettings);
      settingsListenerRegistered = true;
    }
    sdk.game.loadingStart();
    return true;
  } catch {
    initialized = false;
    return false;
  }
}

export function crazyGamesLoadingComplete() {
  activeSdk()?.game.loadingStop();
}

export function crazyGamesGameplayStart(context: Record<string, string | number>) {
  const sdk = activeSdk();
  if (!sdk) return;
  sdk.game.setGameContext(context);
  sdk.game.gameplayStart();
}

export function crazyGamesGameplayStop() {
  const sdk = activeSdk();
  if (!sdk) return;
  sdk.game.gameplayStop();
  sdk.game.clearGameContext();
}

export function crazyGamesReportProgress(waveCompleted: number) {
  const sdk = activeSdk();
  if (!sdk) return;
  const percentage = completionPercentageForWave(waveCompleted);
  sdk.game.reportGameCompletedPercentage(percentage);
  if (percentage === 100) sdk.game.happytime();
}

export function completionPercentageForWave(waveCompleted: number) {
  return Math.max(0, Math.min(100, Math.round(waveCompleted * 10)));
}

export function isCrazyGamesActive() {
  return activeSdk() !== null;
}

export function requestCrazyGamesMidgameAd() {
  const sdk = activeSdk();
  if (!sdk) return Promise.resolve<'skipped'>('skipped');

  return new Promise<'finished' | 'error'>((resolve) => {
    let resolved = false;
    const finish = (outcome: 'finished' | 'error') => {
      if (resolved) return;
      resolved = true;
      setPlatformMuteReason('advertisement', false);
      applySettings(sdk.game.settings);
      resolve(outcome);
    };
    try {
      sdk.ad.requestAd('midgame', {
        adStarted: () => setPlatformMuteReason('advertisement', true),
        adFinished: () => finish('finished'),
        adError: () => finish('error'),
      });
    } catch {
      finish('error');
    }
  });
}

export function resetCrazyGamesForTests() {
  initialized = false;
  settingsListenerRegistered = false;
}
