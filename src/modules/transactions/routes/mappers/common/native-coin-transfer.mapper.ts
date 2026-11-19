// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { ModuleTransaction } from '#/modules/safe/domain/entities/module-transaction.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '#/modules/transactions/routes/entities/transfer-transaction-info.entity';
import { NativeCoinTransfer } from '#/modules/transactions/routes/entities/transfers/native-coin-transfer.entity';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

@Injectable()
export class NativeCoinTransferMapper {
  async mapNativeCoinTransfer(
    addressLookups: AddressLookups,
    transaction: MultisigTransaction | ModuleTransaction,
    humanDescription: string | null,
  ): Promise<TransferTransactionInfo> {
    const recipient = await addressLookups.getOrDefault(transaction.to, [
      'TOKEN',
      'CONTRACT',
    ]);

    return new TransferTransactionInfo(
      new AddressInfo(transaction.safe),
      recipient,
      TransferDirection.Outgoing,
      new NativeCoinTransfer(transaction.value),
      humanDescription,
    );
  }
}
