import { publicEnv } from "@/lib/public-env";

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

type FetchJsonOptions = RequestInit & {
  accessToken?: string | null;
  idempotencyKey?: string;
};

export async function apiFetch<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const { accessToken, idempotencyKey, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (idempotencyKey) {
    headers.set("x-idempotency-key", idempotencyKey);
  }

  const res = await fetch(joinUrl(publicEnv.apiUrl, path), {
    credentials: "include",
    ...rest,
    headers
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(res.status, { code: "INVALID_JSON", message: "Invalid response body" });
    }
  }

  if (!res.ok) {
    const body = json as ApiErrorBody | null;
    throw new ApiError(res.status, {
      code: body?.code ?? "UNKNOWN",
      message: body?.message ?? res.statusText,
      details: body?.details
    });
  }

  return json as T;
}
