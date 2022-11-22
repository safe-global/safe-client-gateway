import { Inject, Injectable } from '@nestjs/common';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
  ) {}

  async getMultiSigTransactions(
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
    return this.safeRepository.getMultiSigTransactions(
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
  }
}
