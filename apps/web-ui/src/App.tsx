import { useEffect, useState } from 'react';

import type { HealthResponse } from '@zona-cero/contracts';
import { fetchApiHealth } from './api';
import './styles.css';

type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; health: HealthResponse }
  | { status: 'error'; message: string };

export function App() {
  const [healthState, setHealthState] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    fetchApiHealth()
      .then((health) => {
        if (active) setHealthState({ status: 'ready', health });
      })
      .catch((error: unknown) => {
        if (active) setHealthState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Zona Cero Web UI</p>
        <h1 id="page-title">Secure links and lightweight incident panels</h1>
        <p className="summary">This workspace is ready for slice-based Web/API integration without owning critical domain rules.</p>
      </section>

      <section className="status-card" aria-live="polite">
        <h2>Backend health</h2>
        {healthState.status === 'loading' ? <p>Checking API health…</p> : null}
        {healthState.status === 'ready' ? (
          <p data-testid="api-health">{healthState.health.service} is online ({healthState.health.version})</p>
        ) : null}
        {healthState.status === 'error' ? <p role="alert">{healthState.message}</p> : null}
      </section>
    </main>
  );
}
