import { ConflictException } from '@nestjs/common';
export class UniqueConstraintError extends ConflictException {}
