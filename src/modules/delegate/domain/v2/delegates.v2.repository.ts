// SPDX-License-Identifier: FSL-1.1-MIT
import { IOffchain } from '@/modules/offchain/offchain.interface';
import { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { Page } from '@/domain/entities/page.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { OffchainDelegatePageSchema } from '@/modules/offchain/entities/delegate.entity';
import { mapOffchainToDelegate } from '@/modules/offchain/mappers/delegate.mapper';
import { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';

@Injectable()
export class DelegatesV2Repository implements IDelegatesV2Repository {
  constructor(
    @Inject(IOffchain)
    private readonly offchainService: IOffchain,
  ) {}

  async getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>> {
    const page = await this.offchainService.getDelegates({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      label: args.label,
      limit: args.limit,
      offset: args.offset,
    });
    const parsed = OffchainDelegatePageSchema.parse(page);
    return {
      ...parsed,
      results: parsed.results.map(mapOffchainToDelegate),
    };
  }

  async clearDelegates(args: {
    chainId: string;
    safeAddress?: Address;
  }): Promise<void> {
    await this.offchainService.clearDelegates(args);
  }

  async postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void> {
    await this.offchainService.postDelegate({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      delegate: args.delegate,
      delegator: args.delegator,
      signature: args.signature,
      label: args.label,
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown> {
    return this.offchainService.deleteDelegate({
      chainId: args.chainId,
      delegate: args.delegate,
      delegator: args.delegator,
      safeAddress: args.safeAddress,
      signature: args.signature,
    });
  }
}
