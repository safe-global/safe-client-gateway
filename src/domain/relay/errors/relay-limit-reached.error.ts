import { HttpException, HttpStatus } from '@nestjs/common';

export class RelayLimitReachedError extends HttpException {
  constructor(
    readonly address: `0x${string}`,
    readonly current: number,
    readonly limit: number,
  ) {
    super(
      `Relay limit reached for ${address} | current: ${current} | limit: ${limit}`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
