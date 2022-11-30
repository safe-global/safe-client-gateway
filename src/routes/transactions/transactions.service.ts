import { Inject, Injectable } from '@nestjs/common';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { MultisigTransactionMapper } from './mappers/multisig-transaction.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
  ) {}

  async getMultisigTransactions(
    chainId: string,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    executed?: boolean,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>> {
    const multisigTransactions =
      await this.safeRepository.getMultisigTransactions(
        chainId,
        safeAddress,
        executionDateGte,
        executionDateLte,
        to,
        value,
        nonce,
        executed,
        limit,
        offset,
      );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const results = await Promise.all(
      multisigTransactions.results.map(async (multiSignTransaction) => ({
        type: 'TRANSACTION',
        transaction:
          await this.multisigTransactionMapper.mapToTransactionSummary(
            chainId,
            multiSignTransaction,
            safeInfo,
          ),
        conflictType: 'None',
      })),
    );

    return {
      count: multisigTransactions.count,
      next: multisigTransactions.next, // TODO: map URL
      previous: multisigTransactions.previous, // TODO: map URL
      results,
    };
  }
}
