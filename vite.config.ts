import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const EMPTY_SUPPORT_ID = '\0apex:empty-support';
const EMPTY_ANALYTICS_ID = '\0apex:empty-analytics';
const EMPTY_CRAZYGAMES_ID = '\0apex:empty-crazygames';
const EMPTY_ANALYTICS_MODULE = `
  export const analyticsConfigured = () => false;
  export const getAnalyticsConsent = () => "denied";
  export const setAnalyticsConsent = () => {};
  export const initializeAnalytics = () => false;
  export const trackArenaSelected = () => {};
  export const trackEvent = () => false;
  export const trackGameOver = () => {};
  export const trackGameStarted = () => {};
  export const trackModeSelected = () => {};
  export const trackWaveCompleted = () => {};
`;
const EMPTY_CRAZYGAMES_MODULE = `
  export const initializeCrazyGames = async () => false;
  export const crazyGamesLoadingComplete = () => {};
  export const crazyGamesGameplayStart = () => {};
  export const crazyGamesGameplayStop = () => {};
  export const crazyGamesReportProgress = () => {};
  export const isCrazyGamesActive = () => false;
  export const requestCrazyGamesMidgameAd = async () => "skipped";
`;

export default defineConfig(({ command, mode }) => {
  const distribution = mode === 'itch' || mode === 'crazygames' || mode === 'steam'
    ? mode
    : 'web';
  const relativeBundle = distribution !== 'web';
  const distributionStubs = {
    name: 'apex-distribution-stubs',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (command !== 'build') return null;
      if (
        distribution !== 'web'
        && /(?:^|\/)ui\/SupportDevelopment(?:\.tsx)?$/.test(source)
      ) {
        return EMPTY_SUPPORT_ID;
      }
      if (
        distribution !== 'web'
        && distribution !== 'itch'
        && /(?:^|\/)analytics(?:\.ts)?$/.test(source)
      ) {
        return EMPTY_ANALYTICS_ID;
      }
      if (
        distribution !== 'crazygames'
        && /(?:^|\/)crazyGames(?:\.ts)?$/.test(source)
      ) {
        return EMPTY_CRAZYGAMES_ID;
      }
      return null;
    },
    load(id: string) {
      if (id === EMPTY_SUPPORT_ID) {
        return 'export function SupportDevelopment() { return null; }';
      }
      if (id === EMPTY_ANALYTICS_ID) {
        return EMPTY_ANALYTICS_MODULE;
      }
      if (id === EMPTY_CRAZYGAMES_ID) {
        return EMPTY_CRAZYGAMES_MODULE;
      }
      return null;
    },
    transform(_code: string, id: string) {
      if (command !== 'build') return null;
      if (
        distribution !== 'web'
        && /\/ui\/SupportDevelopment\.tsx$/.test(id)
      ) {
        return 'export function SupportDevelopment() { return null; }';
      }
      if (
        distribution !== 'web'
        && distribution !== 'itch'
        && /\/analytics\.ts$/.test(id)
      ) {
        return EMPTY_ANALYTICS_MODULE;
      }
      if (
        distribution !== 'crazygames'
        && /\/crazyGames\.ts$/.test(id)
      ) {
        return EMPTY_CRAZYGAMES_MODULE;
      }
      return null;
    },
  };

  return {
    base: relativeBundle ? './' : '/',
    define: {
      'import.meta.env.VITE_DISTRIBUTION': JSON.stringify(distribution),
    },
    plugins: [distributionStubs, react()],
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
