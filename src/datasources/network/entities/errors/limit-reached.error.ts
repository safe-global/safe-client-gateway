import { HttpException, HttpStatus } from '@nestjs/common';

export class LimitReachedError extends HttpException {
  constructor() {
    super(`Rate limit reached`, HttpStatus.TOO_MANY_REQUESTS);
  }
}
