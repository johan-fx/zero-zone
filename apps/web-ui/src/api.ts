import { HealthResponseSchema, type HealthResponse } from '@zona-cero/contracts';

const defaultApiBaseUrl = 'http://127.0.0.1:8787';

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;
}

export async function fetchApiHealth(fetcher: typeof fetch = fetch): Promise<HealthResponse> {
  const response = await fetcher(`${getApiBaseUrl()}/health`);

  if (!response.ok) {
    throw new Error(`Healthcheck failed with status ${response.status}`);
  }

  return HealthResponseSchema.parse(await response.json());
}
