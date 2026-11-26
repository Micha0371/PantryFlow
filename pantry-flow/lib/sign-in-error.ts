import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { TranslationKey } from './i18n/en';

// KAN-122 (UX-09): only a genuine credential rejection may say the password is wrong.
// supabase-js reports a failed or timed-out request as AuthRetryableFetchError with
// status 0, and 5xx/gateway answers as the same error with their status.
export function signInErrorKey(error: unknown): TranslationKey {
  if (isAuthRetryableFetchError(error)) return error.status === 0 ? 'err_login_connection' : 'err_login_server';
  if (!isAuthApiError(error)) return 'err_generic';
  if (error.code === 'invalid_credentials') return 'err_login_failed';
  if (error.code === 'email_not_confirmed') return 'err_login_unconfirmed';
  if (error.status === 429) return 'err_login_rate_limit';
  if (error.status >= 500) return 'err_login_server';
  return 'err_generic';
}
