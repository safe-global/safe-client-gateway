import { Inject, Injectable, Module } from '@nestjs/common';
import {
  BalancesRepositoryModule,
  IBalancesRepository,
} from '@/domain/balances/balances.repository.interface';
import {
  ChainsRepositoryModule,
  IChainsRepository,
} from '@/domain/chains/chains.repository.interface';
import {
  CollectiblesRepositoryModule,
  ICollectiblesRepository,
} from '@/domain/collectibles/collectibles.repository.interface';
import {
  IMessagesRepository,
  MessagesRepositoryModule,
} from '@/domain/messages/messages.repository.interface';
import {
  ISafeAppsRepository,
  SafeAppsRepositoryModule,
} from '@/domain/safe-apps/safe-apps.repository.interface';
import {
  ISafeRepository,
  SafeRepositoryModule,
} from '@/domain/safe/safe.repository.interface';
import {
  ITransactionsRepository,
  TransactionsRepositoryModule,
} from '@/domain/transactions/transactions.repository.interface';
import {
  TransactionEventType,
  ConfigEventType,
} from '@/routes/hooks/entities/event-type.entity';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Event } from '@/routes/hooks/entities/event.entity';
import {
  BlockchainRepositoryModule,
  IBlockchainRepository,
} from '@/domain/blockchain/blockchain.repository.interface';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { memoize, MemoizedFunction } from 'lodash';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';

