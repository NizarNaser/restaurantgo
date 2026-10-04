import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../i18n', () => ({ default: { language: 'ar' } }));

import api from './axios';

describe('api request interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  interface TestConfig {
    headers: Record<string, string>;
  }

  function runInterceptor(config: TestConfig): TestConfig {
    // axios doesn't expose a way to invoke a registered interceptor directly
    // outside of making a real request — reaching into its internal handler
    // list is the standard way to unit-test one in isolation.
    const handlers = (api.interceptors.request as unknown as {
      handlers: { fulfilled: (c: TestConfig) => TestConfig }[];
    }).handlers;
    return handlers[0].fulfilled(config);
  }

  it('sets Accept-Language to the dashboard\'s current i18n language, not the browser\'s', () => {
    const result = runInterceptor({ headers: {} });
    expect(result.headers['Accept-Language']).toBe('ar');
  });

  it('attaches the Authorization header when a token is stored', () => {
    localStorage.setItem('auth_token', 'abc123');
    const result = runInterceptor({ headers: {} });
    expect(result.headers.Authorization).toBe('Bearer abc123');
  });

  it('omits Authorization when no token is stored', () => {
    const result = runInterceptor({ headers: {} });
    expect(result.headers.Authorization).toBeUndefined();
  });
});
