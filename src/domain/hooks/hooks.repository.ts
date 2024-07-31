import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { ITransactionsRepository } from '@/domain/transactions/transactions.repository.interface';
import {
  TransactionEventType,
  ConfigEventType,
} from '@/routes/hooks/entities/event-type.entity';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Event } from '@/routes/hooks/entities/event.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IQueuesRepository } from '@/domain/queues/queues-repository.interface';
import { ConsumeMessage } from 'amqplib';
import { EventSchema } from '@/routes/hooks/entities/schemas/event.schema';
import { IBlockchainRepository } from '@/domain/blockchain/blockchain.repository.interface';
import { IHooksRepository } from '@/domain/hooks/hooks.repository.interface';
import { EventNotificationsHelper } from '@/domain/hooks/helpers/event-notifications.helper';

@Injectable()
export class HooksRepositoryWithNotifications implements IHooksRepository {
  private static readonly HOOK_TYPE = 'hook';
  private readonly queueName: string;

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
    @Inject(ITransactionsRepository)
    private readonly transactionsRepository: ITransactionsRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IQueuesRepository)
    private readonly queuesRepository: IQueuesRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(EventNotificationsHelper)
    private readonly eventNotificationsHelper: EventNotificationsHelper,
  ) {
    this.queueName = this.configurationService.getOrThrow<string>('amqp.queue');
  }

  onModuleInit(): Promise<void> {
    return this.queuesRepository.subscribe(
      this.queueName,
      async (msg: ConsumeMessage) => {
        try {
          const content = JSON.parse(msg.content.toString());
          const event: Event = EventSchema.parse(content);
          await this.onEvent(event);
        } catch (err) {
          this.loggingService.error(err);
        }
      },
    );
  }

  async onEvent(event: Event): Promise<unknown> {
    return Promise.allSettled([
      this.onEventClearCache(event),
      this.eventNotificationsHelper.onEventEnqueueNotifications(event),
    ]).finally(() => {
      this.onEventLog(event);
    });
  }

  private async onEventClearCache(event: Event): Promise<void[]> {
    const promises: Promise<void>[] = [];
    switch (event.type) {
      // A new pending multisig transaction affects:
      // queued transactions – clear multisig transactions
      // the pending transaction – clear multisig transaction
      case TransactionEventType.PENDING_MULTISIG_TRANSACTION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        break;
      // A deleted multisig transaction affects:
      // queued transactions – clear multisig transactions
      // the pending transaction – clear multisig transaction
      case TransactionEventType.DELETED_MULTISIG_TRANSACTION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        break;
      // An executed module transaction might affect:
      // - the list of all executed transactions for the safe
      // - the list of module transactions for the safe
      // - the safe configuration
      case TransactionEventType.MODULE_TRANSACTION:
        promises.push(
          this.safeRepository.clearAllExecutedTransactions({
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
        );
        break;
      // A new executed multisig transaction affects:
      // - the collectibles that the safe has
      // - the list of all executed transactions for the safe
      // - the transfers for that safe
      // - queued transactions and history – clear multisig transactions
      // - the transaction executed – clear multisig transaction
      // - the safe configuration - clear safe info
      case TransactionEventType.EXECUTED_MULTISIG_TRANSACTION:
        promises.push(
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
        );
        break;
      // A new confirmation for a pending transaction affects:
      // - queued transactions – clear multisig transactions
      // - the pending transaction – clear multisig transaction
      case TransactionEventType.NEW_CONFIRMATION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        break;
      // Incoming ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions (including transfers) for the safe
      // - the incoming transfers for that safe
      case TransactionEventType.INCOMING_ETHER:
        promises.push(
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
        );
        break;
      // Outgoing ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      case TransactionEventType.OUTGOING_ETHER:
        promises.push(
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
        );
        break;
      // An incoming token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      // - the incoming transfers for that safe
      case TransactionEventType.INCOMING_TOKEN:
        promises.push(
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
        );
        break;
      // An outgoing token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      case TransactionEventType.OUTGOING_TOKEN:
        promises.push(
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
        );
        break;
      // A message created affects:
      // - the messages associated to the Safe
      case TransactionEventType.MESSAGE_CREATED:
        promises.push(
          this.messagesRepository.clearMessagesBySafe({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
        );
        break;
      // A new message confirmation affects:
      // - the message itself
      // - the messages associated to the Safe
      case TransactionEventType.MESSAGE_CONFIRMATION:
        promises.push(
          this.messagesRepository.clearMessagesByHash({
            chainId: event.chainId,
            messageHash: event.messageHash,
          }),
          this.messagesRepository.clearMessagesBySafe({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
        );
        break;
      case ConfigEventType.CHAIN_UPDATE:
        promises.push(
          this.chainsRepository.clearChain(event.chainId).then(() => {
            // RPC may have changed
            this.blockchainRepository.clearApi(event.chainId);
            // Transaction Service may have changed
            this.transactionsRepository.clearApi(event.chainId);
            this.balancesRepository.clearApi(event.chainId);
          }),
        );
        break;
      case ConfigEventType.SAFE_APPS_UPDATE:
        promises.push(this.safeAppsRepository.clearSafeApps(event.chainId));
        break;
      case TransactionEventType.SAFE_CREATED:
        promises.push(this.safeRepository.clearIsSafe(event));
        break;
    }
    return Promise.all(promises);
  }

  private onEventLog(event: Event): void {
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

  private _logSafeTxEvent(
    event: Event & { address: string; safeTxHash: string },
  ): void {
    this.loggingService.info({
      type: HooksRepositoryWithNotifications.HOOK_TYPE,
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
      type: HooksRepositoryWithNotifications.HOOK_TYPE,
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
      type: HooksRepositoryWithNotifications.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      messageHash: event.messageHash,
    });
  }

  private _logEvent(event: Event): void {
    this.loggingService.info({
      type: HooksRepositoryWithNotifications.HOOK_TYPE,
      eventType: event.type,
      chainId: event.chainId,
    });
  }
}

// TODO: Remove after notifications FF is enabled
// Note: trying to convert this into a dynamic module proved to be too complex
// due to config injection issues from the ConfigurationService so this is a
// temporary solution
@Injectable()
export class HooksRepository implements IHooksRepository {
  private static readonly HOOK_TYPE = 'hook';
  private readonly queueName: string;

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
    @Inject(ITransactionsRepository)
    private readonly transactionsRepository: ITransactionsRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IQueuesRepository)
    private readonly queuesRepository: IQueuesRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.queueName = this.configurationService.getOrThrow<string>('amqp.queue');
  }

  onModuleInit(): Promise<void> {
    return this.queuesRepository.subscribe(
      this.queueName,
      async (msg: ConsumeMessage) => {
        try {
          const content = JSON.parse(msg.content.toString());
          const event: Event = EventSchema.parse(content);
          await this.onEvent(event);
        } catch (err) {
          this.loggingService.error(err);
        }
      },
    );
  }

  async onEvent(event: Event): Promise<unknown> {
    return this.onEventClearCache(event).finally(() => {
      this.onEventLog(event);
    });
  }

  private async onEventClearCache(event: Event): Promise<void[]> {
    const promises: Promise<void>[] = [];
    switch (event.type) {
      // A new pending multisig transaction affects:
      // queued transactions – clear multisig transactions
      // the pending transaction – clear multisig transaction
      case TransactionEventType.PENDING_MULTISIG_TRANSACTION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        break;
      // A deleted multisig transaction affects:
      // queued transactions – clear multisig transactions
      // the pending transaction – clear multisig transaction
      case TransactionEventType.DELETED_MULTISIG_TRANSACTION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        break;
      // An executed module transaction might affect:
      // - the list of all executed transactions for the safe
      // - the list of module transactions for the safe
      // - the safe configuration
      case TransactionEventType.MODULE_TRANSACTION:
        promises.push(
          this.safeRepository.clearAllExecutedTransactions({
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
        );
        break;
      // A new executed multisig transaction affects:
      // - the collectibles that the safe has
      // - the list of all executed transactions for the safe
      // - the transfers for that safe
      // - queued transactions and history – clear multisig transactions
      // - the transaction executed – clear multisig transaction
      // - the safe configuration - clear safe info
      case TransactionEventType.EXECUTED_MULTISIG_TRANSACTION:
        promises.push(
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
        );
        break;
      // A new confirmation for a pending transaction affects:
      // - queued transactions – clear multisig transactions
      // - the pending transaction – clear multisig transaction
      case TransactionEventType.NEW_CONFIRMATION:
        promises.push(
          this.safeRepository.clearMultisigTransactions({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
          this.safeRepository.clearMultisigTransaction({
            chainId: event.chainId,
            safeTransactionHash: event.safeTxHash,
          }),
        );
        break;
      // Incoming ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions (including transfers) for the safe
      // - the incoming transfers for that safe
      case TransactionEventType.INCOMING_ETHER:
        promises.push(
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
        );
        break;
      // Outgoing ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      case TransactionEventType.OUTGOING_ETHER:
        promises.push(
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
        );
        break;
      // An incoming token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      // - the incoming transfers for that safe
      case TransactionEventType.INCOMING_TOKEN:
        promises.push(
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
        );
        break;
      // An outgoing token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - queued transactions and history – clear multisig transactions
      // - the transfers for that safe
      case TransactionEventType.OUTGOING_TOKEN:
        promises.push(
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
        );
        break;
      // A message created affects:
      // - the messages associated to the Safe
      case TransactionEventType.MESSAGE_CREATED:
        promises.push(
          this.messagesRepository.clearMessagesBySafe({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
        );
        break;
      // A new message confirmation affects:
      // - the message itself
      // - the messages associated to the Safe
      case TransactionEventType.MESSAGE_CONFIRMATION:
        promises.push(
          this.messagesRepository.clearMessagesByHash({
            chainId: event.chainId,
            messageHash: event.messageHash,
          }),
          this.messagesRepository.clearMessagesBySafe({
            chainId: event.chainId,
            safeAddress: event.address,
          }),
        );
        break;
      case ConfigEventType.CHAIN_UPDATE:
        promises.push(
          this.chainsRepository.clearChain(event.chainId).then(() => {
            // RPC may have changed
            this.blockchainRepository.clearApi(event.chainId);
            // Transaction Service may have changed
            this.transactionsRepository.clearApi(event.chainId);
            this.balancesRepository.clearApi(event.chainId);
          }),
        );
        break;
      case ConfigEventType.SAFE_APPS_UPDATE:
        promises.push(this.safeAppsRepository.clearSafeApps(event.chainId));
        break;
      case TransactionEventType.SAFE_CREATED:
        promises.push(this.safeRepository.clearIsSafe(event));
        break;
    }
    return Promise.all(promises);
  }

  private onEventLog(event: Event): void {
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

  private _logSafeTxEvent(
    event: Event & { address: string; safeTxHash: string },
  ): void {
    this.loggingService.info({
      type: HooksRepository.HOOK_TYPE,
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
      type: HooksRepository.HOOK_TYPE,
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
      type: HooksRepository.HOOK_TYPE,
      eventType: event.type,
      address: event.address,
      chainId: event.chainId,
      messageHash: event.messageHash,
    });
  }

  private _logEvent(event: Event): void {
    this.loggingService.info({
      type: HooksRepository.HOOK_TYPE,
      eventType: event.type,
      chainId: event.chainId,
    });
  }
}
