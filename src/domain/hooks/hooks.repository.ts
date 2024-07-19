import { Inject, Injectable } from '@nestjs/common';
import { IBalancesRepository } from '@/domain/balances/balances.repository.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ICollectiblesRepository } from '@/domain/collectibles/collectibles.repository.interface';
import { IMessagesRepository } from '@/domain/messages/messages.repository.interface';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { ITransactionsRepository } from '@/domain/transactions/transactions.repository.interface';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Event } from '@/routes/cache-hooks/entities/event.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IQueuesRepository } from '@/domain/queues/queues-repository.interface';
import { ConsumeMessage } from 'amqplib';
import { WebHookSchema } from '@/routes/cache-hooks/entities/schemas/web-hook.schema';
import { IBlockchainRepository } from '@/domain/blockchain/blockchain.repository.interface';
import { IHooksRepository } from '@/domain/hooks/hooks.repository.interface';

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
          const event: Event = WebHookSchema.parse(content);
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
      case EventType.PENDING_MULTISIG_TRANSACTION:
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
      case EventType.DELETED_MULTISIG_TRANSACTION:
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
      case EventType.MODULE_TRANSACTION:
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
      case EventType.EXECUTED_MULTISIG_TRANSACTION:
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
      case EventType.NEW_CONFIRMATION:
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
      case EventType.INCOMING_ETHER:
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
      case EventType.OUTGOING_ETHER:
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
      case EventType.INCOMING_TOKEN:
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
      case EventType.OUTGOING_TOKEN:
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
      case EventType.MESSAGE_CREATED:
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
      case EventType.MESSAGE_CONFIRMATION:
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
      case EventType.CHAIN_UPDATE:
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
      case EventType.SAFE_APPS_UPDATE:
        promises.push(this.safeAppsRepository.clearSafeApps(event.chainId));
        break;
      case EventType.SAFE_CREATED:
        promises.push(this.safeRepository.clearIsSafe(event));
        break;
    }
    return Promise.all(promises);
  }

  private onEventLog(event: Event): void {
    switch (event.type) {
      case EventType.PENDING_MULTISIG_TRANSACTION:
      case EventType.DELETED_MULTISIG_TRANSACTION:
      case EventType.EXECUTED_MULTISIG_TRANSACTION:
      case EventType.NEW_CONFIRMATION:
        this._logSafeTxEvent(event);
        break;
      case EventType.MODULE_TRANSACTION:
      case EventType.INCOMING_ETHER:
      case EventType.OUTGOING_ETHER:
      case EventType.INCOMING_TOKEN:
      case EventType.OUTGOING_TOKEN:
        this._logTxEvent(event);
        break;
      case EventType.MESSAGE_CREATED:
      case EventType.MESSAGE_CONFIRMATION:
        this._logMessageEvent(event);
        break;
      case EventType.CHAIN_UPDATE:
      case EventType.SAFE_APPS_UPDATE:
        this._logEvent(event);
        break;
      case EventType.SAFE_CREATED:
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
