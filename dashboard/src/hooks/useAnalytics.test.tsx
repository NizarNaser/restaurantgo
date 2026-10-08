import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAnalytics } from './useAnalytics';

const SLUG = 'test-restaurant';
const CONSENT_KEY = `cookie_consent_${SLUG}`;

function Harness({ analytics }: Parameters<typeof useAnalytics>[0] extends infer T ? { analytics: T } : never) {
  useAnalytics(analytics);
  return null;
}

function renderAtSlug(analytics: Parameters<typeof useAnalytics>[0]) {
  return render(
    <MemoryRouter initialEntries={[`/p/${SLUG}`]}>
      <Routes>
        <Route path="/p/:slug" element={<Harness analytics={analytics} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('useAnalytics', () => {
  it('injects nothing when the tenant has no ids configured, even with consent', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    renderAtSlug({ google_analytics_id: null, facebook_pixel_id: null });

    expect(document.head.querySelectorAll('[data-analytics-managed]')).toHaveLength(0);
  });

  // PRIV-01 (COMPLIANCE_SECURITY_PAYMENTS_PLAN.md): these are non-essential
  // tracking scripts, so under GDPR/ePrivacy they must never load before an
  // explicit opt-in — not even transiently before the user decides.
  it('injects nothing when the visitor has not given cookie consent, regardless of configured ids', () => {
    renderAtSlug({ google_analytics_id: 'G-ABC123', facebook_pixel_id: '999888777' });

    expect(document.head.querySelectorAll('[data-analytics-managed]')).toHaveLength(0);
  });

  it('injects nothing when the visitor declined cookie consent', () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    renderAtSlug({ google_analytics_id: 'G-ABC123', facebook_pixel_id: '999888777' });

    expect(document.head.querySelectorAll('[data-analytics-managed]')).toHaveLength(0);
  });

  it('injects the GA loader + inline config script once the visitor has accepted', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    renderAtSlug({ google_analytics_id: 'G-ABC123', facebook_pixel_id: null });

    const scripts = document.head.querySelectorAll('[data-analytics-managed]');
    expect(scripts).toHaveLength(2);

    const loader = Array.from(scripts).find((s) => (s as HTMLScriptElement).src.includes('gtag/js'));
    expect(loader).toBeTruthy();
    expect((loader as HTMLScriptElement).src).toContain('G-ABC123');

    const inline = Array.from(scripts).find((s) => s.textContent?.includes('gtag('));
    expect(inline?.textContent).toContain("gtag('config', \"G-ABC123\")");
  });

  it('injects the Meta Pixel inline script once the visitor has accepted', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    renderAtSlug({ google_analytics_id: null, facebook_pixel_id: '999888777' });

    const scripts = document.head.querySelectorAll('[data-analytics-managed]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].textContent).toContain("fbq('init', \"999888777\")");
  });

  it('removes its scripts on unmount', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    const { unmount } = renderAtSlug({ google_analytics_id: 'G-ABC123', facebook_pixel_id: '999888777' });

    expect(document.head.querySelectorAll('[data-analytics-managed]').length).toBeGreaterThan(0);

    unmount();

    expect(document.head.querySelectorAll('[data-analytics-managed]')).toHaveLength(0);
  });
});
