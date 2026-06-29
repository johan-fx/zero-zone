import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('web ui smoke shell', () => {
  it('renders the workspace purpose and API health from shared contracts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ service: 'zona-cero-api', ok: true, version: 'test' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: /secure links/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('api-health')).toHaveTextContent('zona-cero-api is online'));
  });
});
