// React Native's Android HTTP client has no timeouts (OkHttpClientProvider: 0), so a request
// whose connection opens but never answers never ends.
// - Requests the user starts from a form (sign-in, sign-up, resending the confirmation email)
//   end after AUTH_FORM_TIMEOUT_MS, so the screen can show the connection message (KAN-122).
// - Data requests (PostgREST, /rest/v1/) end after DATA_REQUEST_TIMEOUT_MS (KAN-127). An ended
//   read shows the screen's load error; an ended write has an unknown outcome, because the
//   server may have committed it, and the caller re-reads instead of assuming it failed.
// Token refresh, the confirmation-link (PKCE) exchange and sign-out are excluded on purpose:
// aborting a refresh the server already rotated would replay the old refresh token and can
// revoke the session.
export const AUTH_FORM_TIMEOUT_MS = 15000;
export const DATA_REQUEST_TIMEOUT_MS = 20000;

const FORM_REQUESTS = [/\/auth\/v1\/token\?(.*&)?grant_type=password(&|$)/, /\/auth\/v1\/signup(\?|$)/, /\/auth\/v1\/resend(\?|$)/];
const DATA_REQUESTS = /\/rest\/v1\//;

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function timeoutFor(url: string, formMs: number, dataMs: number): number | null {
  if (FORM_REQUESTS.some(pattern => pattern.test(url))) return formMs;
  if (DATA_REQUESTS.test(url)) return dataMs;
  return null;
}

export function withRequestTimeouts(
  fetcher: typeof fetch,
  { formMs = AUTH_FORM_TIMEOUT_MS, dataMs = DATA_REQUEST_TIMEOUT_MS }: { formMs?: number; dataMs?: number } = {},
): typeof fetch {
  return async (input, init) => {
    const ms = timeoutFor(requestUrl(input), formMs, dataMs);
    if (init?.signal || ms === null) return fetcher(input, init);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}
