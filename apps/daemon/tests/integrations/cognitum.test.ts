import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createCognitumIntegration,
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

  it('starts a fresh proxy before requiring its generated client token', async () => {
    if (process.platform === 'win32') return;
    const stateDir = await mkdtemp(join(tmpdir(), 'cognitum-proxy-first-run-'));
    const binary = join(stateDir, 'fake-meta-proxy');
    const token = 'local-test-proxy-token';
    const server = createServer((req, res) => {
      if (req.headers.authorization !== `Bearer ${token}`) {
        res.writeHead(401).end();
        return;
      }
      res.setHeader('content-type', 'application/json');
      if (req.url === '/status') {
        res.end(JSON.stringify({ version: 'test', data_plane: 'cloud' }));
        return;
      }
      if (req.url === '/v1/whoami') {
        res.end(JSON.stringify({ account_id: 'tenant-first-run' }));
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mock server did not bind');
    await writeFile(binary, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
if (process.argv.includes('auth-status')) {
  process.stdout.write(JSON.stringify({ connected: true, credential_source: 'api_key', data_plane: 'cloud' }));
} else {
  const state = process.env.RUFLO_STATE_DIR;
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, 'proxy-token'), '${token}');
}
`);
    await chmod(binary, 0o700);

    try {
      const integration = createCognitumIntegration({
        ...process.env,
        COGNITUM_META_PROXY_BIN: binary,
        COGNITUM_META_PROXY_URL: `http://127.0.0.1:${address.port}`,
        RUFLO_STATE_DIR: stateDir,
      });
      await expect(integration.ensureClientConfig()).resolves.toEqual({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        token,
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});
