import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IDelegateRepository } from '@/modules/delegate/domain/delegate.repository.interface';
import type { CreateDelegateDto } from '@/modules/delegate/routes/entities/create-delegate.dto.entity';
import type { Delegate } from '@/modules/delegate/routes/entities/delegate.entity';
import type { DeleteDelegateDto } from '@/modules/delegate/routes/entities/delete-delegate.dto.entity';
import type { DeleteSafeDelegateDto } from '@/modules/delegate/routes/entities/delete-safe-delegate.dto.entity';
import type { GetDelegateDto } from '@/modules/delegate/routes/entities/get-delegate.dto.entity';
import type { Page } from '@/routes/common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  type PaginationData,
} from '@/routes/common/pagination/pagination.data';

@Injectable()
export class DelegatesService {
  constructor(
    @Inject(IDelegateRepository)
    private readonly repository: IDelegateRepository,
  ) {}

  async getDelegates(args: {
    chainId: string;
    routeUrl: Readonly<URL>;
    getDelegateDto: GetDelegateDto;
    paginationData: PaginationData;
  }): Promise<Page<Delegate>> {
    const delegates = await this.repository.getDelegates({
      chainId: args.chainId,
      safeAddress: args.getDelegateDto.safe,
      delegate: args.getDelegateDto.delegate,
      delegator: args.getDelegateDto.delegator,
      label: args.getDelegateDto.label,
      limit: args.paginationData.limit,
      offset: args.paginationData.offset,
    });

    const nextURL = cursorUrlFromLimitAndOffset(args.routeUrl, delegates.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      args.routeUrl,
      delegates.previous,
    );

    return {
      count: delegates.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: delegates.results,
    };
  }

  async postDelegate(args: {
    chainId: string;
    createDelegateDto: CreateDelegateDto;
  }): Promise<void> {
    await this.repository.postDelegate({
      chainId: args.chainId,
      safeAddress: args.createDelegateDto.safe,
      delegate: args.createDelegateDto.delegate,
      delegator: args.createDelegateDto.delegator,
      signature: args.createDelegateDto.signature,
      label: args.createDelegateDto.label,
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegateAddress: Address;
    deleteDelegateDto: DeleteDelegateDto;
  }): Promise<unknown> {
    return await this.repository.deleteDelegate({
      chainId: args.chainId,
      delegate: args.delegateAddress,
      delegator: args.deleteDelegateDto.delegator,
      signature: args.deleteDelegateDto.signature,
    });
  }

  async deleteSafeDelegate(args: {
    chainId: string;
    deleteSafeDelegateRequest: DeleteSafeDelegateDto;
  }): Promise<unknown> {
    return await this.repository.deleteSafeDelegate({
      chainId: args.chainId,
      delegate: args.deleteSafeDelegateRequest.delegate,
      safeAddress: args.deleteSafeDelegateRequest.safe,
      signature: args.deleteSafeDelegateRequest.signature,
    });
  }
}
