import { AppClientError, type AppErrorCode } from '../contracts/identity';

interface ProviderErrorShape {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

const applicationCodes = new Set<AppErrorCode>([
  'AUTH_REQUIRED',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'NETWORK_ERROR',
  'UNEXPECTED_ERROR',
]);

export function validationError(cause?: unknown): AppClientError {
  return new AppClientError('VALIDATION_ERROR', false, cause);
}

export function unexpectedResponse(cause?: unknown): AppClientError {
  return new AppClientError('UNEXPECTED_ERROR', false, cause);
}

export function mapProviderError(error: unknown): AppClientError {
  if (error instanceof AppClientError) return error;
  if (error instanceof TypeError)
    return new AppClientError('NETWORK_ERROR', true, error);

  const provider = isProviderError(error) ? error : {};
  const status =
    typeof provider.status === 'number' ? provider.status : undefined;
  const code = typeof provider.code === 'string' ? provider.code : undefined;
  const message =
    typeof provider.message === 'string' ? provider.message : undefined;

  if (message !== undefined && applicationCodes.has(message as AppErrorCode)) {
    const appCode = message as AppErrorCode;
    return new AppClientError(
      appCode,
      appCode === 'RATE_LIMITED' || appCode === 'NETWORK_ERROR',
      error,
    );
  }
  if (status === 429 || code?.includes('rate_limit') === true) {
    return new AppClientError('RATE_LIMITED', true, error);
  }
  if (
    code === 'invalid_credentials' ||
    code === 'weak_password' ||
    code === 'validation_failed'
  ) {
    return validationError(error);
  }
  if (code === 'session_not_found' || code === '42501') {
    return new AppClientError('AUTH_REQUIRED', false, error);
  }
  if (code === 'PGRST116') return new AppClientError('NOT_FOUND', false, error);
  if (code === '23505') return new AppClientError('CONFLICT', false, error);
  if (code === '23503' || code === '23514' || code === '22023')
    return validationError(error);
  return unexpectedResponse(error);
}

function isProviderError(value: unknown): value is ProviderErrorShape {
  return typeof value === 'object' && value !== null;
}
