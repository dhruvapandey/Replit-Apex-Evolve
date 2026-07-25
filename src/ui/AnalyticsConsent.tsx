import { useState } from 'react';
import {
  analyticsConfigured,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from '../analytics';

export function AnalyticsConsent() {
  const [consent, setConsent] = useState(getAnalyticsConsent);
  if (!analyticsConfigured() || consent !== 'unknown') return null;

  const choose = (next: 'granted' | 'denied') => {
    setAnalyticsConsent(next);
    setConsent(next);
  };

  return (
    <aside className="analytics-consent" data-game-ui aria-label="Anonymous analytics choice">
      <p>
        Share anonymous play statistics to help improve balance. No names, payment details,
        chat, or keyboard input are collected.{' '}
        <a href="./privacy.html" target="_blank" rel="noopener noreferrer">Privacy details</a>
      </p>
      <div>
        <button type="button" onClick={() => choose('granted')}>ALLOW ANALYTICS</button>
        <button type="button" className="secondary" onClick={() => choose('denied')}>NO THANKS</button>
      </div>
    </aside>
  );
}
