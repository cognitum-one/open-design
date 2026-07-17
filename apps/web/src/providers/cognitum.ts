import type {
  CognitumConnectionStatus,
  CognitumLoginResponse,
  CognitumLogoutResponse,
} from '@open-design/contracts';

export async function fetchCognitumStatus(): Promise<CognitumConnectionStatus> {
  const response = await fetch('/api/cognitum/status', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Cognitum status failed (${response.status})`);
  return (await response.json()) as CognitumConnectionStatus;
}

export async function beginCognitumLogin(): Promise<CognitumLoginResponse> {
  const response = await fetch('/api/cognitum/login', { method: 'POST' });
  const body = (await response.json()) as CognitumLoginResponse;
  if (!response.ok) throw new Error(body.status.error || 'Cognitum login could not start.');
  return body;
}

export async function logoutCognitum(): Promise<CognitumLogoutResponse> {
  const response = await fetch('/api/cognitum/session', { method: 'DELETE' });
  const body = (await response.json()) as CognitumLogoutResponse;
  if (!response.ok) throw new Error(body.status.error || 'Cognitum logout failed.');
  return body;
}
