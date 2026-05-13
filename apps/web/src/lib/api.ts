import { useAuthStore } from "@/stores/auth-store";

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

const BASE_URL = "";

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function subscribeRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

async function tryRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      subscribeRefresh((token) => resolve(token));
    });
  }

  isRefreshing = true;
  try {
    const success = await useAuthStore.getState().refresh();
    const newToken = useAuthStore.getState().token;
    if (success && newToken) {
      onRefreshed(newToken);
      return newToken;
    }
    return null;
  } finally {
    isRefreshing = false;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      message = body.error ?? message;
      code = body.code;
    } catch {
      // ignore
    }
    throw new APIError(message, res.status, code);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = useAuthStore.getState().token;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function requestWithRefresh<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (res.status !== 401) {
      return handleResponse<T>(res);
    }
  } catch (err) {
    throw err;
  }

  // 401 — try refresh once
  const newToken = await tryRefresh();
  if (!newToken) {
    // Refresh failed — propagate 401
    throw new APIError("Unauthorized", 401);
  }

  // Retry with new token
  const retryRes = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${newToken}`,
    },
  });
  return handleResponse<T>(retryRes);
}

export async function get<T>(path: string): Promise<T> {
  return requestWithRefresh<T>(`${BASE_URL}${path}`, {
    method: "GET",
    headers: getHeaders(),
  });
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  return requestWithRefresh<T>(`${BASE_URL}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function del<T>(path: string): Promise<T> {
  return requestWithRefresh<T>(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  return requestWithRefresh<T>(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
}
