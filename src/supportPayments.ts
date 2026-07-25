const STRIPE_PAYMENT_HOSTS = new Set(['buy.stripe.com', 'donate.stripe.com']);
const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/;

export function normalizeStripePaymentLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !STRIPE_PAYMENT_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function trackedStripePaymentLink(value: string, source: string) {
  const url = new URL(value);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', 'game');
  url.searchParams.set('utm_campaign', 'support_apex_evolve');
  return url.toString();
}

export function normalizeUpiId(value: string | undefined) {
  const upiId = value?.trim();
  return upiId && UPI_ID_PATTERN.test(upiId) ? upiId : null;
}

export function buildUpiPaymentUri(
  upiId: string,
  payeeName: string,
  transactionNote = 'Support APEX EVOLVE development',
) {
  const parameters = new URLSearchParams({
    pa: upiId,
    pn: payeeName.trim() || 'APEX EVOLVE',
    tn: transactionNote,
    cu: 'INR',
  });
  return `upi://pay?${parameters.toString()}`;
}
