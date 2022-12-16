import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../../domain/safe/entities/multisig-transaction.entity';
import { AddressInfoHelper } from '../../../../common/address-info/address-info.helper';
import { NULL_ADDRESS } from '../../../../common/constants';
import { CustomTransactionInfo } from '../../../entities/custom-transaction.entity';

@Injectable()
export class CustomTransactionMapper {
  private static readonly MULTI_SEND = 'multiSend';
  private static readonly TRANSACTIONS = 'transactions';
  constructor(private readonly addressInfoHelper: AddressInfoHelper) {}

  async mapCustomTransaction(
    transaction: MultisigTransaction,
    value: number,
    dataSize: number,
    chainId: string,
  ): Promise<CustomTransactionInfo> {
    const toAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transaction.to,
    );

    return new CustomTransactionInfo(
      toAddressInfo,
      dataSize.toString(),
      value.toString(),
      transaction?.dataDecoded?.method ?? null,
      this.getActionCount(transaction),
      this.isCancellation(transaction, dataSize),
    );
  }

  private getActionCount(transaction: MultisigTransaction): number | null {
    const { dataDecoded } = transaction;
    if (dataDecoded?.method === CustomTransactionMapper.MULTI_SEND) {
      const parameter = dataDecoded.parameters?.find(
        (parameter) => parameter.name === CustomTransactionMapper.TRANSACTIONS,
      );
      return parameter?.valueDecoded?.length ?? null;
    }

    return null;
  }

  private isCancellation(
    transaction: MultisigTransaction,
    dataSize: number,
  ): boolean {
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
      operation === 0 &&
      (!baseGas || Number(baseGas) === 0) &&
      (!gasPrice || Number(gasPrice) === 0) &&
      (!gasToken || gasToken === NULL_ADDRESS) &&
      (!refundReceiver || refundReceiver === NULL_ADDRESS) &&
      (!safeTxGas || safeTxGas === 0)
    );
  }
}
