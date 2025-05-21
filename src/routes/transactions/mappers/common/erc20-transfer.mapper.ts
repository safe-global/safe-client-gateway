import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Erc20Token } from '@/domain/tokens/entities/token.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { TransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { getTransferDirection } from '@/routes/transactions/mappers/common/transfer-direction.helper';
import { getAddress } from 'viem';
import { DataDecoded } from '@/domain/data-decoder/v2/entities/data-decoded.entity';

@Injectable()
export class Erc20TransferMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
  ) {}

  async mapErc20Transfer(
    token: Erc20Token,
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
    humanDescription: string | null,
    dataDecoded: DataDecoded | null,
  ): Promise<TransferTransactionInfo> {
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
      getAddress(sender),
      ['TOKEN', 'CONTRACT'],
    );

    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      getAddress(recipient),
      ['TOKEN', 'CONTRACT'],
    );

    return new TransferTransactionInfo(
      senderAddressInfo,
      recipientAddressInfo,
      direction,
      new Erc20Transfer(
        token.address,
        this.dataDecodedParamHelper.getValueParam(dataDecoded, '0'),
        token.name,
        token.symbol,
        token.logoUri,
        token.decimals,
      ),
      humanDescription,
    );
  }
}
