import type { Express } from 'express';
import type {
  CognitumLoginResponse,
  CognitumLogoutResponse,
} from '@open-design/contracts';

import type { CognitumIntegration } from '../integrations/cognitum.js';

export interface RegisterCognitumRoutesDeps {
  cognitum: CognitumIntegration;
}

export function registerCognitumRoutes(
  app: Express,
  deps: RegisterCognitumRoutesDeps,
): void {
  app.get('/api/cognitum/status', async (_req, res) => {
    res.json(await deps.cognitum.status());
  });

  app.post('/api/cognitum/login', async (_req, res) => {
    const status = await deps.cognitum.login();
    const body: CognitumLoginResponse = {
      accepted: status.installed && status.authState !== 'error',
      status,
    };
    res.status(body.accepted ? 202 : 503).json(body);
  });

  app.delete('/api/cognitum/session', async (_req, res) => {
    const status = await deps.cognitum.logout();
    const body: CognitumLogoutResponse = {
      ok: status.authState !== 'error',
      status,
    };
    res.status(body.ok ? 200 : 503).json(body);
  });
}
