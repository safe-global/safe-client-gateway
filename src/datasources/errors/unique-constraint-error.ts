import { ConflictException } from '@nestjs/common';
export class UniqueConstraintError extends ConflictException {
  constructor(message: string) {
    super(message);
  }
}