@Injectable()
export class EventCacheHelper {
  private static readonly HOOK_TYPE = 'hook';
  public isSupportedChainMemo: ((chainId: string) => Promise<boolean>) &
    MemoizedFunction;

  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IBlockchainRepository)
    private readonly blockchainRepository: IBlockchainRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(ICollectiblesRepository)
    private readonly collectiblesRepository: ICollectiblesRepository,
    @Inject(IMessagesRepository)
    private readonly messagesRepository: IMessagesRepository,
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: ISafeAppsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    @Inject(ITransactionsRepository)
    private readonly transactionsRepository: ITransactionsRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.isSupportedChainMemo = memoize(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.chainsRepository.isSupportedChain.bind(this.chainsRepository),
    );
  }

  public async onEventClearCache(event: Event): Promise<void[]> {
    const promises: Promise<void>[] = [];
    switch (event.type) {
      case TransactionEventType.PENDING_MULTISIG_TRANSACTION:
        promises.push(
          ...this.onTransactionEventPendingMultisigTransaction(event),
        );
        break;
      case TransactionEventType.DELETED_MULTISIG_TRANSACTION:
        promises.push(
          ...this.onTransactionEventDeletedMultisigTransaction(event),
        );
        break;
      case TransactionEventType.MODULE_TRANSACTION:
        promises.push(...this.onTransactionEventModuleTransaction(event));
        break;

      case TransactionEventType.EXECUTED_MULTISIG_TRANSACTION:
        promises.push(
          ...this.onTransactionEventExecutedMultisigTransaction(event),
        );
        break;
      case TransactionEventType.NEW_CONFIRMATION:
        promises.push(...this.onTransactionEventNewConfirmation(event));
        break;
      case TransactionEventType.INCOMING_ETHER:
        promises.push(...this.onTransactionEventIncomingEther(event));
        break;
      case TransactionEventType.OUTGOING_ETHER:
        promises.push(...this.onTransactionEventOutgoingEther(event));
        break;
      case TransactionEventType.INCOMING_TOKEN:
        promises.push(...this.onTransactionEventIncomingToken(event));
        break;
      case TransactionEventType.OUTGOING_TOKEN:
        promises.push(...this.onTransactionEventOutgoingToken(event));
        break;
      case TransactionEventType.MESSAGE_CREATED:
        promises.push(...this.onTransactionEventMessageCreated(event));
        break;
      case TransactionEventType.MESSAGE_CONFIRMATION:
        promises.push(...this.onTransactionEventMessageConfirmation(event));
        break;
      case ConfigEventType.CHAIN_UPDATE:
        promises.push(...this.onConfigEventChainUpdate(event));
        break;
      case ConfigEventType.SAFE_APPS_UPDATE:
        promises.push(...this.onConfigEventSafeAppsUpdate(event));
        break;
      case TransactionEventType.SAFE_CREATED:
        promises.push(...this.onTransactionEventSafeCreated(event));
        break;
    }
    return Promise.all(promises);
  }

  public onEventLog(event: Event): void {
    switch (event.type) {
      case TransactionEventType.PENDING_MULTISIG_TRANSACTION:
      case TransactionEventType.DELETED_MULTISIG_TRANSACTION:
      case TransactionEventType.EXECUTED_MULTISIG_TRANSACTION:
      case TransactionEventType.NEW_CONFIRMATION:
        this._logSafeTxEvent(event);
        break;
      case TransactionEventType.MODULE_TRANSACTION:
      case TransactionEventType.INCOMING_ETHER:
      case TransactionEventType.OUTGOING_ETHER:
      case TransactionEventType.INCOMING_TOKEN:
      case TransactionEventType.OUTGOING_TOKEN:
        this._logTxEvent(event);
        break;
      case TransactionEventType.MESSAGE_CREATED:
      case TransactionEventType.MESSAGE_CONFIRMATION:
        this._logMessageEvent(event);
        break;
      case ConfigEventType.CHAIN_UPDATE:
      case ConfigEventType.SAFE_APPS_UPDATE:
        this._logEvent(event);
        break;
      case TransactionEventType.SAFE_CREATED:
        break;
    }
  }

  // Transaction Service events

  private onTransactionEventPendingMultisigTransaction(
    event: Extract<
      Event,
      { type: TransactionEventType.PENDING_MULTISIG_TRANSACTION }
    >,
  ): Array<Promise<void>> {
    // A new pending multisig transaction affects:
    // queued transactions – clear multisig transactions
    // the pending transaction – clear multisig transaction
    return [
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
    ];
  }

  private onTransactionEventDeletedMultisigTransaction(
    event: Extract<
      Event,
      { type: TransactionEventType.DELETED_MULTISIG_TRANSACTION }
    >,
  ): Array<Promise<void>> {
    // A deleted multisig transaction affects:
    // queued transactions – clear multisig transactions
    // the pending transaction – clear multisig transaction
    return [
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
    ];
  }

  private onTransactionEventModuleTransaction(
    event: Extract<Event, { type: TransactionEventType.MODULE_TRANSACTION }>,
  ): Array<Promise<void>> {
    // An executed module transaction might affect:
    // - the list of all executed transactions for the safe
    // - the stakes of a safe
    // - the list of module transactions for the safe
    // - the safe configuration
    return [
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.stakingRepository.clearStakes({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearModuleTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearSafe({
        chainId: event.chainId,
        address: event.address,
      }),
    ];
  }

  private onTransactionEventExecutedMultisigTransaction(
    event: Extract<
      Event,
      { type: TransactionEventType.EXECUTED_MULTISIG_TRANSACTION }
    >,
  ): Array<Promise<void>> {
    // A new executed multisig transaction affects:
    // - the collectibles that the safe has
    // - the list of all executed transactions for the safe
    // - the transfers for that safe
    // - queued transactions and history – clear multisig transactions
    // - the transaction executed – clear multisig transaction
    // - the safe configuration - clear safe info
    // - the stakes of a safe
    return [
      this.collectiblesRepository.clearCollectibles({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
      this.safeRepository.clearSafe({
        chainId: event.chainId,
        address: event.address,
      }),
      this.stakingRepository.clearStakes({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventNewConfirmation(
    event: Extract<Event, { type: TransactionEventType.NEW_CONFIRMATION }>,
  ): Array<Promise<void>> {
    // A new confirmation for a pending transaction affects:
    // - queued transactions – clear multisig transactions
    // - the pending transaction – clear multisig transaction
    return [
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransaction({
        chainId: event.chainId,
        safeTransactionHash: event.safeTxHash,
      }),
    ];
  }

  private onTransactionEventIncomingEther(
    event: Extract<Event, { type: TransactionEventType.INCOMING_ETHER }>,
  ): Array<Promise<void>> {
    // Incoming ether affects:
    // - the balance of the safe - clear safe balance
    // - the list of all executed transactions (including transfers) for the safe
    // - the incoming transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearIncomingTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventOutgoingEther(
    event: Extract<Event, { type: TransactionEventType.OUTGOING_ETHER }>,
  ): Array<Promise<void>> {
    // Outgoing ether affects:
    // - the balance of the safe - clear safe balance
    // - the list of all executed transactions for the safe
    // - queued transactions and history – clear multisig transactions
    // - the transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventIncomingToken(
    event: Extract<Event, { type: TransactionEventType.INCOMING_TOKEN }>,
  ): Array<Promise<void>> {
    // An incoming token affects:
    // - the balance of the safe - clear safe balance
    // - the collectibles that the safe has
    // - the list of all executed transactions (including transfers) for the safe
    // - queued transactions and history – clear multisig transactions
    // - the transfers for that safe
    // - the incoming transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.collectiblesRepository.clearCollectibles({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearIncomingTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventOutgoingToken(
    event: Extract<Event, { type: TransactionEventType.OUTGOING_TOKEN }>,
  ): Array<Promise<void>> {
    // An outgoing token affects:
    // - the balance of the safe - clear safe balance
    // - the collectibles that the safe has
    // - the list of all executed transactions (including transfers) for the safe
    // - queued transactions and history – clear multisig transactions
    // - the transfers for that safe
    return [
      this.balancesRepository.clearBalances({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.collectiblesRepository.clearCollectibles({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearAllExecutedTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearMultisigTransactions({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
      this.safeRepository.clearTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventMessageCreated(
    event: Extract<Event, { type: TransactionEventType.MESSAGE_CREATED }>,
  ): Array<Promise<void>> {
    // A message created affects:
    // - the messages associated to the Safe
    return [
      this.messagesRepository.clearMessagesBySafe({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  private onTransactionEventMessageConfirmation(
    event: Extract<Event, { type: TransactionEventType.MESSAGE_CONFIRMATION }>,
  ): Array<Promise<void>> {
    // A new message confirmation affects:
    // - the message itself
    // - the messages associated to the Safe
    return [
      this.messagesRepository.clearMessagesByHash({
        chainId: event.chainId,
        messageHash: event.messageHash,
      }),
      this.messagesRepository.clearMessagesBySafe({
        chainId: event.chainId,
        safeAddress: event.address,
      }),
    ];
  }

  // Config Service events

  private onConfigEventChainUpdate(
    event: Extract<Event, { type: ConfigEventType.CHAIN_UPDATE }>,
  ): Array<Promise<void>> {
    // As the chains have been updated, we need to clear the memoized function cache.
    if (this.isSupportedChainMemo.cache.clear) {
      this.isSupportedChainMemo.cache.clear();
    }
    return [
      this.chainsRepository.clearChain(event.chainId).then(() => {
        // RPC may have changed
        this.blockchainRepository.clearApi(event.chainId);
        // Testnet status may have changed
        this.stakingRepository.clearApi(event.chainId);
        // Transaction Service may have changed
        this.transactionsRepository.clearApi(event.chainId);
        this.balancesRepository.clearApi(event.chainId);
      }),
    ];
  }

  private onConfigEventSafeAppsUpdate(
    event: Extract<Event, { type: ConfigEventType.SAFE_APPS_UPDATE }>,
  ): Array<Promise<void>> {
    return [this.safeAppsRepository.clearSafeApps(event.chainId)];
  }

  private onTransactionEventSafeCreated(
    event: Extract<Event, { type: TransactionEventType.SAFE_CREATED }>,
  ): Array<Promise<void>> {
    return [this.safeRepository.clearIsSafe(event)];
  }

  private _logSafeTxEvent(
    event: Event & { address: string; safeTxHash: string },
  ): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      safeTxHash: event.safeTxHash,
    });
  }

  private _logTxEvent(
    event: Event & { address: string; txHash: string },
  ): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      txHash: event.txHash,
    });
  }

  private _logMessageEvent(
    event: Event & { address: string; messageHash: string },
  ): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      messageHash: event.messageHash,
    });
  }

  private _logEvent(event: Event): void {
    this.loggingService.info({
      type: EventCacheHelper.HOOK_TYPE,
      eventType: event.type,
      chainId: event.chainId,
    });
  }
}

@Module({
  imports: [
    BalancesRepositoryModule,
    BlockchainRepositoryModule,
    ChainsRepositoryModule,
    CollectiblesRepositoryModule,
    MessagesRepositoryModule,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    StakingRepositoryModule,
    TransactionsRepositoryModule,
  ],
  providers: [EventCacheHelper],
  exports: [EventCacheHelper],
})
export class EventCacheHelperModule {}
