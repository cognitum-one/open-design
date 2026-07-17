import { describe, expect, it } from 'vitest';

import { isLoopbackBrowserOrigin } from '../../src/routes/cognitum.js';

describe('Cognitum local test login route', () => {
  it('accepts only browser origins on loopback', () => {
    expect(isLoopbackBrowserOrigin('http://localhost:3000')).toBe(true);
    expect(isLoopbackBrowserOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isLoopbackBrowserOrigin('http://[::1]:3000')).toBe(true);
    expect(isLoopbackBrowserOrigin('http://192.168.1.123:3000')).toBe(false);
    expect(isLoopbackBrowserOrigin('https://media.cognitum.one')).toBe(false);
    expect(isLoopbackBrowserOrigin(undefined)).toBe(false);
  });
});
