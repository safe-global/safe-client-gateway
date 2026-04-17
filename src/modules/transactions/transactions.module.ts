// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { BridgeModule } from '@/modules/bridge/bridge.module';
import { LiFiDecoderModule } from '@/modules/bridge/domain/contracts/decoders/lifi-decoder.helper';
import { ChainsModule } from '@/modules/chains/chains.module';
import { ContractsModule } from '@/modules/contracts/contracts.module';
import { DataDecoderModule } from '@/modules/data-decoder/data-decoder.module';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { EarnModule } from '@/modules/earn/earn.module';
import { HumanDescriptionModule } from '@/modules/human-description/human-description.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { SafeAppsModule } from '@/modules/safe-apps/safe-apps.module';
import { StakingModule } from '@/modules/staking/staking.module';
import { GPv2DecoderModule } from '@/modules/swaps/domain/contracts/decoders/gp-v2-decoder.helper';
import { SwapsModule } from '@/modules/swaps/swaps.module';
import { TokensModule } from '@/modules/tokens/tokens.module';
import { TransactionsRepository } from '@/modules/transactions/domain/transactions.repository';
import { ITransactionsRepository } from '@/modules/transactions/domain/transactions.repository.interface';
import { GPv2OrderHelper } from '@/modules/transactions/routes/helpers/gp-v2-order.helper';
import { KilnNativeStakingHelperModule } from '@/modules/transactions/routes/helpers/kiln-native-staking.helper';
import { KilnVaultHelperModule } from '@/modules/transactions/routes/helpers/kiln-vault.helper';
import { LiFiHelperModule } from '@/modules/transactions/routes/helpers/lifi-helper';
import { SwapAppsHelperModule } from '@/modules/transactions/routes/helpers/swap-apps.helper';
import { SwapOrderHelperModule } from '@/modules/transactions/routes/helpers/swap-order.helper';
import { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { TwapOrderHelperModule } from '@/modules/transactions/routes/helpers/twap-order.helper';
import { BridgeTransactionMapper } from '@/modules/transactions/routes/mappers/common/bridge-transaction.mapper';
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
import { VaultTransactionMapper } from '@/modules/transactions/routes/mappers/common/vault-transaction.mapper';
import { CreationTransactionMapper } from '@/modules/transactions/routes/mappers/creation-transaction/creation-transaction.mapper';
import { ModuleTransactionMapper } from '@/modules/transactions/routes/mappers/module-transactions/module-transaction.mapper';
import { ModuleTransactionDetailsMapper } from '@/modules/transactions/routes/mappers/module-transactions/module-transaction-details.mapper';
import { ModuleTransactionStatusMapper } from '@/modules/transactions/routes/mappers/module-transactions/module-transaction-status.mapper';
import { MultisigTransactionMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import { MultisigTransactionDetailsMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper';
import { MultisigTransactionExecutionDetailsMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import { MultisigTransactionExecutionInfoMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionNoteMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { MultisigTransactionStatusMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { QueuedItemsMapper } from '@/modules/transactions/routes/mappers/queued-items/queued-items.mapper';
import { TransactionPreviewMapper } from '@/modules/transactions/routes/mappers/transaction-preview.mapper';
import { TransactionsHistoryMapper } from '@/modules/transactions/routes/mappers/transactions-history.mapper';
import { SwapTransferInfoMapper } from '@/modules/transactions/routes/mappers/transfers/swap-transfer-info.mapper';
import { TransferMapper } from '@/modules/transactions/routes/mappers/transfers/transfer.mapper';
import { TransferDetailsMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-details.mapper';
import { TransferImitationMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-imitation.mapper';
import { TransferInfoMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-info.mapper';
import { TransactionsController } from '@/modules/transactions/routes/transactions.controller';
import { TransactionsService } from '@/modules/transactions/routes/transactions.service';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';

@Module({
  controllers: [TransactionsController],
  imports: [
    AddressInfoModule,
    BridgeModule,
    ChainsModule,
    ContractsModule,
    DataDecoderModule,
    DelegatesV2RepositoryModule,
    EarnModule,
    GPv2DecoderModule,
    HumanDescriptionModule,
    KilnNativeStakingHelperModule,
    KilnVaultHelperModule,
    LiFiHelperModule,
    LiFiDecoderModule,
    SafeAppsModule,
    SafeRepositoryModule,
    StakingModule,
    SwapAppsHelperModule,
    SwapOrderHelperModule,
    SwapOrderMapperModule,
    SwapsModule,
    TokensModule,
    TransactionApiManagerModule,
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
    {
      provide: ITransactionsRepository,
      useClass: TransactionsRepository,
    },
  ],
  exports: [ITransactionsRepository, TransactionsService],
})
export class TransactionsModule {}
