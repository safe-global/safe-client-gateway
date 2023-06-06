import { Inject, Injectable } from '@nestjs/common';
import { EventType } from './entities/event-payload.entity';
import { IBalancesRepository } from '../../domain/balances/balances.repository.interface';
import { ExecutedTransaction } from './entities/executed-transaction.entity';
import { NewConfirmation } from './entities/new-confirmation.entity';
import { PendingTransaction } from './entities/pending-transaction.entity';

@Injectable()
export class CacheHooksService {
  constructor(
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
  ) {}

  async onEvent(
    chainId: string,
    event: ExecutedTransaction | NewConfirmation | PendingTransaction,
  ): Promise<void> {
    switch (event.type) {
      case EventType.PENDING_MULTISIG_TRANSACTION:
        break;
      case EventType.EXECUTED_MULTISIG_TRANSACTION:
        await this.balancesRepository.clearLocalBalances(
          chainId,
          event.address,
        );
        break;
      case EventType.NEW_CONFIRMATION:
        break;
    }
  }
}
