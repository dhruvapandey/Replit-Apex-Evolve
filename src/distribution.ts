export type DistributionTarget = 'web' | 'itch' | 'crazygames' | 'steam';

const KNOWN_TARGETS = new Set<DistributionTarget>([
  'web',
  'itch',
  'crazygames',
  'steam',
]);

export function normalizeDistributionTarget(value: string | undefined): DistributionTarget {
  return value && KNOWN_TARGETS.has(value as DistributionTarget)
    ? value as DistributionTarget
    : 'web';
}

export const DISTRIBUTION_TARGET = normalizeDistributionTarget(
  import.meta.env.VITE_DISTRIBUTION,
);

export const allowsExternalSupport = (target = DISTRIBUTION_TARGET) => target === 'web';

export const allowsGoogleAnalytics = (target = DISTRIBUTION_TARGET) => (
  target === 'web' || target === 'itch'
);
