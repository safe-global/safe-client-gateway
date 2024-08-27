import { HttpException, HttpStatus } from '@nestjs/common';

export class AccountsCreationRateLimitError extends HttpException {
  constructor() {
    super(`Accounts creation rate limit reached`, HttpStatus.TOO_MANY_REQUESTS);
  }
}
