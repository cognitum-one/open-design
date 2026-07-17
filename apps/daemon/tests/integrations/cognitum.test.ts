import { describe, expect, it } from 'vitest';

import {
  localTestLoginConfigured,
  parseMetaProxyAuthStatus,
} from '../../src/integrations/cognitum.js';

describe('Cognitum Meta-Proxy integration', () => {
  it('accepts the redacted auth-status contract', () => {
    expect(
      parseMetaProxyAuthStatus(
        JSON.stringify({
          connected: true,
          credential_source: 'meta_proxy_oauth',
          data_plane: 'cloud',
          access_token_expires_at: 123,
        }),
      ),
    ).toEqual({
      connected: true,
      credential_source: 'meta_proxy_oauth',
      data_plane: 'cloud',
      access_token_expires_at: 123,
    });
  });

  it('rejects malformed or secret-bearing lookalike responses', () => {
    expect(() =>
      parseMetaProxyAuthStatus(
        JSON.stringify({
          connected: true,
          credential_source: 'raw_access_token',
          data_plane: 'cloud',
          access_token: 'must-not-cross-boundary',
        }),
      ),
    ).toThrow('invalid auth status');
  });

  it('enables local test login only with an explicit flag and valid server-side key', () => {
    const key = `cog_${'a'.repeat(64)}`;
    const configured = {
      OD_COGNITUM_LOCAL_TEST_USER: '1',
      OD_COGNITUM_LOCAL_TEST_API_KEY: key,
      RUFLO_STATE_DIR: '/tmp/cognitum-test',
    };
    expect(localTestLoginConfigured(configured)).toBe(true);
    expect(localTestLoginConfigured({ ...configured, NODE_ENV: 'production' })).toBe(false);
    expect(localTestLoginConfigured({ ...configured, RUFLO_STATE_DIR: '' })).toBe(false);
    expect(localTestLoginConfigured({ ...configured, OD_COGNITUM_LOCAL_TEST_USER: '0' })).toBe(false);
    expect(localTestLoginConfigured({ ...configured, OD_COGNITUM_LOCAL_TEST_API_KEY: 'not-a-key' })).toBe(false);
  });
});
