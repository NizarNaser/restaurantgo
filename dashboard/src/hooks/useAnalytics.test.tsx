import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useAnalytics } from './useAnalytics';

function Harness({ analytics }: Parameters<typeof useAnalytics>[0] extends infer T ? { analytics: T } : never) {
  useAnalytics(analytics);
  return null;
}

afterEach(cleanup);

describe('useAnalytics', () => {
  it('injects nothing when the tenant has no ids configured', () => {
    render(<Harness analytics={{ google_analytics_id: null, facebook_pixel_id: null }} />);

    expect(document.head.querySelectorAll('[data-analytics-managed]')).toHaveLength(0);
  });

  it('injects the GA loader + inline config script for a configured measurement id', () => {
    render(<Harness analytics={{ google_analytics_id: 'G-ABC123', facebook_pixel_id: null }} />);

    const scripts = document.head.querySelectorAll('[data-analytics-managed]');
    expect(scripts).toHaveLength(2);

    const loader = Array.from(scripts).find((s) => (s as HTMLScriptElement).src.includes('gtag/js'));
    expect(loader).toBeTruthy();
    expect((loader as HTMLScriptElement).src).toContain('G-ABC123');

    const inline = Array.from(scripts).find((s) => s.textContent?.includes('gtag('));
    expect(inline?.textContent).toContain("gtag('config', \"G-ABC123\")");
  });

  it('injects the Meta Pixel inline script for a configured pixel id', () => {
    render(<Harness analytics={{ google_analytics_id: null, facebook_pixel_id: '999888777' }} />);

    const scripts = document.head.querySelectorAll('[data-analytics-managed]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].textContent).toContain("fbq('init', \"999888777\")");
  });

  it('removes its scripts on unmount', () => {
    const { unmount } = render(<Harness analytics={{ google_analytics_id: 'G-ABC123', facebook_pixel_id: '999888777' }} />);

    expect(document.head.querySelectorAll('[data-analytics-managed]').length).toBeGreaterThan(0);

    unmount();

    expect(document.head.querySelectorAll('[data-analytics-managed]')).toHaveLength(0);
  });
});
