import { Hex } from 'viem';

export class RelayLimitReachedError extends Error {
  constructor(
    readonly address: Hex,
    readonly current: number,
    readonly limit: number,
  ) {
    super(
      `Relay limit reached for ${address} | current: ${current} | limit: ${limit}`,
    );
  }
}
