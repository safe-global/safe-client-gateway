import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/modules/safe/domain/entities/module-transaction.entity';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  TransferTransactionInfo,
  TransferDirection,
} from '@/modules/transactions/routes/entities/transfer-transaction-info.entity';
import { NativeCoinTransfer } from '@/modules/transactions/routes/entities/transfers/native-coin-transfer.entity';

@Injectable()
export class NativeCoinTransferMapper {
  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapNativeCoinTransfer(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
    humanDescription: string | null,
  ): Promise<TransferTransactionInfo> {
    const recipient = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
      ['TOKEN', 'CONTRACT'],
    );

    return new TransferTransactionInfo(
      new AddressInfo(transaction.safe),
      recipient,
      TransferDirection.Outgoing,
      new NativeCoinTransfer(transaction.value),
      humanDescription,
    );
  }
}
