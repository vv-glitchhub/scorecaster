import { supabase } from "./supabase";

const configuredBaseUrl = (process.env.EXPO_PUBLIC_SCORECASTER_API_URL || "https://scorecaster.vercel.app")
  .replace(/\/$/, "");

function validateBaseUrl(value: string): string {
  const url = new URL(value);
  const localDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localDevelopment) {
    throw new Error("Scorecaster API must use HTTPS");
  }
  return url.origin;
}

export const apiBaseUrl = validateBaseUrl(configuredBaseUrl);

export class ApiError extends Error {
  status: number;
  requestId: string | null;

  constructor(message: string, status: number, requestId: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  authenticated?: boolean;
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method || "GET";
  const authenticated = options.authenticated ?? true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Request-Id": `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    };

    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    if (authenticated) {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw new ApiError("Sign in is required", 401, null);
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({ error: "Invalid server response" }));
    if (!response.ok) {
      throw new ApiError(
        String(payload?.error || "Request failed"),
        response.status,
        payload?.requestId || response.headers.get("x-request-id")
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timed out", 408, null);
    }
    throw new ApiError(error instanceof Error ? error.message : "Network request failed", 0, null);
  } finally {
    clearTimeout(timeout);
  }
}
