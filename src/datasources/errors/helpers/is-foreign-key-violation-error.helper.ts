// SPDX-License-Identifier: FSL-1.1-MIT
import { QueryFailedError } from 'typeorm';

const FOREIGN_KEY_VIOLATION_ERROR_CODE = '23503';

export function isForeignKeyViolationError(
  err: unknown,
): err is QueryFailedError & {
  driverError: {
    code: typeof FOREIGN_KEY_VIOLATION_ERROR_CODE;
    constraint?: string;
  };
} {
  return (
    err instanceof QueryFailedError &&
    'code' in err.driverError &&
    err.driverError.code === FOREIGN_KEY_VIOLATION_ERROR_CODE
  );
}
