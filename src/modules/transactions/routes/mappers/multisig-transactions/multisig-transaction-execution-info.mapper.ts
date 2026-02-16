import { Injectable } from '@nestjs/common';
import { type MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { type Safe } from '@/modules/safe/domain/entities/safe.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MultisigExecutionInfo } from '@/modules/transactions/routes/entities/multisig-execution-info.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';

@Injectable()
export class MultisigTransactionExecutionInfoMapper {
  mapExecutionInfo(
    transaction: MultisigTransaction,
    safe: Safe,
    txStatus: TransactionStatus,
  ): MultisigExecutionInfo {
    const missingSigners =
      txStatus === TransactionStatus.AwaitingConfirmations
        ? this.getMissingSigners(transaction, safe)
        : null;

    return new MultisigExecutionInfo(
      transaction.nonce,
      transaction.confirmationsRequired,
      transaction?.confirmations?.length || 0,
      missingSigners,
    );
  }

  private getMissingSigners(
    transaction: MultisigTransaction,
    safe: Safe,
  ): Array<AddressInfo> {
    const confirmedOwners =
      transaction.confirmations?.map((confirmation) => confirmation.owner) ??
      [];

    return safe.owners
      .filter((owner) => !confirmedOwners.includes(owner))
      .map((missingSigner) => new AddressInfo(missingSigner));
  }
}
