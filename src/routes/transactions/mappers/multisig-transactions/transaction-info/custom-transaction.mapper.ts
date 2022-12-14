import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../../domain/safe/entities/multisig-transaction.entity';
import { AddressInfoHelper } from '../../../../common/address-info/address-info.helper';
import { CustomTransactionInfo } from '../../../entities/custom-transaction.entity';

@Injectable()
export class CustomTransactionMapper {
  private static readonly NULL_ADDRESS =
    '0x0000000000000000000000000000000000000000';

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
    if (transaction?.dataDecoded?.method === 'multiSend') {
      const parameter = dataDecoded.parameters?.find(
        (parameter) => parameter.name === 'transactions',
      );
      return parameter?.valueDecoded?.length;
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
      (!gasToken || gasToken === CustomTransactionMapper.NULL_ADDRESS) &&
      (!refundReceiver ||
        refundReceiver === CustomTransactionMapper.NULL_ADDRESS) &&
      (!safeTxGas || safeTxGas === 60)
    );
  }
}
