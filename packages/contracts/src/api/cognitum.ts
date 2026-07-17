export type CognitumAuthState = 'disconnected' | 'authenticating' | 'connected' | 'error';

/** Redacted Meta-Proxy connection state. Credential material never enters the web contract. */
export interface CognitumConnectionStatus {
  installed: boolean;
  authState: CognitumAuthState;
  connected: boolean;
  proxyRunning: boolean;
  credentialSource?: 'ruflo_injected' | 'meta_proxy_oauth' | 'api_key' | 'none';
  dataPlane?: string;
  proxyVersion?: string;
  /** Server-derived Cognitum account identifier. Never accepted from browser input. */
  tenantId?: string;
  accessTokenExpiresAt?: number;
  error?: string;
}

export interface CognitumLoginResponse {
  accepted: boolean;
  status: CognitumConnectionStatus;
}

export interface CognitumLogoutResponse {
  ok: boolean;
  status: CognitumConnectionStatus;
}
