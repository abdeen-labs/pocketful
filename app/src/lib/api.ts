import type { PassSpec } from '@/types';

export interface CreatePassResponse {
  id: string;
  url: string;
  expiresAt: string;
  /** Present when the pass was created with `updatable: true`. */
  serialNumber?: string;
  updatable?: boolean;
}

export async function createPass(
  serverUrl: string,
  spec: PassSpec,
  token?: string
): Promise<CreatePassResponse> {
  const base = serverUrl.trim().replace(/\/+$/, '');

  let response: Response;
  try {
    response = await fetch(`${base}/api/passes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(spec),
    });
  } catch {
    throw new Error(`Could not reach ${base}. Check the server URL and your connection.`);
  }

  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      // non-JSON error body; use it as-is
    }
    throw new Error(message || `Server responded with ${response.status}`);
  }
  return JSON.parse(text) as CreatePassResponse;
}
