// KAN-82: the approved password policy (KAN-81, owner decisions 2026-11-27). The app checks it
// before sending; the Auth server stays authoritative and rejects anything it does not accept.
// - At least 15 Unicode code points; spaces and any characters count, no character rules.
// - At most 72 bytes in UTF-8: the server's bcrypt limit (it rejects, never truncates).
// The password is only measured here, never trimmed, truncated or normalized.
export const PASSWORD_MIN_CODE_POINTS = 15;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = 'too_short' | 'too_long';

// Array.from iterates by code point, so an emoji (two UTF-16 units) counts once.
export function passwordCodePoints(password: string): number {
  return Array.from(password).length;
}

// UTF-8 size as the server receives it. An unpaired surrogate arrives as U+FFFD (3 bytes).
export function passwordBytes(password: string): number {
  let bytes = 0;
  for (const char of password) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function passwordProblem(password: string): PasswordProblem | null {
  if (passwordCodePoints(password) < PASSWORD_MIN_CODE_POINTS) return 'too_short';
  if (passwordBytes(password) > PASSWORD_MAX_BYTES) return 'too_long';
  return null;
}
