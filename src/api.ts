import type { AppState, ResourceNames, Snapshot } from "../shared/types";

/**
 * A call the server refused. `code` is what the page explains to the reader
 * (see `errorText` in shared/i18n); `detail` is what Cloudflare said, when the
 * failure was Cloudflare's.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string | null = null,
  ) {
    super(code);
  }
}

const RELOADED_AT = "usage:reloaded-at";
const RELOAD_INTERVAL_MS = 30_000;

/** Reloads the page unless it was already reloaded for this reason moments ago. */
function reloadOnce(): boolean {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < RELOAD_INTERVAL_MS) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    // Without session storage there is no way to tell a first reload from a loop.
    return false;
  }
  window.location.reload();
  return true;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...init?.headers },
  });

  // The session ended. Loading the page again lets the server send the visitor to sign in.
  // Only once in a while: if the page itself still loads but the API keeps
  // answering 401, reloading again would loop forever.
  if (response.status === 401) {
    if (reloadOnce()) return new Promise<T>(() => {});
    throw new ApiError(401, "unauthenticated");
  }

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string; message?: string })
    | null;
  if (!response.ok || body === null) {
    throw new ApiError(
      response.status,
      typeof body?.error === "string" ? body.error : "unknown",
      typeof body?.message === "string" ? body.message : null,
    );
  }
  return body;
}

export function loadState(): Promise<AppState> {
  return call<AppState>("/api/state");
}

export function refreshAccount(accountId: string): Promise<{ snapshot: Snapshot; names: ResourceNames }> {
  return call("/api/refresh", { method: "POST", body: JSON.stringify({ accountId }) });
}

export function saveRenewalDay(accountId: string, renewalDay: number): Promise<{ renewalDay: number }> {
  return call("/api/settings", { method: "PUT", body: JSON.stringify({ accountId, renewalDay }) });
}
