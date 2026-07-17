import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { CognitumConnectionStatus } from '@open-design/contracts';

const execFileAsync = promisify(execFile);
const DEFAULT_PROXY_URL = 'http://127.0.0.1:11435';
const COMMAND_TIMEOUT_MS = 10_000;
const PROXY_START_TIMEOUT_MS = 5_000;

interface MetaProxyAuthStatus {
  connected: boolean;
  credential_source: 'ruflo_injected' | 'meta_proxy_oauth' | 'api_key' | 'none';
  data_plane: string;
  access_token_expires_at?: number | null;
}

export interface CognitumProxyClientConfig {
  baseUrl: string;
  token: string;
}

export interface CognitumIntegration {
  status(): Promise<CognitumConnectionStatus>;
  login(): Promise<CognitumConnectionStatus>;
  loginLocalTestUser(): Promise<CognitumConnectionStatus>;
  logout(): Promise<CognitumConnectionStatus>;
  ensureClientConfig(): Promise<CognitumProxyClientConfig>;
}

export function localTestLoginConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const key = env.OD_COGNITUM_LOCAL_TEST_API_KEY?.trim() ?? '';
  const isolatedStateDir = env.RUFLO_STATE_DIR?.trim() ?? '';
  return (
    env.NODE_ENV !== 'production'
    && env.OD_COGNITUM_LOCAL_TEST_USER === '1'
    && isolatedStateDir.length > 0
    && /^cog_[a-f\d]{64}$/i.test(key)
  );
}

export function parseMetaProxyAuthStatus(value: string): MetaProxyAuthStatus {
  const parsed = JSON.parse(value) as Partial<MetaProxyAuthStatus>;
  const source = parsed.credential_source;
  if (
    typeof parsed.connected !== 'boolean' ||
    typeof parsed.data_plane !== 'string' ||
    !['ruflo_injected', 'meta_proxy_oauth', 'api_key', 'none'].includes(source ?? '')
  ) {
    throw new Error('Meta-Proxy returned an invalid auth status');
  }
  return {
    connected: parsed.connected,
    credential_source: source as MetaProxyAuthStatus['credential_source'],
    data_plane: parsed.data_plane,
    ...(typeof parsed.access_token_expires_at === 'number'
      ? { access_token_expires_at: parsed.access_token_expires_at }
      : {}),
  };
}

function commandNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}

