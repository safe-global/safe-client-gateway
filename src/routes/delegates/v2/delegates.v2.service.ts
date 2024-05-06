import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { Page } from '@/domain/entities/page.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { GetDelegateDto } from '@/routes/delegates/entities/get-delegate.dto.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DelegatesV2Service {
  constructor(
    @Inject(IDelegatesV2Repository)
    private readonly repository: IDelegatesV2Repository,
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
}
