const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists (or clears, when `tokens` is null) the auth tokens used by the
 * http client. Called by the auth store after login/refresh/logout so this
 * module stays the single source of truth for what is stored where.
 */
export function setStoredTokens(tokens: { accessToken: string; refreshToken: string } | null): void {
  try {
    if (tokens) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors (e.g. private browsing mode)
  }
}

let unauthorizedHandler: (() => void) | null = null;

/**
 * Registers the callback invoked when an authenticated request fails with
 * 401 and the automatic refresh attempt also fails. Kept as a plain
 * callback (instead of importing the auth store directly) to avoid a
 * circular dependency between httpClient <-> authStore.
 */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      try {
        const response = await fetch(buildUrl('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as { accessToken: string; refreshToken: string };
        setStoredTokens(data);
        return data.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, BASE_URL || window.location.origin);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return BASE_URL ? url.toString() : `${url.pathname}${url.search}`;
}

/** Auth endpoints must never trigger the refresh-and-retry flow themselves. */
function isAuthEndpoint(path: string): boolean {
  return path.startsWith('/auth/');
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
  },
  isRetry = false,
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, options?.params), {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const hasJsonBody = contentType.includes('application/json');
  const parsedBody = hasJsonBody ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    if (response.status === 401 && !isRetry && !isAuthEndpoint(path)) {
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        return request<T>(method, path, options, true);
      }

      setStoredTokens(null);
      unauthorizedHandler?.();
    }

    const message =
      (parsedBody && typeof parsedBody === 'object' && 'message' in parsedBody
        ? String((parsedBody as { message?: unknown }).message)
        : undefined) ?? response.statusText;

    throw new ApiError(response.status, message, parsedBody);
  }

  return parsedBody as T;
}

async function requestBlob(path: string, isRetry = false): Promise<Blob> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), { method: 'GET', headers });

  if (!response.ok) {
    if (response.status === 401 && !isRetry && !isAuthEndpoint(path)) {
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        return requestBlob(path, true);
      }

      setStoredTokens(null);
      unauthorizedHandler?.();
    }

    throw new ApiError(response.status, response.statusText);
  }

  return response.blob();
}

export const httpClient = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return request<T>('GET', path, { params });
  },
  /** Fetches a binary response (e.g. media files) as a `Blob`, with the same auth/refresh handling as `get`. */
  getBlob(path: string): Promise<Blob> {
    return requestBlob(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, { body });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, { body });
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PUT', path, { body });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};
