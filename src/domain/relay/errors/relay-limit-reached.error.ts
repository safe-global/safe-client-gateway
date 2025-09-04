import { HttpException, HttpStatus } from '@nestjs/common';
import type { Address } from 'viem';

export class RelayLimitReachedError extends HttpException {
  constructor(
    readonly address: Address,
    readonly current: number,
    readonly limit: number,
  ) {
    super(
      `Relay limit reached for ${address} | current: ${current} | limit: ${limit}`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
