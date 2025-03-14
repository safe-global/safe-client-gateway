import { QueryFailedError } from 'typeorm';

const UNIQUE_CONSTRAINT_ERROR_CODE = '23505';

export function isUniqueConstraintError(
  err: unknown,
): err is QueryFailedError & { driverError: { code: string; detail: string } } {
  return (
    err instanceof QueryFailedError &&
    'code' in err.driverError &&
    err.driverError.code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}