export function createCognitumIntegration(
  env: NodeJS.ProcessEnv = process.env,
): CognitumIntegration {
  const binary = env.COGNITUM_META_PROXY_BIN?.trim() || 'meta-proxy';
  const proxyUrl = (env.COGNITUM_META_PROXY_URL?.trim() || DEFAULT_PROXY_URL).replace(/\/+$/, '');
  const stateDir = env.RUFLO_STATE_DIR?.trim() || join(homedir(), '.ruflo');
  const tokenPath = join(stateDir, 'proxy-token');
  let loginChild: ChildProcess | null = null;
  let loginError: string | undefined;
  let managedProxy: ChildProcess | null = null;
  let localTestActive = false;
  const localTestAvailable = localTestLoginConfigured(env);
  const localTestKey = env.OD_COGNITUM_LOCAL_TEST_API_KEY?.trim() ?? '';

  async function readAuthStatus(): Promise<MetaProxyAuthStatus | null> {
    try {
      const { stdout } = await execFileAsync(binary, ['auth-status', '--json'], {
        env,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
      });
      return parseMetaProxyAuthStatus(stdout);
    } catch (error) {
      if (commandNotFound(error)) return null;
      throw error;
    }
  }

  async function readProxyToken(): Promise<string> {
    const token = (await readFile(tokenPath, 'utf8')).trim();
    if (!token) throw new Error('Meta-Proxy client token is empty');
    return token;
  }

  async function probeProxy(token?: string): Promise<{
    running: boolean;
    version?: string;
    dataPlane?: string;
    credentialSource?: MetaProxyAuthStatus['credential_source'];
    tenantId?: string;
  }> {
    try {
      const bearer = token ?? (await readProxyToken());
      const response = await fetch(`${proxyUrl}/status`, {
        headers: { Authorization: `Bearer ${bearer}` },
        signal: AbortSignal.timeout(2_500),
      });
      if (!response.ok) return { running: false };
      const body = (await response.json()) as Record<string, unknown>;
      let tenantId: string | undefined;
      try {
        const identityResponse = await fetch(`${proxyUrl}/v1/whoami`, {
          headers: { Authorization: `Bearer ${bearer}` },
          signal: AbortSignal.timeout(2_500),
        });
        if (identityResponse.ok) {
          const identity = (await identityResponse.json()) as Record<string, unknown>;
          if (typeof identity.account_id === 'string' && identity.account_id.trim()) {
            tenantId = identity.account_id.trim();
          }
        }
      } catch {
        // Older Meta-Proxy releases do not expose identity discovery. Status
        // remains usable and the UI simply omits the tenant label.
      }
      return {
        running: true,
        ...(typeof body.version === 'string' ? { version: body.version } : {}),
        ...(typeof body.data_plane === 'string' ? { dataPlane: body.data_plane } : {}),
        ...(typeof body.cloud_credential_source === 'string'
          ? {
              credentialSource:
                body.cloud_credential_source as MetaProxyAuthStatus['credential_source'],
            }
          : {}),
        ...(tenantId ? { tenantId } : {}),
      };
    } catch {
      return { running: false };
    }
  }

  async function status(): Promise<CognitumConnectionStatus> {
    try {
      const auth = await readAuthStatus();
      if (!auth) {
        return {
          installed: false,
          authState: 'disconnected',
          connected: false,
          proxyRunning: false,
        };
      }
      const proxy = await probeProxy();
      const authenticating = loginChild != null;
      return {
        installed: true,
        authState: authenticating
          ? 'authenticating'
          : loginError
            ? 'error'
            : auth.connected
              ? 'connected'
              : 'disconnected',
        connected: auth.connected,
        proxyRunning: proxy.running,
        localTestLoginAvailable: localTestAvailable,
        ...(localTestActive && auth.connected ? { sessionMode: 'local_test' as const } : {}),
        credentialSource: auth.credential_source,
        dataPlane: proxy.dataPlane ?? auth.data_plane,
        ...(proxy.version ? { proxyVersion: proxy.version } : {}),
        ...(proxy.tenantId ? { tenantId: proxy.tenantId } : {}),
        ...(typeof auth.access_token_expires_at === 'number'
          ? { accessTokenExpiresAt: auth.access_token_expires_at }
          : {}),
        ...(loginError ? { error: loginError } : {}),
      };
    } catch (error) {
      return {
        installed: true,
        authState: 'error',
        connected: false,
        proxyRunning: false,
        localTestLoginAvailable: localTestAvailable,
        error: safeError(error),
      };
    }
  }

  async function login(): Promise<CognitumConnectionStatus> {
    if (loginChild) return status();
    localTestActive = false;
    loginError = undefined;
    try {
      loginChild = spawn(binary, ['login', '--browser', '--cloud'], {
        env,
        stdio: 'ignore',
        windowsHide: true,
      });
      loginChild.once('error', (error) => {
        loginError = safeError(error);
        loginChild = null;
      });
      loginChild.once('close', (code) => {
        if (code !== 0) loginError = `Meta-Proxy login exited with code ${code ?? 'unknown'}`;
        loginChild = null;
      });
      return status();
    } catch (error) {
      loginChild = null;
      loginError = safeError(error);
      return status();
    }
  }

  async function loginLocalTestUser(): Promise<CognitumConnectionStatus> {
    if (!localTestAvailable) {
      loginError = 'Local test login is not configured on this daemon.';
      return status();
    }
    if (loginChild) return status();
    loginError = undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(binary, ['login', '--paste-key', '--cloud'], {
          env,
          stdio: ['pipe', 'ignore', 'pipe'],
          windowsHide: true,
        });
        let stderr = '';
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Meta-Proxy local test login timed out'));
        }, COMMAND_TIMEOUT_MS);
        child.stderr?.on('data', (chunk: Buffer | string) => {
          stderr = `${stderr}${String(chunk)}`.slice(-300);
        });
        child.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('close', (code) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(stderr.trim() || `Meta-Proxy login exited with code ${code ?? 'unknown'}`));
        });
        child.stdin?.end(`${localTestKey}\n`);
      });
      localTestActive = true;
      return status();
    } catch (error) {
      localTestActive = false;
      loginError = safeError(error);
      return status();
    }
  }

  async function logout(): Promise<CognitumConnectionStatus> {
    if (loginChild) {
      loginChild.kill('SIGTERM');
      loginChild = null;
    }
    loginError = undefined;
    try {
      await execFileAsync(binary, ['logout'], {
        env,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
      });
    } catch (error) {
      loginError = safeError(error);
    }
    localTestActive = false;
    return status();
  }

  async function ensureClientConfig(): Promise<CognitumProxyClientConfig> {
    const auth = await readAuthStatus();
    if (!auth?.connected) throw new Error('Sign in to Cognitum before starting a Meta-LLM run.');
    const token = await readProxyToken();
    if (!(await probeProxy(token)).running) {
      if (!managedProxy || managedProxy.exitCode !== null) {
        managedProxy = spawn(binary, [], {
          env,
          detached: process.platform !== 'win32',
          stdio: 'ignore',
          windowsHide: true,
        });
        managedProxy.unref();
      }
      const deadline = Date.now() + PROXY_START_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if ((await probeProxy(token)).running) return { baseUrl: `${proxyUrl}/v1`, token };
      }
      throw new Error('Meta-Proxy did not become ready in time.');
    }
    return { baseUrl: `${proxyUrl}/v1`, token };
  }

  return { status, login, loginLocalTestUser, logout, ensureClientConfig };
}
