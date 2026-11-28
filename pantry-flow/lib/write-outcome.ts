// KAN-127: a write that ends without an answer from the database (a timeout, a lost
// connection, a gateway page, an answer that could not be read) may still have been
// committed. Callers must not report it as failed or lost: they re-read and tell the
// user to check before trying again. A coded error is a confirmed rejection.
export const WRITE_UNCONFIRMED = 'PF_WRITE_UNCONFIRMED';

function errorCode(error: unknown): unknown {
  return error !== null && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : undefined;
}

export function isUncodedFailure(error: unknown): boolean {
  const code = errorCode(error);
  return typeof code !== 'string' || code === '';
}

export function unconfirmedWrite(cause: unknown): Error & { code: string } {
  return Object.assign(new Error('Change outcome is unknown', { cause }), { code: WRITE_UNCONFIRMED });
}

export function isUnconfirmedWrite(error: unknown): boolean {
  return errorCode(error) === WRITE_UNCONFIRMED;
}
