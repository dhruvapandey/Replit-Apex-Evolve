import { useEffect, useMemo, useState } from 'react';
import {
  buildUpiPaymentUri,
  normalizeStripePaymentLink,
  normalizeUpiId,
  trackedStripePaymentLink,
} from '../supportPayments';

const supportEnabled = import.meta.env.VITE_SUPPORT_ENABLED !== 'false';
const stripePaymentLink = normalizeStripePaymentLink(import.meta.env.VITE_STRIPE_DONATION_URL);
const upiId = normalizeUpiId(import.meta.env.VITE_UPI_ID);
const upiPayeeName = import.meta.env.VITE_UPI_PAYEE_NAME?.trim() || 'APEX EVOLVE';

export function SupportDevelopment() {
  const [open, setOpen] = useState(false);
  const [upiQrCode, setUpiQrCode] = useState<string | null>(null);
  const upiPaymentUri = useMemo(
    () => (upiId ? buildUpiPaymentUri(upiId, upiPayeeName) : null),
    [],
  );

  useEffect(() => {
    if (!open || !upiPaymentUri || upiQrCode) return;
    let cancelled = false;
    void import('qrcode')
      .then(({ toDataURL }) => toDataURL(upiPaymentUri, {
        width: 280,
        margin: 1,
        color: { dark: '#06171f', light: '#f4ffff' },
        errorCorrectionLevel: 'M',
      }))
      .then((dataUrl) => {
        if (!cancelled) setUpiQrCode(dataUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [open, upiPaymentUri, upiQrCode]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (!supportEnabled || (!stripePaymentLink && !upiPaymentUri)) return null;

  const openSupport = () => {
    if (document.pointerLockElement) void document.exitPointerLock();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="support-launcher"
        data-game-ui
        onClick={openSupport}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">♥</span>
        SUPPORT THE GAME
      </button>
      {open && (
        <div
          className="support-backdrop"
          data-game-ui
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            className="support-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-title"
          >
            <button
              type="button"
              className="support-close"
              data-game-ui
              onClick={() => setOpen(false)}
              aria-label="Close support options"
            >
              ×
            </button>
            <p className="overline">INDEPENDENT DEVELOPMENT // PLAYER SUPPORTED</p>
            <h2 id="support-title">SUPPORT APEX <span>EVOLVE</span></h2>
            <p className="support-intro">
              Help fund new arenas, smarter rivals, multiplayer mode, combat audio, and the
              public release. Choose any amount—support never changes combat power.
            </p>
            <div className={`support-methods ${stripePaymentLink && upiPaymentUri ? '' : 'single'}`}>
              {stripePaymentLink && (
                <article className="support-method stripe-method">
                  <span className="support-method-kicker">GLOBAL</span>
                  <h3>Stripe</h3>
                  <p>Secure card and compatible local payment checkout hosted by Stripe.</p>
                  <a
                    data-game-ui
                    href={trackedStripePaymentLink(stripePaymentLink, 'apex_evolve')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CHOOSE AMOUNT <span>↗</span>
                  </a>
                </article>
              )}
              {upiPaymentUri && (
                <article className="support-method upi-method">
                  <span className="support-method-kicker">INDIA</span>
                  <h3>UPI</h3>
                  <p>Scan with any UPI app, enter your amount, and verify the payee before paying.</p>
                  <div className="upi-qr-shell">
                    {upiQrCode
                      ? <img src={upiQrCode} alt={`UPI QR code for ${upiPayeeName}`} />
                      : <span className="upi-loading">GENERATING SECURE QR…</span>}
                  </div>
                  <code>{upiId}</code>
                  <a className="upi-deep-link" data-game-ui href={upiPaymentUri}>
                    OPEN UPI APP <span>↗</span>
                  </a>
                </article>
              )}
            </div>
            <small className="support-safety">
              Payments are voluntary and non-refundable. Always verify the payee shown in your
              payment app before confirming.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
