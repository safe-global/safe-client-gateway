import { Injectable } from '@nestjs/common';

@Injectable()
export class VaultTransactionMapper {
  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    value: string;
    data: `0x${string}`;
    // TODO: return type
  }): Promise<unknown> {
    return Promise.resolve(args);
  }
}
