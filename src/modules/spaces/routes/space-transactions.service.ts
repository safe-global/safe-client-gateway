// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import type {
  Confirmation,
  MultisigTransaction,
} from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { SpaceQueueTransaction } from '@/modules/spaces/datasources/entities/space-queue-transaction.entity';
import { ISpaceQueueApi } from '@/modules/spaces/datasources/space-queue-api.service';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { ConflictType } from '@/modules/transactions/routes/entities/conflict-type.entity';
import type { QueuedItem } from '@/modules/transactions/routes/entities/queued-item.entity';
import { TransactionQueuedItem } from '@/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';
import { MultisigTransactionMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import type { Page } from '@/routes/common/entities/page.entity';
import {
  buildNextPageURL,
  buildPreviousPageURL,
  PaginationData,
} from '@/routes/common/pagination/pagination.data';

@Injectable()
export class SpaceTransactionsService {
  public constructor(
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(ISpaceQueueApi)
    private readonly spaceQueueApi: ISpaceQueueApi,
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
  ) {}

  public async getTransactionQueue(args: {
    spaceId: Space['id'];
    routeUrl: Readonly<URL>;
    paginationData: PaginationData;
  }): Promise<Page<QueuedItem>> {
    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(
      args.spaceId,
    );

    if (spaceSafes.length === 0) {
      return { count: 0, next: null, previous: null, results: [] };
    }

    const queuePage = await this.spaceQueueApi.getQueuedTransactions({
      safes: spaceSafes.map(({ chainId, address }) => ({
        chainId,
        address,
      })),
      limit: args.paginationData.limit,
      offset: args.paginationData.offset,
    });

    const safesByKey = await this.loadSafes(spaceSafes);

    const results = await Promise.all(
      queuePage.results.map(async (upstreamTx) => {
        const safe = safesByKey.get(
          this.makeSafeKey(upstreamTx.chainId, upstreamTx.safe),
        ) as Safe;
        const tx = this.toMultisigTransaction(upstreamTx, safe);
        const dataDecoded =
          await this.dataDecoderRepository.getTransactionDataDecoded({
            chainId: upstreamTx.chainId,
            transaction: tx,
          });
        const transaction = await this.multisigTransactionMapper.mapTransaction(
          upstreamTx.chainId,
          tx,
          safe,
          dataDecoded,
        );
        return new TransactionQueuedItem(transaction, ConflictType.None);
      }),
    );

    const nextURL = buildNextPageURL(args.routeUrl, queuePage.count);
    const previousURL = buildPreviousPageURL(args.routeUrl);

    return {
      count: queuePage.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  private async loadSafes(
    spaceSafes: Array<{ chainId: string; address: string }>,
  ): Promise<Map<string, Safe>> {
    const entries = await Promise.all(
      spaceSafes.map(async ({ chainId, address }) => {
        const safe = await this.safeRepository.getSafe({
          chainId,
          address: getAddress(address) as Address,
        });
        return [this.makeSafeKey(chainId, safe.address), safe] as const;
      }),
    );
    return new Map(entries);
  }

  private makeSafeKey(chainId: string, address: string): string {
    return `${chainId}:${address.toLowerCase()}`;
  }

  private toMultisigTransaction(
    upstream: SpaceQueueTransaction,
    safe: Safe,
  ): MultisigTransaction {
    const origin = upstream.originName
      ? JSON.stringify({
          name: upstream.originName,
          url: upstream.originUrl,
        })
      : null;

    return {
      safe: upstream.safe,
      to: upstream.to,
      value: upstream.value,
      data: upstream.data,
      operation: upstream.operation,
      gasToken: upstream.gasToken,
      safeTxGas: upstream.safeTxGas,
      baseGas: upstream.baseGas,
      gasPrice: upstream.gasPrice,
      proposer: upstream.proposer,
      proposedByDelegate: upstream.proposedByDelegate,
      refundReceiver: upstream.refundReceiver,
      nonce: upstream.nonce,
      executionDate: null,
      submissionDate: upstream.created,
      modified: upstream.modified,
      blockNumber: null,
      transactionHash: upstream.txHash,
      safeTxHash: upstream.safeTxHash,
      executor: null,
      isExecuted: false,
      isSuccessful: null,
      ethGasPrice: null,
      gasUsed: null,
      fee: null,
      payment: null,
      origin,
      confirmationsRequired: safe.threshold,
      confirmations: (upstream.confirmations ?? []).map(
        (c): Confirmation => ({
          owner: c.owner,
          submissionDate: c.created,
          transactionHash: null,
          signatureType: c.signatureType,
          signature: c.signature,
        }),
      ),
      signatures: null,
      trusted: true,
    };
  }
}
