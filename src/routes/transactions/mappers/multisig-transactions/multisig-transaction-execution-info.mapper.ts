import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { ExecutionInfo } from '../../entities/execution-info.entity';
import { MultisigExecutionInfo } from '../../entities/multisig-execution-info.entity';

@Injectable()
export class MultisigTransactionExecutionInfoMapper {
  mapExecutionInfo(
    transaction: MultisigTransaction,
    safe: Safe,
    txStatus: string,
  ): ExecutionInfo {
    const missingSigners =
      txStatus === 'AWAITING_CONFIRMATIONS'
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
  ): AddressInfo[] {
    const confirmedOwners =
      transaction.confirmations?.map((confirmation) => confirmation.owner) ??
      [];

    return safe.owners
      .filter((owner) => !confirmedOwners.includes(owner))
      .map((missingSigner) => ({ value: missingSigner }));
  }
}
