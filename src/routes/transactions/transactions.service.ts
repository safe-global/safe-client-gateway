import { Inject, Injectable } from '@nestjs/common';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { ModuleTransactionMapper } from './mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from './mappers/multisig-transactions/multisig-transaction.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: SafeRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
  ) {}

  async getMultisigTransactions(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    executed?: boolean,
    paginationData?: PaginationData,
  ): Promise<Partial<Page<MultisigTransaction>>> {
    const domainTransactions =
      await this.safeRepository.getMultisigTransactions(
        chainId,
        safeAddress,
        executed,
        executionDateGte,
        executionDateLte,
        to,
        value,
        nonce,
        paginationData?.limit,
        paginationData?.offset,
      );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);
    const results = await Promise.all(
      domainTransactions.results.map(
        async (domainTransaction) =>
          new MultisigTransaction(
            await this.multisigTransactionMapper.mapTransaction(
              chainId,
              domainTransaction,
              safeInfo,
            ),
          ),
      ),
    );
    const nextURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.next,
    );
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.previous,
    );

    return {
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  async getModuleTransactions(
    chainId: string,
    routeUrl: Readonly<URL>,
    safeAddress: string,
    to?: string,
    module?: string,
    paginationData?: PaginationData,
  ): Promise<Page<ModuleTransaction>> {
    const domainTransactions = await this.safeRepository.getModuleTransactions(
      chainId,
      safeAddress,
      to,
      module,
      paginationData?.limit,
      paginationData?.offset,
    );

    const safeInfo = await this.safeRepository.getSafe(chainId, safeAddress);

    const results = await Promise.all(
      domainTransactions.results.map(
        async (domainTransaction) =>
          new ModuleTransaction(
            await this.moduleTransactionMapper.mapTransaction(
              chainId,
              domainTransaction,
              safeInfo,
            ),
          ),
      ),
    );
    const nextURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.next,
    );
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      domainTransactions.previous,
    );

    const result = <Page<ModuleTransaction>>{
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };

    return result;
  }
}
