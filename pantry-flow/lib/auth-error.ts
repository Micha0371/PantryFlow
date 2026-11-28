import { isAuthApiError, isAuthRetryableFetchError, isAuthWeakPasswordError } from '@supabase/supabase-js';
import type { TranslationKey } from './i18n/en';

// KAN-122 (UX-09): only a genuine credential rejection may say the password is wrong.
// supabase-js reports a failed, aborted or timed-out request as AuthRetryableFetchError with
// status 0, and 5xx/gateway answers as the same error with their status.
function transportErrorKey(error: unknown): TranslationKey | null {
  if (isAuthRetryableFetchError(error)) return error.status === 0 ? 'err_auth_connection' : 'err_auth_server';
  if (isAuthApiError(error) && error.status >= 500) return 'err_auth_server';
  return null;
}

export function signInErrorKey(error: unknown): TranslationKey {
  const transport = transportErrorKey(error);
  if (transport) return transport;
  if (!isAuthApiError(error)) return 'err_generic';
  if (error.code === 'invalid_credentials') return 'err_login_failed';
  if (error.code === 'email_not_confirmed') return 'err_login_unconfirmed';
  if (error.status === 429) return 'err_login_rate_limit';
  return 'err_generic';
}

// The server's 72-byte bcrypt limit arrives as validation_failed with this message
// (Auth v2.197.0 and v2.198.0, internal/api/password.go; checked against local v2.198.0 2026-11-28), which says "characters" although it counts bytes.
const PASSWORD_TOO_LONG = /^Password cannot be longer than \d+ characters/;

// Registration keeps its own message for every rejection; only the transport and the email
// rate limit (sign-up sends the confirmation email) get the shared messages. KAN-82: the two
// password limits the server enforces get their own messages; the app checks both before
// sending, so these cover only a server that is stricter than the app.
export function signUpErrorKey(error: unknown): TranslationKey {
  const transport = transportErrorKey(error);
  if (transport) return transport;
  if (isAuthApiError(error) && error.status === 429) return 'err_confirmation_rate_limit';
  if (isAuthWeakPasswordError(error) && error.reasons.includes('length')) return 'err_password_too_short';
  if (isAuthApiError(error) && error.code === 'validation_failed' && PASSWORD_TOO_LONG.test(error.message)) return 'err_password_too_long';
  return 'err_register_failed';
}
