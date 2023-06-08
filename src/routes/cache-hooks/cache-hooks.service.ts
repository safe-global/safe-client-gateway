import { Inject, Injectable } from '@nestjs/common';
import { EventType } from './entities/event-payload.entity';
import { IBalancesRepository } from '../../domain/balances/balances.repository.interface';
import { ExecutedTransaction } from './entities/executed-transaction.entity';
import { NewConfirmation } from './entities/new-confirmation.entity';
import { PendingTransaction } from './entities/pending-transaction.entity';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { IncomingToken } from './entities/incoming-token.entity';
import { OutgoingToken } from './entities/outgoing-token.entity';
import { IncomingEther } from './entities/incoming-ether.entity';
import { OutgoingEther } from './entities/outgoing-ether.entity';
import { ICollectiblesRepository } from '../../domain/collectibles/collectibles.repository.interface';
import { ModuleTransaction } from './entities/module-transaction.entity';

@Injectable()
export class CacheHooksService {
  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(ICollectiblesRepository)
    private readonly collectiblesRepository: ICollectiblesRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  async onEvent(
    chainId: string,
    event:
      | ExecutedTransaction
      | IncomingEther
      | IncomingToken
      | ModuleTransaction
      | NewConfirmation
      | OutgoingToken
      | OutgoingEther
      | PendingTransaction,
  ): Promise<void[]> {
    const promises: Promise<void>[] = [];
    switch (event.type) {
      // A new pending multisig transaction affects:
      // queued transactions – clear multisig transactions
      // the pending transaction – clear multisig transaction
      case EventType.PENDING_MULTISIG_TRANSACTION:
        promises.push(
          this.safeRepository.clearMultisigTransactions(chainId, event.address),
          this.safeRepository.clearMultisigTransaction(
            chainId,
            event.safeTxHash,
          ),
        );
        break;
      // An executed module transaction might affect:
      // - the list of all executed transactions for the safe
      // - the list of module transactions for the safe
      case EventType.MODULE_TRANSACTION:
        promises.push(
          this.safeRepository.clearAllExecutedTransactions(
            chainId,
            event.address,
          ),
          this.safeRepository.clearModuleTransactions(chainId, event.address),
        );
        break;
      // A new executed multisig transaction affects:
      // - the collectibles that the safe has
      // - the list of all executed transactions for the safe
      // - the collectible transfers for that safe
      // - queued transactions and history – clear multisig transactions
      // - the transaction executed – clear multisig transaction
      // - the safe configuration - clear safe info
      case EventType.EXECUTED_MULTISIG_TRANSACTION:
        promises.push(
          this.collectiblesRepository.clearCollectibles(chainId, event.address),
          this.safeRepository.clearAllExecutedTransactions(
            chainId,
            event.address,
          ),
          this.safeRepository.clearCollectibleTransfers(chainId, event.address),
          this.safeRepository.clearMultisigTransactions(chainId, event.address),
          this.safeRepository.clearMultisigTransaction(
            chainId,
            event.safeTxHash,
          ),
          this.safeRepository.clearSafe(chainId, event.address),
        );
        break;
      // A new confirmation for a pending transaction affects:
      // - queued transactions – clear multisig transactions
      // - the pending transaction – clear multisig transaction
      case EventType.NEW_CONFIRMATION:
        promises.push(
          this.safeRepository.clearMultisigTransactions(chainId, event.address),
          this.safeRepository.clearMultisigTransaction(
            chainId,
            event.safeTxHash,
          ),
        );
        break;
      // Incoming ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions (including transfers) for the safe
      // - the incoming transfers for that safe
      case EventType.INCOMING_ETHER:
        promises.push(
          this.balancesRepository.clearLocalBalances(chainId, event.address),
          this.safeRepository.clearAllExecutedTransactions(
            chainId,
            event.address,
          ),
          this.safeRepository.clearIncomingTransfers(chainId, event.address),
        );
        break;
      // Outgoing ether affects:
      // - the balance of the safe - clear safe balance
      // - the list of all executed transactions (including transfers) for the safe
      case EventType.OUTGOING_ETHER:
        promises.push(
          this.balancesRepository.clearLocalBalances(chainId, event.address),
          this.safeRepository.clearAllExecutedTransactions(
            chainId,
            event.address,
          ),
        );
        break;
      // An incoming token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - the collectible transfers for that safe
      // - the incoming transfers for that safe
      case EventType.INCOMING_TOKEN:
        promises.push(
          this.balancesRepository.clearLocalBalances(chainId, event.address),
          this.collectiblesRepository.clearCollectibles(chainId, event.address),
          this.safeRepository.clearAllExecutedTransactions(
            chainId,
            event.address,
          ),
          this.safeRepository.clearCollectibleTransfers(chainId, event.address),
          this.safeRepository.clearIncomingTransfers(chainId, event.address),
        );
        break;
      // An outgoing token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      // - the list of all executed transactions (including transfers) for the safe
      // - the collectible transfers for that safe
      case EventType.OUTGOING_TOKEN:
        promises.push(
          this.balancesRepository.clearLocalBalances(chainId, event.address),
          this.collectiblesRepository.clearCollectibles(chainId, event.address),
          this.safeRepository.clearAllExecutedTransactions(
            chainId,
            event.address,
          ),
          this.safeRepository.clearCollectibleTransfers(chainId, event.address),
        );
        break;
    }
    return Promise.all(promises);
  }
}
