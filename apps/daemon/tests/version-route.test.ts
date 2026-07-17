import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../src/server.js';

describe('/api/version', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = await startServer({ port: 0, returnServer: true }) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('returns current app version info', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    const json = await res.json() as unknown;

    expect(res.ok).toBe(true);
    expect(json).toEqual({
      version: {
        version: expect.any(String),
        channel: expect.any(String),
        packaged: expect.any(Boolean),
        platform: expect.any(String),
        arch: expect.any(String),
      },
    });
  });

  it('keeps health version aligned with version endpoint', async () => {
    const [healthRes, versionRes] = await Promise.all([
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/api/version`),
    ]);
    const health = await healthRes.json() as { ok?: unknown; version?: unknown };
    const version = await versionRes.json() as { version?: { version?: unknown } };

    expect(healthRes.ok).toBe(true);
    expect(versionRes.ok).toBe(true);
    expect(health).toEqual({
      ok: true,
      version: version.version?.version,
      distribution: {
        id: 'open-design',
        productName: 'Open Design',
        profile: 'open-design',
      },
    });
  });

  it('publishes the Media Factory distribution identity from deployment config', async () => {
    const previous = {
      id: process.env.OD_DISTRIBUTION_ID,
      product: process.env.OD_PRODUCT_NAME,
      profile: process.env.OD_BRAND_PROFILE,
    };
    process.env.OD_DISTRIBUTION_ID = 'cognitum-media-factory';
    process.env.OD_PRODUCT_NAME = 'Cognitum Media Factory';
    process.env.OD_BRAND_PROFILE = 'cognitum-media-factory';
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const health = await response.json() as { distribution?: unknown };
      expect(health.distribution).toEqual({
        id: 'cognitum-media-factory',
        productName: 'Cognitum Media Factory',
        profile: 'cognitum-media-factory',
      });
    } finally {
      restoreEnvironment('OD_DISTRIBUTION_ID', previous.id);
      restoreEnvironment('OD_PRODUCT_NAME', previous.product);
      restoreEnvironment('OD_BRAND_PROFILE', previous.profile);
    }
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
