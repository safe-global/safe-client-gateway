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
import { INotificationsRepositoryV2 } from '@/domain/notifications/notifications.repository.v2.interface';
import { DeletedMultisigTransactionEvent } from '@/routes/hooks/entities/schemas/deleted-multisig-transaction.schema';
import { ExecutedTransactionEvent } from '@/routes/hooks/entities/schemas/executed-transaction.schema';
import { IncomingEtherEvent } from '@/routes/hooks/entities/schemas/incoming-ether.schema';
import { IncomingTokenEvent } from '@/routes/hooks/entities/schemas/incoming-token.schema';
import { ModuleTransactionEvent } from '@/routes/hooks/entities/schemas/module-transaction.schema';
import { PendingTransactionEvent } from '@/routes/hooks/entities/schemas/pending-transaction.schema';
import { MessageCreatedEvent } from '@/routes/hooks/entities/schemas/message-created.schema';
import {
  IncomingEtherNotification,
  IncomingTokenNotification,
  ConfirmationRequestNotification,
  MessageConfirmationNotification,
  Notification,
  NotificationType,
} from '@/domain/notifications/entities-v2/notification.entity';

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
    @Inject(INotificationsRepositoryV2)
    private readonly notificationsRepository: INotificationsRepositoryV2,
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
      this.onEventEnqueueNotifications(event),
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

  private async onEventEnqueueNotifications(event: Event): Promise<unknown> {
    if (
      // Don't notify about Config events
      event.type === ConfigEventType.CHAIN_UPDATE ||
      event.type === ConfigEventType.SAFE_APPS_UPDATE ||
      // We already notify about executed multisig/module transactions
      event.type === TransactionEventType.OUTGOING_ETHER ||
      event.type === TransactionEventType.OUTGOING_TOKEN ||
      // We only notify required confirmations on creation - see PENDING_MULTISIG_TRANSACTION
      event.type === TransactionEventType.NEW_CONFIRMATION ||
      // We only notify required confirmations on required - see MESSAGE_CREATED
      event.type === TransactionEventType.MESSAGE_CONFIRMATION ||
      // You cannot subscribe to Safes-to-be-created
      event.type === TransactionEventType.SAFE_CREATED
    ) {
      return;
    }

    const subscriptions =
      await this.notificationsRepository.getSubscribersWithTokensBySafe({
        chainId: event.chainId,
        safeAddress: event.address,
      });

    // Enqueue notifications for each subscriber relative to event
    return await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const data = await this.mapEventNotification(
          event,
          subscription.subscriber,
        );

        if (!data) {
          return;
        }

        return this.notificationsRepository
          .enqueueNotification(subscription.cloudMessagingToken, {
            data,
          })
          .then(() => {
            this.loggingService.info('Notification sent successfully');
          })
          .catch((e) => {
            this.loggingService.error(
              `Failed to send notification: ${e.reason}`,
            );
          });
      }),
    );
  }

  private async mapEventNotification(
    event:
      | DeletedMultisigTransactionEvent
      | ExecutedTransactionEvent
      | IncomingEtherEvent
      | IncomingTokenEvent
      | ModuleTransactionEvent
      | MessageCreatedEvent
      | PendingTransactionEvent,
    subscriber: `0x${string}`,
  ): Promise<Notification | null> {
    if (
      event.type === TransactionEventType.INCOMING_ETHER ||
      event.type === TransactionEventType.INCOMING_TOKEN
    ) {
      return await this.mapIncomingAssetEventNotification(event);
    } else if (
      event.type === TransactionEventType.PENDING_MULTISIG_TRANSACTION
    ) {
      return await this.mapPendingMultisigTransactionEventNotification(
        event,
        subscriber,
      );
    } else if (event.type === TransactionEventType.MESSAGE_CREATED) {
      return await this.mapMessageCreatedEventNotification(event, subscriber);
    } else {
      return event;
    }
  }

  private async mapIncomingAssetEventNotification(
    event: IncomingEtherEvent | IncomingTokenEvent,
  ): Promise<IncomingEtherNotification | IncomingTokenNotification | null> {
    const incomingTransfers = await this.safeRepository
      .getIncomingTransfers({
        chainId: event.chainId,
        safeAddress: event.address,
        txHash: event.txHash,
      })
      .catch(() => null);

    const transfer = incomingTransfers?.results?.find((result) => {
      return result.transactionHash === event.txHash;
    });

    // Asset sent to self
    if (transfer?.from === event.address) {
      return null;
    }

    return event;
  }

  private async mapPendingMultisigTransactionEventNotification(
    event: PendingTransactionEvent,
    subscriber: `0x${string}`,
  ): Promise<ConfirmationRequestNotification | null> {
    const safe = await this.safeRepository.getSafe({
      chainId: event.chainId,
      address: event.address,
    });

    // Transaction is confirmed and awaiting execution
    if (safe.threshold === 1) {
      return null;
    }

    const transaction = await this.safeRepository.getMultiSigTransaction({
      chainId: event.chainId,
      safeTransactionHash: event.safeTxHash,
    });

    const hasSubscriberSigned = transaction.confirmations?.some(
      (confirmation) => {
        return confirmation.owner === subscriber;
      },
    );
    if (hasSubscriberSigned) {
      return null;
    }

    return {
      type: NotificationType.CONFIRMATION_REQUEST,
      chainId: event.chainId,
      address: event.address,
      safeTxHash: event.safeTxHash,
    };
  }

  private async mapMessageCreatedEventNotification(
    event: MessageCreatedEvent,
    subscriber: `0x${string}`,
  ): Promise<MessageConfirmationNotification | null> {
    const safe = await this.safeRepository.getSafe({
      chainId: event.chainId,
      address: event.address,
    });

    // Message is valid
    if (safe.threshold === 1) {
      return null;
    }

    const message = await this.messagesRepository.getMessageByHash({
      chainId: event.chainId,
      messageHash: event.messageHash,
    });

    const hasSubscriberSigned = message.confirmations.some((confirmation) => {
      return confirmation.owner === subscriber;
    });
    if (hasSubscriberSigned) {
      return null;
    }

    return {
      type: NotificationType.MESSAGE_CONFIRMATION_REQUEST,
      chainId: event.chainId,
      address: event.address,
      messageHash: event.messageHash,
    };
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
