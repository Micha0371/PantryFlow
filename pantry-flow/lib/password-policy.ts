// KAN-82 / section 2.6: the one evaluator of a NEW password (registration, reset, change). The
// constants mirror the Auth server (minimum_password_length = 15, bcrypt's 72 bytes); the server
// stays authoritative. The value is only measured, never trimmed, truncated or normalized.
export const PASSWORD_MIN_CODE_POINTS = 15;
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordEvaluation {
  codePoints: number;
  bytes: number;
  remaining: number;
  meetsMinimum: boolean;
  tooLong: boolean;
}

export function evaluateNewPassword(value: string): PasswordEvaluation {
  const codePoints = [...value].length;
  // An unpaired surrogate is encoded as U+FFFD (3 bytes), as the server receives it.
  const bytes = new TextEncoder().encode(value).length;
  return {
    codePoints,
    bytes,
    remaining: Math.max(0, PASSWORD_MIN_CODE_POINTS - codePoints),
    meetsMinimum: codePoints >= PASSWORD_MIN_CODE_POINTS,
    tooLong: bytes > PASSWORD_MAX_BYTES,
  };
}
