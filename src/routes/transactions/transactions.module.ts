import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { CustomTransactionMapper } from '@/routes/transactions/mappers/common/custom-transaction.mapper';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { Erc20TransferMapper } from '@/routes/transactions/mappers/common/erc20-transfer.mapper';
import { Erc721TransferMapper } from '@/routes/transactions/mappers/common/erc721-transfer.mapper';
import { HumanDescriptionMapper } from '@/routes/transactions/mappers/common/human-description.mapper';
import { NativeCoinTransferMapper } from '@/routes/transactions/mappers/common/native-coin-transfer.mapper';
import { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import { SettingsChangeMapper } from '@/routes/transactions/mappers/common/settings-change.mapper';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { CreationTransactionMapper } from '@/routes/transactions/mappers/creation-transaction/creation-transaction.mapper';
import { GPv2OrderHelper } from '@/routes/transactions/helpers/gp-v2-order.helper';
import { ModuleTransactionDetailsMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-details.mapper';
import { ModuleTransactionStatusMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-status.mapper';
import { ModuleTransactionMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-details.mapper';
import { MultisigTransactionExecutionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import { MultisigTransactionExecutionInfoMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from '@/routes/transactions/mappers/queued-items/queued-items.mapper';
import { TransactionPreviewMapper } from '@/routes/transactions/mappers/transaction-preview.mapper';
import { TransactionsHistoryMapper } from '@/routes/transactions/mappers/transactions-history.mapper';
import { TransferDetailsMapper } from '@/routes/transactions/mappers/transfers/transfer-details.mapper';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { TransferImitationMapper } from '@/routes/transactions/mappers/transfers/transfer-imitation.mapper';
import { TransactionsController } from '@/routes/transactions/transactions.controller';
import { TransactionsService } from '@/routes/transactions/transactions.service';
import { SwapOrderMapperModule } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { GPv2DecoderModule } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { ContractsRepositoryModule } from '@/domain/contracts/contracts.repository.interface';
import { DataDecodedRepositoryModule } from '@/domain/data-decoder/data-decoded.repository.interface';
import { HumanDescriptionRepositoryModule } from '@/domain/human-description/human-description.repository.interface';
import { SafeAppsRepositoryModule } from '@/domain/safe-apps/safe-apps.repository.interface';
import { TokenRepositoryModule } from '@/domain/tokens/token.repository.interface';
import { SwapOrderHelperModule } from '@/routes/transactions/helpers/swap-order.helper';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';
import { TwapOrderMapperModule } from '@/routes/transactions/mappers/common/twap-order.mapper';
import { TwapOrderHelperModule } from '@/routes/transactions/helpers/twap-order.helper';
import { SwapTransferInfoMapper } from '@/routes/transactions/mappers/transfers/swap-transfer-info.mapper';
import { SwapAppsHelperModule } from '@/routes/transactions/helpers/swap-apps.helper';

@Module({
  controllers: [TransactionsController],
  imports: [
    AddressInfoModule,
    ContractsRepositoryModule,
    DataDecodedRepositoryModule,
    HumanDescriptionRepositoryModule,
    SafeRepositoryModule,
    SafeAppsRepositoryModule,
    GPv2DecoderModule,
    SwapAppsHelperModule,
    SwapOrderMapperModule,
    SwapOrderHelperModule,
    SwapsRepositoryModule,
    TokenRepositoryModule,
    TwapOrderMapperModule,
    TwapOrderHelperModule,
  ],
  providers: [
    CreationTransactionMapper,
    CustomTransactionMapper,
    DataDecodedParamHelper,
    Erc20TransferMapper,
    Erc721TransferMapper,
    GPv2OrderHelper,
    TransferMapper,
    ModuleTransactionDetailsMapper,
    ModuleTransactionMapper,
    ModuleTransactionStatusMapper,
    MultisigTransactionDetailsMapper,
    MultisigTransactionExecutionDetailsMapper,
    MultisigTransactionExecutionInfoMapper,
    MultisigTransactionInfoMapper,
    MultisigTransactionMapper,
    MultisigTransactionStatusMapper,
    NativeCoinTransferMapper,
    QueuedItemsMapper,
    SafeAppInfoMapper,
    SettingsChangeMapper,
    SwapTransferInfoMapper,
    TransactionDataMapper,
    TransactionPreviewMapper,
    TransactionsHistoryMapper,
    TransactionsService,
    TransferDetailsMapper,
    TransferInfoMapper,
    TransferImitationMapper,
    HumanDescriptionMapper,
  ],
})
export class TransactionsModule {}
