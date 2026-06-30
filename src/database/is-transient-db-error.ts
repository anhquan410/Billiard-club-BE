export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as {
    code?: string;
    message?: string;
    cause?: unknown;
  };

  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'P1001' ||
    err.code === 'P1002' ||
    err.code === 'P1008' ||
    err.code === 'P1017'
  ) {
    return true;
  }

  const message = (err.message ?? '').toLowerCase();
  if (
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('timeout expired') ||
    message.includes('sockettimeout') ||
    message.includes("can't reach database server")
  ) {
    return true;
  }

  if (err.cause) {
    return isTransientDbError(err.cause);
  }

  return false;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
