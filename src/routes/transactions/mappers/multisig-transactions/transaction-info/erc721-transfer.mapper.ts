import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '../../../../../domain/safe/entities/multisig-transaction.entity';
import { Token } from '../../../../../domain/tokens/entities/token.entity';
import { AddressInfoHelper } from '../../../../common/address-info/address-info.helper';
import { TransferTransactionInfo } from '../../../entities/transfer-transaction-info.entity';
import { Erc721Transfer } from '../../../entities/transfers/erc721-transfer.entity';
import { DataDecodedParamHelper } from './data-decoded-param.helper';
import { TransferDirectionHelper } from './transfer-direction.helper';

@Injectable()
export class Erc721TransferMapper {
  private static readonly NULL_ADDRESS =
    '0x0000000000000000000000000000000000000000';

  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
    private readonly transferDirectionHelper: TransferDirectionHelper,
  ) {}

  async mapErc721Transfer(
    token: Token,
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<TransferTransactionInfo> {
    const { dataDecoded } = transaction;
    const sender = this.dataDecodedParamHelper.getFromParam(
      dataDecoded,
      transaction.safe,
    );
    const recipient = this.dataDecodedParamHelper.getToParam(
      dataDecoded,
      Erc721TransferMapper.NULL_ADDRESS,
    );
    const direction = this.transferDirectionHelper.getTransferDirection(
      transaction.safe,
      sender,
      recipient,
    );
    const senderAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      sender,
    );
    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      recipient,
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
