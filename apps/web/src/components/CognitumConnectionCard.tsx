import { useCallback, useEffect, useState } from 'react';
import { Button } from '@open-design/components';
import type { CognitumConnectionStatus } from '@open-design/contracts';

import {
  beginCognitumLocalTestLogin,
  beginCognitumLogin,
  fetchCognitumStatus,
  logoutCognitum,
} from '../providers/cognitum';
import styles from './CognitumConnectionCard.module.css';

const POLL_MS = 1_000;

export function CognitumConnectionCard({
  canSelect,
  selected,
  onSelect,
}: {
  canSelect: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [status, setStatus] = useState<CognitumConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchCognitumStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refresh().catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (status?.authState !== 'authenticating') return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, status?.authState]);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const response = await beginCognitumLogin();
      setStatus(response.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const response = await logoutCognitum();
      setStatus(response.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function signInLocalTestUser() {
    setBusy(true);
    setError(null);
    try {
      const response = await beginCognitumLocalTestLogin();
      setStatus(response.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connected === true;
  const authenticating = status?.authState === 'authenticating';
  const installed = status?.installed !== false;
  const loopbackBrowser = typeof window !== 'undefined'
    && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const showLocalTestLogin = loopbackBrowser && status?.localTestLoginAvailable === true;
  const tenantLabel = status?.tenantId
    ? `${status.tenantId.slice(0, 8)}${status.tenantId.length > 12 ? `…${status.tenantId.slice(-4)}` : ''}`
    : null;

  return (
    <section className={styles.card} data-testid="cognitum-connection-card">
      <div className={styles.head}>
        <div className={styles.identity}>
          <strong>Cognitum Meta-LLM</strong>
          <span>Tenant-isolated model routing, metering, memory, and continuous optimization.</span>
        </div>
        <span className={styles.status} data-testid="cognitum-connection-status">
          <i className={styles.dot} data-connected={connected} aria-hidden />
          {authenticating ? 'Waiting for Cognitum…' : connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <div className={styles.detail}>
        {installed
          ? `Meta-Proxy ${status?.proxyRunning ? 'running' : 'ready'}${status?.dataPlane ? ` · ${status.dataPlane} plane` : ''}${tenantLabel ? ` · tenant ${tenantLabel}` : ''}`
          : 'Install Meta-Proxy to enable Cognitum OAuth and Meta-LLM routing.'}
      </div>
      <div className={styles.actions}>
        {connected ? (
          <>
            <Button variant="primary" onClick={onSelect} disabled={!canSelect || selected}>
              {selected ? 'Using Cognitum' : 'Use Cognitum'}
            </Button>
            <Button variant="ghost" onClick={() => void signOut()} disabled={busy}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={() => void signIn()}
              disabled={busy || authenticating || !installed}
            >
              {authenticating ? 'Complete sign-in in your browser' : 'Sign in with Cognitum'}
            </Button>
            {showLocalTestLogin ? (
              <Button
                variant="ghost"
                onClick={() => void signInLocalTestUser()}
                disabled={busy || authenticating || !installed}
              >
                Use local test user
              </Button>
            ) : null}
          </>
        )}
      </div>
      {status?.sessionMode === 'local_test' ? (
        <span className={styles.testMode}>Local test session · server-configured credential</span>
      ) : null}
      {error || status?.error ? (
        <span className={styles.error} role="alert">{error || status?.error}</span>
      ) : null}
    </section>
  );
}
