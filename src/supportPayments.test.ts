import { describe, expect, it } from 'vitest';
import {
  buildUpiPaymentUri,
  normalizeStripePaymentLink,
  normalizeUpiId,
  trackedStripePaymentLink,
} from './supportPayments';

describe('support payment links', () => {
  it('only accepts Stripe-hosted HTTPS payment links', () => {
    expect(normalizeStripePaymentLink('https://donate.stripe.com/example')).toBe(
      'https://donate.stripe.com/example',
    );
    expect(normalizeStripePaymentLink('https://buy.stripe.com/example')).toBe(
      'https://buy.stripe.com/example',
    );
    expect(normalizeStripePaymentLink('https://example.com/stripe')).toBeNull();
    expect(normalizeStripePaymentLink('javascript:alert(1)')).toBeNull();
  });

  it('adds campaign tracking without replacing existing parameters', () => {
    const tracked = new URL(
      trackedStripePaymentLink('https://donate.stripe.com/example?locale=en', 'official_site'),
    );
    expect(tracked.searchParams.get('locale')).toBe('en');
    expect(tracked.searchParams.get('utm_source')).toBe('official_site');
    expect(tracked.searchParams.get('utm_medium')).toBe('game');
  });

  it('validates UPI IDs and creates an amount-free UPI payment request', () => {
    expect(normalizeUpiId('player.support@upi')).toBe('player.support@upi');
    expect(normalizeUpiId('not-a-vpa')).toBeNull();

    const uri = buildUpiPaymentUri('player.support@upi', 'APEX EVOLVE');
    expect(uri).toContain('pa=player.support%40upi');
    expect(uri).toContain('pn=APEX+EVOLVE');
    expect(uri).toContain('cu=INR');
    expect(uri).not.toContain('am=');
  });
});
