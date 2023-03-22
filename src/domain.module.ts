import { Global, Module } from '@nestjs/common';
import { ExchangeApiModule } from './datasources/exchange-api/exchange-api.module';
import { ConfigApiModule } from './datasources/config-api/config-api.module';
import { TransactionApiModule } from './datasources/transaction-api/transaction-api.module';
import { IBalancesRepository } from './domain/balances/balances.repository.interface';
import { BalancesRepository } from './domain/balances/balances.repository';
import { IChainsRepository } from './domain/chains/chains.repository.interface';
import { ChainsRepository } from './domain/chains/chains.repository';
import { IExchangeRepository } from './domain/exchange/exchange.repository.interface';
import { ExchangeRepository } from './domain/exchange/exchange.repository';
import { IBackboneRepository } from './domain/backbone/backbone.repository.interface';
import { BackboneRepository } from './domain/backbone/backbone.repository';
import { ICollectiblesRepository } from './domain/collectibles/collectibles.repository.interface';
import { CollectiblesRepository } from './domain/collectibles/collectibles.repository';
import { ISafeRepository } from './domain/safe/safe.repository.interface';
import { SafeRepository } from './domain/safe/safe.repository';
import { BackboneValidator } from './domain/backbone/backbone.validator';
import { BalancesValidator } from './domain/balances/balances.validator';
import { ChainsValidator } from './domain/chains/chains.validator';
import { MasterCopyValidator } from './domain/chains/master-copy.validator';
import { CollectiblesValidator } from './domain/collectibles/collectibles.validator';
import { SafeListValidator } from './domain/safe/safe-list.validator';
import { SafeValidator } from './domain/safe/safe.validator';
import { IContractsRepository } from './domain/contracts/contracts.repository.interface';
import { ContractsRepository } from './domain/contracts/contracts.repository';
import { ContractsValidator } from './domain/contracts/contracts.validator';
import { ExchangeRatesValidator } from './domain/exchange/exchange-rates.validator';
import { ExchangeFiatCodesValidator } from './domain/exchange/exchange-fiat-codes.validator';
import { DelegateValidator } from './domain/delegate/delegate.validator';
import { IDelegateRepository } from './domain/delegate/delegate.repository.interface';
import { DelegateRepository } from './domain/delegate/delegate.repository';
import { IDataDecodedRepository } from './domain/data-decoder/data-decoded.repository.interface';
import { DataDecodedRepository } from './domain/data-decoder/data-decoded.repository';
import { DataDecodedValidator } from './domain/data-decoder/data-decoded.validator';
import { TransferValidator } from './domain/safe/transfer.validator';
import { MultisigTransactionValidator } from './domain/safe/multisig-transaction.validator';
import { ISafeAppsRepository } from './domain/safe-apps/safe-apps.repository.interface';
import { SafeAppsRepository } from './domain/safe-apps/safe-apps.repository';
import { SafeAppsValidator } from './domain/safe-apps/safe-apps.validator';
import { TransactionTypeValidator } from './domain/safe/transaction-type.validator';
import { ModuleTransactionValidator } from './domain/safe/module-transaction.validator';
import { ITokenRepository } from './domain/tokens/token.repository.interface';
import { TokenRepository } from './domain/tokens/token.repository';
import { TokenValidator } from './domain/tokens/token.validator';
import { CreationTransactionValidator } from './domain/safe/creation-transaction.validator';
import { INotificationsRepository } from './domain/notifications/notifications.repository.interface';
import { NotificationsRepository } from './domain/notifications/notifications.repository';
import { IEstimationsRepository } from './domain/estimations/estimations.repository.interface';
import { EstimationsRepository } from './domain/estimations/estimations.repository';
import { EstimationsValidator } from './domain/estimations/estimations.validator';
import { MessagesRepository } from './domain/messages/messages.repository';
import { IMessagesRepository } from './domain/messages/messages.repository.interface';
import { MessageValidator } from './domain/messages/message.validator';
import { FlushRepository } from './domain/flush/flush.repository';
import { IFlushRepository } from './domain/flush/flush.repository.interface';

@Global()
@Module({
  imports: [ConfigApiModule, ExchangeApiModule, TransactionApiModule],
  providers: [
    { provide: IBackboneRepository, useClass: BackboneRepository },
    { provide: IBalancesRepository, useClass: BalancesRepository },
    { provide: IChainsRepository, useClass: ChainsRepository },
    { provide: ICollectiblesRepository, useClass: CollectiblesRepository },
    { provide: IContractsRepository, useClass: ContractsRepository },
    { provide: IDataDecodedRepository, useClass: DataDecodedRepository },
    { provide: IDelegateRepository, useClass: DelegateRepository },
    { provide: IEstimationsRepository, useClass: EstimationsRepository },
    { provide: IExchangeRepository, useClass: ExchangeRepository },
    { provide: IFlushRepository, useClass: FlushRepository },
    { provide: IMessagesRepository, useClass: MessagesRepository },
    { provide: INotificationsRepository, useClass: NotificationsRepository },
    { provide: ISafeAppsRepository, useClass: SafeAppsRepository },
    { provide: ISafeRepository, useClass: SafeRepository },
    { provide: ITokenRepository, useClass: TokenRepository },
    BackboneValidator,
    BalancesValidator,
    ChainsValidator,
    CollectiblesValidator,
    ContractsValidator,
    CreationTransactionValidator,
    DataDecodedValidator,
    DelegateValidator,
    EstimationsValidator,
    ExchangeFiatCodesValidator,
    ExchangeRatesValidator,
    MasterCopyValidator,
    MessageValidator,
    ModuleTransactionValidator,
    MultisigTransactionValidator,
    SafeAppsValidator,
    SafeListValidator,
    SafeValidator,
    TokenValidator,
    TransactionTypeValidator,
    TransferValidator,
  ],
  exports: [
    IBackboneRepository,
    IBalancesRepository,
    IChainsRepository,
    ICollectiblesRepository,
    IContractsRepository,
    IDataDecodedRepository,
    IDelegateRepository,
    IEstimationsRepository,
    IExchangeRepository,
    IFlushRepository,
    IMessagesRepository,
    INotificationsRepository,
    ISafeAppsRepository,
    ISafeRepository,
    ITokenRepository,
  ],
})
export class DomainModule {}
