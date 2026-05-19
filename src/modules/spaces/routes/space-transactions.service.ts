// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
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
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { ConflictType } from '@/modules/transactions/routes/entities/conflict-type.entity';
import type { QueuedItem } from '@/modules/transactions/routes/entities/queued-item.entity';
import { TransactionQueuedItem } from '@/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';
import { MultisigTransactionMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
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
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
  ) {}

  public async getTransactionQueue(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    routeUrl: Readonly<URL>;
    paginationData: PaginationData;
  }): Promise<Page<QueuedItem>> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(
      args.spaceId,
    );

    if (spaceSafes.length === 0) {
      return { count: 0, next: null, previous: null, results: [] };
    }

    const knownSafeKeys = new Set(
      spaceSafes.map(({ chainId, address }) =>
        this.makeSafeKey(chainId, address),
      ),
    );

    const queuePage = await this.spaceQueueApi.getQueuedTransactions({
      safes: spaceSafes.map(({ chainId, address }) => ({
        chainId,
        address,
      })),
      limit: args.paginationData.limit,
      offset: args.paginationData.offset,
    });

    const pageSafes = queuePage.results
      .filter((tx) => knownSafeKeys.has(this.makeSafeKey(tx.chainId, tx.safe)))
      .map((tx) => ({ chainId: tx.chainId, address: tx.safe }));
    const safesByKey = await this.loadSafes(pageSafes);

    const results: Array<TransactionQueuedItem> = [];
    for (const upstreamTx of queuePage.results) {
      const safe = safesByKey.get(
        this.makeSafeKey(upstreamTx.chainId, upstreamTx.safe),
      );
      if (!safe) {
        continue;
      }
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
      results.push(new TransactionQueuedItem(transaction, ConflictType.None));
    }

    const itemsCount =
      queuePage.count ?? results.length + args.paginationData.offset;
    const nextURL = buildNextPageURL(args.routeUrl, itemsCount);
    const previousURL = buildPreviousPageURL(args.routeUrl);

    return {
      count: queuePage.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results,
    };
  }

  private async loadSafes(
    pageSafes: Array<{ chainId: string; address: Address }>,
  ): Promise<Map<string, Safe>> {
    const uniqueByKey = new Map<
      string,
      { chainId: string; address: Address }
    >();
    for (const { chainId, address } of pageSafes) {
      uniqueByKey.set(this.makeSafeKey(chainId, address), { chainId, address });
    }
    const entries = await Promise.all(
      Array.from(uniqueByKey.values()).map(async ({ chainId, address }) => {
        const safe = await this.safeRepository.getSafe({ chainId, address });
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
