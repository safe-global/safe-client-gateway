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
      | NewConfirmation
      | PendingTransaction
      | IncomingToken
      | OutgoingToken
      | IncomingEther
      | OutgoingEther,
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
      // A new executed multisig transaction affects:
      // - the balance of the safe - clear safe balance
      // - the safe configuration - clear safe info
      // - queued transactions and history – clear multisig transactions
      // - the transaction executed – clear multisig transaction
      // - the collectibles that the safe has
      case EventType.EXECUTED_MULTISIG_TRANSACTION:
        promises.push(
          this.balancesRepository.clearLocalBalances(chainId, event.address),
          this.safeRepository.clearSafe(chainId, event.address),
          this.safeRepository.clearMultisigTransactions(chainId, event.address),
          this.safeRepository.clearMultisigTransaction(
            chainId,
            event.safeTxHash,
          ),
          this.collectiblesRepository.clearCollectibles(chainId, event.address),
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
      // An incoming/outgoing ether affects:
      // - the balance of the safe - clear safe balance
      case EventType.INCOMING_ETHER:
      case EventType.OUTGOING_ETHER:
        promises.push(
          this.balancesRepository.clearLocalBalances(chainId, event.address),
        );
        break;
      // An incoming/outgoing token affects:
      // - the balance of the safe - clear safe balance
      // - the collectibles that the safe has
      case EventType.INCOMING_TOKEN:
      case EventType.OUTGOING_TOKEN:
        promises.push(
          this.balancesRepository.clearLocalBalances(chainId, event.address),
          this.collectiblesRepository.clearCollectibles(chainId, event.address),
        );
        break;
    }
    return Promise.all(promises);
  }
}
