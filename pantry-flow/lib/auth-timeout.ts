// React Native's Android HTTP client has no timeouts (OkHttpClientProvider: 0), so a request
// whose connection opens but never answers never ends. Requests the user starts from a form
// (sign-in, sign-up, resending the confirmation email) get a timeout, so the screen can show
// the connection message (KAN-122). Token refresh is excluded on purpose: aborting a refresh
// the server already rotated would replay the old refresh token and can revoke the session.
export const AUTH_FORM_TIMEOUT_MS = 15000;

const FORM_REQUESTS = [/\/auth\/v1\/token\?(.*&)?grant_type=password(&|$)/, /\/auth\/v1\/signup(\?|$)/, /\/auth\/v1\/resend(\?|$)/];

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function withAuthTimeout(fetcher: typeof fetch, ms: number = AUTH_FORM_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    if (init?.signal || !FORM_REQUESTS.some(pattern => pattern.test(requestUrl(input)))) return fetcher(input, init);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}
