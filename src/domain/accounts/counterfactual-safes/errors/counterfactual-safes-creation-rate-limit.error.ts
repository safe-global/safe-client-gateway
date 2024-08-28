import { HttpException, HttpStatus } from '@nestjs/common';

export class CounterfactualSafesCreationRateLimitError extends HttpException {
  constructor() {
    super(
      `Counterfactual Safes creation rate limit reached`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
