import { env } from '../config/env.js';
import { ApiErrorResponse, RefreshResponseData } from '../types/auth.js';

let inMemoryAccessToken: string | null = null;
let onUnauthenticatedHandler: (() => void) | null = null;
let refreshPromise: Promise<RefreshResponseData | null> | null = null;

export const setAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const setOnUnauthenticatedHandler = (handler: () => void): void => {
  onUnauthenticatedHandler = handler;
};

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function performRefresh(): Promise<RefreshResponseData | null> {
  try {
    const response = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      setAccessToken(null);
      return null;
    }

    const data = await response.json();
    const refreshData = data.data as RefreshResponseData | undefined;
    if (refreshData?.token) {
      setAccessToken(refreshData.token);
      return refreshData;
    }
    setAccessToken(null);
    return null;
  } catch {
    setAccessToken(null);
    return null;
  } finally {
    refreshPromise = null;
  }
}

export function executeSingleFlightRefresh(): Promise<RefreshResponseData | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh();
  }
  return refreshPromise;
}

export const apiFetch = async <T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${env.apiUrl}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch {
    throw new ApiError('No fue posible conectar con PotroLearn. Inténtalo nuevamente en unos momentos.', 'NETWORK_ERROR', 0);
  }

  // Interceptor para 401 por Access Token expirado (excluyendo /auth/login y /auth/refresh)
  const isAuthAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');
  if (response.status === 401 && !isRetry && !isAuthAuthEndpoint) {
    const refreshResult = await executeSingleFlightRefresh();
    if (refreshResult?.token) {
      // Reintentar la petición original UNA sola vez con el nuevo token
      const retryHeaders = new Headers(options.headers || {});
      if (!retryHeaders.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
        retryHeaders.set('Content-Type', 'application/json');
      }
      retryHeaders.set('Authorization', `Bearer ${refreshResult.token}`);

      const retryOptions: RequestInit = {
        ...options,
        headers: retryHeaders,
        credentials: 'include',
      };

      try {
        response = await fetch(url, retryOptions);
      } catch {
        throw new ApiError('No fue posible conectar con PotroLearn. Inténtalo nuevamente en unos momentos.', 'NETWORK_ERROR', 0);
      }
    }
  }

  if (!response.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse error on non-OK responses
    }

    const code = errorData?.error?.code || 'UNKNOWN_ERROR';
    const message = errorData?.error?.message || `Error en la petición (${response.status})`;

    if (response.status === 401 && !isAuthAuthEndpoint) {
      setAccessToken(null);
      if (onUnauthenticatedHandler) {
        onUnauthenticatedHandler();
      }
    }

    throw new ApiError(message, code, response.status);
  }

  const json = await response.json();
  return json.data as T;
};
