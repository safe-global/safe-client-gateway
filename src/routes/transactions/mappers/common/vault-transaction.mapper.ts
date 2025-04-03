import { VaultDepositTransactionInfo } from '@/routes/transactions/entities/vaults/vault-deposit-info.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VaultTransactionMapper {
  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    value: string;
    data: `0x${string}`;
    // TODO: return type
  }): Promise<VaultDepositTransactionInfo> {
    return Promise.resolve(new VaultDepositTransactionInfo(args)); // TODO: mapping
  }
}
