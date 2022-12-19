import { Module } from '@nestjs/common';
import { AddressInfoModule } from '../common/address-info/address-info.module';
import { MultisigTransactionExecutionInfoMapper } from './mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionInfoMapper } from './mappers/multisig-transactions/transaction-info/multisig-transaction-info.mapper';
import { MultisigTransactionStatusMapper } from './mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from './mappers/multisig-transactions/multisig-transaction.mapper';
import { CustomTransactionMapper } from './mappers/multisig-transactions/transaction-info/custom-transaction.mapper';
import { DataDecodedParamHelper } from './mappers/multisig-transactions/transaction-info/data-decoded-param.helper';
import { Erc20TransferMapper } from './mappers/multisig-transactions/transaction-info/erc20-transfer.mapper';
import { Erc721TransferMapper } from './mappers/multisig-transactions/transaction-info/erc721-transfer.mapper';
import { NativeCoinTransferMapper } from './mappers/multisig-transactions/transaction-info/native-coin-transfer.mapper';
import { SettingsChangeMapper } from './mappers/multisig-transactions/transaction-info/settings-change.mapper';
import { TransferDirectionHelper } from './mappers/multisig-transactions/transaction-info/transfer-direction.helper';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { ModuleTransactionMapper } from './mappers/multisig-transactions/module-transaction.mapper';
import { ModuleTransactionStatusMapper } from './mappers/multisig-transactions/module-transaction-status.mapper';

@Module({
  controllers: [TransactionsController],
  imports: [AddressInfoModule],
  providers: [
    CustomTransactionMapper,
    DataDecodedParamHelper,
    Erc20TransferMapper,
    Erc721TransferMapper,
    ModuleTransactionMapper,
    ModuleTransactionStatusMapper,
    MultisigTransactionExecutionInfoMapper,
    MultisigTransactionInfoMapper,
    MultisigTransactionMapper,
    MultisigTransactionStatusMapper,
    NativeCoinTransferMapper,
    SettingsChangeMapper,
    TransactionsService,
    TransferDirectionHelper,
  ],
})
export class TransactionsModule {}
