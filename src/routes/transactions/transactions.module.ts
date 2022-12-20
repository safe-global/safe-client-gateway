import { Module } from '@nestjs/common';
import { AddressInfoModule } from '../common/address-info/address-info.module';
import { TransferDirectionHelper } from './mappers/common/transfer-direction.helper';
import { MultisigTransactionExecutionInfoMapper } from './mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from './mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from './mappers/multisig-transactions/multisig-transaction.mapper';
import { CustomTransactionMapper } from './mappers/multisig-transactions/transaction-info/custom-transaction.mapper';
import { DataDecodedParamHelper } from './mappers/multisig-transactions/transaction-info/data-decoded-param.helper';
import { Erc20TransferMapper } from './mappers/multisig-transactions/transaction-info/erc20-transfer.mapper';
import { Erc721TransferMapper } from './mappers/multisig-transactions/transaction-info/erc721-transfer.mapper';
import { MultisigTransactionInfoMapper } from './mappers/multisig-transactions/transaction-info/multisig-transaction-info.mapper';
import { NativeCoinTransferMapper } from './mappers/multisig-transactions/transaction-info/native-coin-transfer.mapper';
import { SettingsChangeMapper } from './mappers/multisig-transactions/transaction-info/settings-change.mapper';
import { TransferInfoMapper } from './mappers/transfers/transfer-info.mapper';
import { TransferMapper } from './mappers/transfers/transfer.mapper';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  imports: [AddressInfoModule],
  providers: [
    CustomTransactionMapper,
    DataDecodedParamHelper,
    Erc20TransferMapper,
    Erc721TransferMapper,
    MultisigTransactionExecutionInfoMapper,
    MultisigTransactionInfoMapper,
    MultisigTransactionMapper,
    MultisigTransactionStatusMapper,
    NativeCoinTransferMapper,
    SettingsChangeMapper,
    TransactionsService,
    TransferDirectionHelper,
    TransferInfoMapper,
    TransferMapper,
  ],
})
export class TransactionsModule {}
