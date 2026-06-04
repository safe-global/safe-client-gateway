// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import type { DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import type { ModuleTransaction } from '@/modules/safe/domain/entities/module-transaction.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Erc20Token } from '@/modules/tokens/domain/entities/token.entity';
import { TransferTransactionInfo } from '@/modules/transactions/routes/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '@/modules/transactions/routes/entities/transfers/erc20-transfer.entity';
import { DataDecodedParamHelper } from '@/modules/transactions/routes/mappers/common/data-decoded-param.helper';
import { getTransferDirection } from '@/modules/transactions/routes/mappers/common/transfer-direction.helper';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';

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
