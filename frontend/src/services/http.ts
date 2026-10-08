/**
 * ChatDesk Frontend - HTTP Service & Fetch Wrapper
 *
 * Implements in-memory access token storage, automatic cookie-based refresh on 401,
 * concurrent request queuing during refresh, and typed error mapping.
 */

export class ApiError extends Error {
  statusCode: number;
  errorName: string;
  details?: any;
  code?: string;

  constructor(statusCode: number, errorName: string, message: string, details?: any, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorName = errorName;
    this.details = details;
    this.code = code;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Session expired or unauthorized', details?: any) {
    super(401, 'Unauthorized', message, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden', details?: any) {
    super(403, 'Forbidden', message, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Requested resource not found', details?: any) {
    super(404, 'NotFound', message, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict or already taken over by another staff', details?: any) {
    super(409, 'Conflict', message, details);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details?: any) {
    super(400, 'ValidationError', message, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitedError extends ApiError {
  constructor(message = 'Too many requests. Please try again later.', details?: any) {
    super(429, 'RateLimited', message, details);
    this.name = 'RateLimitedError';
  }
}

export class WindowClosedError extends ApiError {
  constructor(
    message = 'WhatsApp 24-hour customer care window has expired. Only approved template messages can be sent.',
    details?: any
  ) {
    super(400, 'WindowClosed', message, details, 'OUTSIDE_24H_WINDOW');
    this.name = 'WindowClosedError';
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connection failure. Please check your internet connection.', details?: any) {
    super(0, 'NetworkError', message, details);
    this.name = 'NetworkError';
  }
}

// In-Memory Token Management (Never stored in localStorage)
let inMemoryAccessToken: string | null = null;
let unauthorizedListeners: Array<() => void> = [];

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
}

export function onUnauthorized(callback: () => void): () => void {
  unauthorizedListeners.push(callback);
  return () => {
    unauthorizedListeners = unauthorizedListeners.filter((cb) => cb !== callback);
  };
}

function notifyUnauthorized(): void {
  clearAccessToken();
  unauthorizedListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore listener error
    }
  });
}

// Concurrency Queue for token refreshing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  retry: () => Promise<any>;
}> = [];

function processQueue(error: Error | null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.retry().then(prom.resolve, prom.reject);
    }
  });
  failedQueue = [];
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:3000/api/v1';
}

function formatUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

function parseErrorMessage(data: any, statusText: string): { message: string; details?: any; code?: string } {
  let message = statusText;
  let details: any = undefined;
  let code: string | undefined = undefined;

  if (data && typeof data === 'object') {
    if (data.code) code = String(data.code);

    if (Array.isArray(data.message)) {
      message = data.message.join(', ');
      details = data.message;
    } else if (typeof data.message === 'string') {
      message = data.message;
    } else if (data.error && typeof data.error === 'string') {
      message = data.error;
    }
  }

  return { message, details, code };
}

function mapToTypedError(statusCode: number, data: any, statusText: string): ApiError {
  const { message, details, code } = parseErrorMessage(data, statusText);
  const msgLower = message.toLowerCase();

  // 24-hr Meta Window closed detection
  if (
    code === 'OUTSIDE_24H_WINDOW' ||
    msgLower.includes('24-hour') ||
    msgLower.includes('window has expired') ||
    msgLower.includes('messaging window')
  ) {
    return new WindowClosedError(message, details);
  }

  switch (statusCode) {
    case 401:
      return new UnauthorizedError(message, details);
    case 403:
      return new ForbiddenError(message, details);
    case 404:
      return new NotFoundError(message, details);
    case 409:
      return new ConflictError(message, details);
    case 400:
    case 422:
      return new ValidationError(message, details);
    case 429:
      return new RateLimitedError(message, details);
    default:
      return new ApiError(statusCode, 'HttpError', message, details, code);
  }
}

/**
 * Core fetch wrapper with automatic JWT injection, cookie refresh on 401, and request queuing.
 */
export async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = formatUrl(path);
  const headers = new Headers(options.headers || {});

  // Inject in-memory access token if available and not already set
  if (inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Always send httpOnly refreshToken cookies
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkErr: any) {
    throw new NetworkError(networkErr?.message || 'Network request failed');
  }

  // Handle 401 Unauthorized -> Attempt token refresh
  const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/refresh');
  if (response.status === 401 && !isAuthRoute) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshResponse = await fetch(formatUrl('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!refreshResponse.ok) {
          const refreshError = new UnauthorizedError('Session expired. Please log in again.');
          processQueue(refreshError);
          notifyUnauthorized();
          throw refreshError;
        }

        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData?.accessToken;

        if (newAccessToken) {
          setAccessToken(newAccessToken);
          isRefreshing = false;
          processQueue(null);
          // Retry the original failed request
          return request<T>(path, options);
        } else {
          throw new UnauthorizedError('Missing token in refresh response');
        }
      } catch (err) {
        isRefreshing = false;
        notifyUnauthorized();
        throw err instanceof ApiError ? err : new UnauthorizedError('Refresh failed');
      }
    } else {
      // Queue this concurrent request while refresh is in flight
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({
          resolve,
          reject,
          retry: () => request<T>(path, options),
        });
      });
    }
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw mapToTypedError(response.status, data, response.statusText);
  }

  return data as T;
}

export const http = {
  get: <T = any>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T = any>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
