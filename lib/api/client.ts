/**
 * Typed fetch wrapper — the single source of truth for all client-side data
 * fetching in this app.
 *
 * Base URL resolution:
 *   - `NEXT_PUBLIC_API_BASE_URL` when set (e.g. pointing at the real backend
 *     once it exists).
 *   - Falls back to same-origin `/api`, which hits our local mock Route
 *     Handlers under `app/api/**`.
 *
 * Because every mock endpoint mirrors the real backend's paths and response
 * shapes 1:1, swapping to the real backend later is just setting the env var
 * — no call-site changes required.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type SearchParamValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  /**
   * Request body. Plain objects/arrays are JSON-serialized automatically
   * (with `Content-Type: application/json` set unless already provided).
   * Strings, FormData, Blob, and URLSearchParams are passed through as-is,
   * which matters for `sendBeacon`-style callers that build their own body.
   */
  body?: unknown;
  /** Appended to the URL as a query string. Nullish values are skipped. */
  searchParams?: Record<string, SearchParamValue>;
}

function buildUrl(
  path: string,
  searchParams?: Record<string, SearchParamValue>
): string {
  const base = path.startsWith("http") ? "" : API_BASE_URL;
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  if (!searchParams) return url;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === null || value === undefined) continue;
    qs.set(key, String(value));
  }
  const qsString = qs.toString();
  if (!qsString) return url;

  return `${url}${url.includes("?") ? "&" : "?"}${qsString}`;
}

function isPlainSerializableBody(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  );
}

async function request<T>(
  path: string,
  { body, searchParams, headers, ...init }: ApiRequestOptions = {}
): Promise<T> {
  const url = buildUrl(path, searchParams);
  const finalHeaders = new Headers(headers);

  let finalBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isPlainSerializableBody(body)) {
      finalBody = body;
    } else {
      finalBody = JSON.stringify(body);
      if (!finalHeaders.has("Content-Type")) {
        finalHeaders.set("Content-Type", "application/json");
      }
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: finalHeaders,
    body: finalBody,
    credentials: init.credentials ?? "include",
  });

  // 204s and other empty bodies never parse as JSON.
  const contentType = res.headers.get("content-type") ?? "";
  const hasBody = res.status !== 204 && res.status !== 205;
  const isJson = contentType.includes("application/json");

  let data: unknown = undefined;
  if (hasBody) {
    data = isJson
      ? await res.json().catch(() => undefined)
      : await res.text().catch(() => undefined);
  }

  if (!res.ok) {
    const fallback = res.statusText || "Request failed";
    const message =
      isJson && data && typeof data === "object" && "error" in data
        ? String((data as Record<string, unknown>).error) || fallback
        : fallback;

    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) => request<T>(path, { ...options, method: "POST", body }),

  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) => request<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) => request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: Omit<ApiRequestOptions, "method">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export { API_BASE_URL };
