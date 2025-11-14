import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';
import { ContractsRepositoryModule } from '@/modules/contracts/domain/contracts.repository.interface';
import { DataDecoderRepositoryModule } from '@/modules/data-decoder/domain/v2/data-decoder.repository.module';
import { EarnRepositoryModule } from '@/modules/earn/domain/earn.repository.module';
import { HumanDescriptionRepositoryModule } from '@/modules/human-description/domain/human-description.repository.interface';
import { SafeAppsRepositoryModule } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { StakingRepositoryModule } from '@/modules/staking/domain/staking.repository.module';
import { GPv2DecoderModule } from '@/modules/swaps/domain/contracts/decoders/gp-v2-decoder.helper';
import { SwapsRepositoryModule } from '@/modules/swaps/domain/swaps-repository.module';
import { TokenRepositoryModule } from '@/modules/tokens/domain/token.repository.interface';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { GPv2OrderHelper } from '@/modules/transactions/routes/helpers/gp-v2-order.helper';
import { KilnNativeStakingHelperModule } from '@/modules/transactions/routes/helpers/kiln-native-staking.helper';
import { SwapAppsHelperModule } from '@/modules/transactions/routes/helpers/swap-apps.helper';
import { SwapOrderHelperModule } from '@/modules/transactions/routes/helpers/swap-order.helper';
import { TwapOrderHelperModule } from '@/modules/transactions/routes/helpers/twap-order.helper';
import { CustomTransactionMapper } from '@/modules/transactions/routes/mappers/common/custom-transaction.mapper';
import { DataDecodedParamHelper } from '@/modules/transactions/routes/mappers/common/data-decoded-param.helper';
import { Erc20TransferMapper } from '@/modules/transactions/routes/mappers/common/erc20-transfer.mapper';
import { Erc721TransferMapper } from '@/modules/transactions/routes/mappers/common/erc721-transfer.mapper';
import { HumanDescriptionMapper } from '@/modules/transactions/routes/mappers/common/human-description.mapper';
import { NativeCoinTransferMapper } from '@/modules/transactions/routes/mappers/common/native-coin-transfer.mapper';
import { NativeStakingMapper } from '@/modules/transactions/routes/mappers/common/native-staking.mapper';
import { SafeAppInfoMapper } from '@/modules/transactions/routes/mappers/common/safe-app-info.mapper';
import { SettingsChangeMapper } from '@/modules/transactions/routes/mappers/common/settings-change.mapper';
import { SwapOrderMapperModule } from '@/modules/transactions/routes/mappers/common/swap-order.mapper';
import { TransactionDataMapper } from '@/modules/transactions/routes/mappers/common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '@/modules/transactions/routes/mappers/common/transaction-info.mapper';
import { TwapOrderMapperModule } from '@/modules/transactions/routes/mappers/common/twap-order.mapper';
import { CreationTransactionMapper } from '@/modules/transactions/routes/mappers/creation-transaction/creation-transaction.mapper';
import { ModuleTransactionDetailsMapper } from '@/modules/transactions/routes/mappers/module-transactions/module-transaction-details.mapper';
import { ModuleTransactionStatusMapper } from '@/modules/transactions/routes/mappers/module-transactions/module-transaction-status.mapper';
import { ModuleTransactionMapper } from '@/modules/transactions/routes/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionDetailsMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper';
import { MultisigTransactionExecutionDetailsMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import { MultisigTransactionExecutionInfoMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionNoteMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { MultisigTransactionMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from '@/modules/transactions/routes/mappers/queued-items/queued-items.mapper';
import { TransactionPreviewMapper } from '@/modules/transactions/routes/mappers/transaction-preview.mapper';
import { TransactionsHistoryMapper } from '@/modules/transactions/routes/mappers/transactions-history.mapper';
import { SwapTransferInfoMapper } from '@/modules/transactions/routes/mappers/transfers/swap-transfer-info.mapper';
import { TransferDetailsMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-details.mapper';
import { TransferImitationMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-imitation.mapper';
import { TransferInfoMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-info.mapper';
import { TransferMapper } from '@/modules/transactions/routes/mappers/transfers/transfer.mapper';
import { TransactionsController } from '@/modules/transactions/routes/transactions.controller';
import { TransactionsService } from '@/modules/transactions/routes/transactions.service';
import { Module } from '@nestjs/common';
import { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { KilnVaultHelperModule } from '@/modules/transactions/routes/helpers/kiln-vault.helper';
import { VaultTransactionMapper } from '@/modules/transactions/routes/mappers/common/vault-transaction.mapper';
import { BridgeTransactionMapper } from '@/modules/transactions/routes/mappers/common/bridge-transaction.mapper';
import { LiFiDecoderModule } from '@/modules/bridge/domain/contracts/decoders/lifi-decoder.helper';
import { LiFiHelperModule } from '@/modules/transactions/routes/helpers/lifi-helper';
import { BridgeRepositoryModule } from '@/modules/bridge/domain/bridge.repository.module';

@Module({
  controllers: [TransactionsController],
  imports: [
    AddressInfoModule,
    BridgeRepositoryModule,
    ChainsRepositoryModule,
    ContractsRepositoryModule,
    DataDecoderRepositoryModule,
    DelegatesV2RepositoryModule,
    EarnRepositoryModule,
    GPv2DecoderModule,
    HumanDescriptionRepositoryModule,
    KilnNativeStakingHelperModule,
    KilnVaultHelperModule,
    LiFiHelperModule,
    LiFiDecoderModule,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    StakingRepositoryModule,
    SwapAppsHelperModule,
    SwapOrderHelperModule,
    SwapOrderMapperModule,
    SwapsRepositoryModule,
    TokenRepositoryModule,
    TwapOrderHelperModule,
    TwapOrderMapperModule,
  ],
  providers: [
    BridgeTransactionMapper,
    CreationTransactionMapper,
    CustomTransactionMapper,
    DataDecodedParamHelper,
    Erc20TransferMapper,
    Erc721TransferMapper,
    GPv2OrderHelper,
    HumanDescriptionMapper,
    ModuleTransactionDetailsMapper,
    ModuleTransactionMapper,
    ModuleTransactionStatusMapper,
    MultisigTransactionDetailsMapper,
    MultisigTransactionExecutionDetailsMapper,
    MultisigTransactionExecutionInfoMapper,
    MultisigTransactionInfoMapper,
    MultisigTransactionMapper,
    MultisigTransactionNoteMapper,
    MultisigTransactionStatusMapper,
    NativeCoinTransferMapper,
    NativeStakingMapper,
    QueuedItemsMapper,
    SafeAppInfoMapper,
    SettingsChangeMapper,
    SwapTransferInfoMapper,
    TransactionDataMapper,
    TransactionPreviewMapper,
    TransactionsHistoryMapper,
    TransactionsService,
    TransactionVerifierHelper,
    TransferDetailsMapper,
    TransferImitationMapper,
    TransferInfoMapper,
    TransferMapper,
    VaultTransactionMapper,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
