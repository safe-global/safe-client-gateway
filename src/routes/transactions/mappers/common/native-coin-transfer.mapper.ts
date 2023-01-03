import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '../../entities/transfer-transaction-info.entity';
import { NativeCoinTransfer } from '../../entities/transfers/native-coin-transfer.entity';

@Injectable()
export class NativeCoinTransferMapper {
  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapNativeCoinTransfer(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
    safe: Safe,
  ): Promise<TransferTransactionInfo> {
    const recipient = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
    );

    return new TransferTransactionInfo(
      new AddressInfo(safe.address),
      recipient,
      TransferDirection.Outgoing,
      new NativeCoinTransfer(transaction.value),
    );
  }
}
