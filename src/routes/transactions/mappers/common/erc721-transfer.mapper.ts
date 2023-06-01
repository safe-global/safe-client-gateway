import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { Token } from '../../../../domain/tokens/entities/token.entity';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { NULL_ADDRESS } from '../../../common/constants';
import { TransferTransactionInfo } from '../../entities/transfer-transaction-info.entity';
import { Erc721Transfer } from '../../entities/transfers/erc721-transfer.entity';
import { DataDecodedParamHelper } from './data-decoded-param.helper';
import { getTransferDirection } from './transfer-direction.helper';

@Injectable()
export class Erc721TransferMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
  ) {}

  async mapErc721Transfer(
    token: Token,
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<TransferTransactionInfo> {
    const { dataDecoded } = transaction;
    const sender = this.dataDecodedParamHelper.getFromParam(
      dataDecoded,
      transaction.safe,
    );
    const recipient = this.dataDecodedParamHelper.getToParam(
      dataDecoded,
      NULL_ADDRESS,
    );
    const direction = getTransferDirection(transaction.safe, sender, recipient);
    const senderAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      sender,
      ['TOKEN', 'CONTRACT'],
    );

    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      recipient,
      ['TOKEN', 'CONTRACT'],
    );

    return new TransferTransactionInfo(
      senderAddressInfo,
      recipientAddressInfo,
      direction,
      new Erc721Transfer(
        token.address,
        this.dataDecodedParamHelper.getValueParam(dataDecoded, '0'),
        token.name,
        token.symbol,
        token.logoUri,
      ),
    );
  }
}
