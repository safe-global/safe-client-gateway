import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { isMultisigTransaction } from '@/domain/safe/entities/transaction.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import {
  MULTI_SEND_METHOD_NAME,
  TRANSACTIONS_PARAMETER_NAME,
} from '@/routes/transactions/constants';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';

@Injectable()
export class CustomTransactionMapper {
  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapCustomTransaction(
    transaction: MultisigTransaction | ModuleTransaction,
    dataSize: number,
    chainId: string,
    humanDescription: string | null,
    dataDecoded: DataDecoded | null,
  ): Promise<CustomTransactionInfo> {
    const toAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
      ['TOKEN', 'CONTRACT'],
    );

    return new CustomTransactionInfo(
      toAddressInfo,
      dataSize.toString(),
      transaction.value,
      dataDecoded?.method ?? null,
      this.getActionCount(dataDecoded),
      this.isCancellation(transaction, dataSize),
      humanDescription,
    );
  }

  private getActionCount(dataDecoded: DataDecoded | null): number | null {
    if (dataDecoded?.method === MULTI_SEND_METHOD_NAME) {
      const parameter = dataDecoded.parameters?.find(
        (parameter) => parameter.name === TRANSACTIONS_PARAMETER_NAME,
      );
      return Array.isArray(parameter?.valueDecoded)
        ? parameter.valueDecoded.length
        : null;
    }

    return null;
  }

  private isCancellation(
    transaction: MultisigTransaction | ModuleTransaction,
    dataSize: number,
  ): boolean {
    if (isMultisigTransaction(transaction)) {
      const {
        to,
        safe,
        value,
        baseGas,
        gasPrice,
        gasToken,
        operation,
        refundReceiver,
        safeTxGas,
      } = transaction;

      return (
        to === safe &&
        dataSize === 0 &&
        (!value || Number(value) === 0) &&
        operation === Operation.CALL &&
        (!baseGas || Number(baseGas) === 0) &&
        (!gasPrice || Number(gasPrice) === 0) &&
        (!gasToken || gasToken === NULL_ADDRESS) &&
        (!refundReceiver || refundReceiver === NULL_ADDRESS) &&
        (!safeTxGas || safeTxGas === 0)
      );
    } else {
      return false;
    }
  }
}
