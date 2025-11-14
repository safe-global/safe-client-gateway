import { HttpException, HttpStatus } from '@nestjs/common';

export class TargetedSafeNotFoundError extends HttpException {
  constructor() {
    super(`Targeted Safe not found`, HttpStatus.NOT_FOUND);
  }
}
