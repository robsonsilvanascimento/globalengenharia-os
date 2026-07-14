const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3333';

export interface PortalClientResponse<T = unknown> {
  data: T;
  status: number;
}

export interface PortalClientGetOptions {
  responseType?: 'json' | 'blob';
}

export function createPortalClient(token: string) {
  async function get<T = unknown>(
    path: string,
    options: PortalClientGetOptions = {},
  ): Promise<PortalClientResponse<T>> {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'x-portal-token': token },
    });

    if (!response.ok) {
      const err = Object.assign(new Error(`HTTP ${response.status}`), {
        status: response.status,
      });
      throw err;
    }

    const data: T =
      options.responseType === 'blob'
        ? ((await response.blob()) as unknown as T)
        : ((await response.json()) as T);

    return { data, status: response.status };
  }

  return { get };
}
