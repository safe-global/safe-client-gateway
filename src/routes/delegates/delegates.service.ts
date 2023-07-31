import { Inject, Injectable } from '@nestjs/common';
import { IDelegateRepository } from '../../domain/delegate/delegate.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { CreateDelegateDto } from './entities/create-delegate.dto.entity';
import { Delegate } from './entities/delegate.entity';
import { DeleteDelegateDto } from './entities/delete-delegate.dto.entity';
import { DeleteSafeDelegateDto } from './entities/delete-safe-delegate.dto.entity';
import { GetDelegateDto } from './entities/get-delegate.dto.entity';

@Injectable()
export class DelegatesService {
  constructor(
    @Inject(IDelegateRepository)
    private readonly repository: IDelegateRepository,
  ) {}

  async getDelegates(
    chainId: string,
    routeUrl: Readonly<URL>,
    getDelegateDto: GetDelegateDto,
    paginationData: PaginationData,
  ): Promise<Page<Delegate>> {
    const delegates = await this.repository.getDelegates({
      chainId,
      safeAddress: getDelegateDto.safe,
      delegate: getDelegateDto.delegate,
      delegator: getDelegateDto.delegator,
      label: getDelegateDto.label,
      limit: paginationData.limit,
      offset: paginationData.offset,
    });

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, delegates.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      delegates.previous,
    );

    return <Page<Delegate>>{
      count: delegates.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: delegates.results,
    };
  }

  async postDelegate(
    chainId: string,
    createDelegateDto: CreateDelegateDto,
  ): Promise<void> {
    await this.repository.postDelegate({
      chainId,
      safeAddress: createDelegateDto.safe,
      delegate: createDelegateDto.delegate,
      delegator: createDelegateDto.delegator,
      signature: createDelegateDto.signature,
      label: createDelegateDto.label,
    });
  }

  async deleteDelegate(
    chainId: string,
    delegateAddress: string,
    deleteDelegateDto: DeleteDelegateDto,
  ): Promise<unknown> {
    return await this.repository.deleteDelegate({
      chainId,
      delegate: delegateAddress,
      delegator: deleteDelegateDto.delegator,
      signature: deleteDelegateDto.signature,
    });
  }

  async deleteSafeDelegate(
    chainId: string,
    delegateAddress: string,
    deleteSafeDelegateRequest: DeleteSafeDelegateDto,
  ): Promise<unknown> {
    return await this.repository.deleteSafeDelegate({
      chainId,
      delegate: deleteSafeDelegateRequest.delegate,
      safeAddress: deleteSafeDelegateRequest.safe,
      signature: deleteSafeDelegateRequest.signature,
    });
  }
}
