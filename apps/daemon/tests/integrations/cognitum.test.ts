import { describe, expect, it } from 'vitest';

import { parseMetaProxyAuthStatus } from '../../src/integrations/cognitum.js';

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
});
