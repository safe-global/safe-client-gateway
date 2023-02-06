import { Module } from '@nestjs/common';
import { AddressInfoModule } from '../common/address-info/address-info.module';
import { CustomTransactionMapper } from './mappers/common/custom-transaction.mapper';
import { DataDecodedParamHelper } from './mappers/common/data-decoded-param.helper';
import { Erc20TransferMapper } from './mappers/common/erc20-transfer.mapper';
import { Erc721TransferMapper } from './mappers/common/erc721-transfer.mapper';
import { NativeCoinTransferMapper } from './mappers/common/native-coin-transfer.mapper';
import { SafeAppInfoMapper } from './mappers/common/safe-app-info.mapper';
import { SettingsChangeMapper } from './mappers/common/settings-change.mapper';
import { MultisigTransactionInfoMapper } from './mappers/common/transaction-info.mapper';
import { ModuleTransactionStatusMapper } from './mappers/module-transactions/module-transaction-status.mapper';
import { ModuleTransactionMapper } from './mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionExecutionInfoMapper } from './mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from './mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from './mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from './mappers/queued-items/queued-items.mapper';
import { TransactionsMapper } from './mappers/common/transactions.mapper';
import { TransferInfoMapper } from './mappers/transfers/transfer-info.mapper';
import { IncomingTransferMapper } from './mappers/transfers/transfer.mapper';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CreationTransactionMapper } from './mappers/creation-transaction/creation-transaction.mapper';

@Module({
  controllers: [TransactionsController],
  imports: [AddressInfoModule],
  providers: [
    CustomTransactionMapper,
    CreationTransactionMapper,
    DataDecodedParamHelper,
    Erc20TransferMapper,
    Erc721TransferMapper,
    IncomingTransferMapper,
    ModuleTransactionMapper,
    ModuleTransactionStatusMapper,
    MultisigTransactionExecutionInfoMapper,
    MultisigTransactionInfoMapper,
    MultisigTransactionMapper,
    MultisigTransactionStatusMapper,
    NativeCoinTransferMapper,
    SafeAppInfoMapper,
    QueuedItemsMapper,
    SettingsChangeMapper,
    TransactionsMapper,
    TransactionsService,
    TransferInfoMapper,
  ],
})
export class TransactionsModule {}
