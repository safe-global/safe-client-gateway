import { UnprocessableEntityException } from '@nestjs/common';

export class ExceedsMaxGasLimitError extends UnprocessableEntityException {
  constructor(
    readonly current: bigint,
    readonly maxGasLimit: bigint,
  ) {
    super(
      `Transaction exceeds maxGasLimit for transaction | current: ${current} | limit: ${maxGasLimit}`,
    );
  }
}
