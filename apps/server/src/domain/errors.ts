export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;

  constructor(code: AppErrorCode, message: string, statusCode: number, cause?: unknown) {
    super(message, { cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function validationError(message: string, cause?: unknown): AppError {
  return new AppError('VALIDATION_ERROR', message, 400, cause);
}

export function notFoundError(message: string, cause?: unknown): AppError {
  return new AppError('NOT_FOUND', message, 404, cause);
}

export function conflictError(message: string, cause?: unknown): AppError {
  return new AppError('CONFLICT', message, 409, cause);
}

export function limitExceededError(message: string, cause?: unknown): AppError {
  return new AppError('LIMIT_EXCEEDED', message, 413, cause);
}

export function internalError(message: string, cause?: unknown): AppError {
  return new AppError('INTERNAL_ERROR', message, 500, cause);
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return internalError(error.message, error);
  }

  return internalError('Unexpected server error');
}
