import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Ref: https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNIQUE_CONSTRAINT_ERROR_CODE = '23505';

export function isUniqueConstraintError(
  err: unknown,
): err is QueryFailedError & { driverError: { code: string } } {
  return (
    err instanceof QueryFailedError &&
    'code' in err.driverError &&
    err.driverError.code === PG_UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

export class UniqueConstraintError extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}
