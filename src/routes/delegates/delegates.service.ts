import { Inject, Injectable } from '@nestjs/common';
import { IDelegateRepository } from '../../domain/delegate/delegate.repository.interface';
import { Delegate } from './entities/delegate.entity';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';

@Injectable()
export class DelegatesService {
  constructor(
    @Inject(IDelegateRepository)
    private readonly repository: IDelegateRepository,
  ) {}

  async getDelegates(
    chainId: string,
    routeUrl: Readonly<URL>,
    safe?: string,
    delegate?: string,
    delegator?: string,
    label?: string,
    paginationData?: PaginationData,
  ): Promise<Page<Delegate>> {
    const delegates = await this.repository.getDelegates(
      chainId,
      safe,
      delegate,
      delegator,
      label,
      paginationData?.limit,
      paginationData?.offset,
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, delegates.next);
    const previousURL = cursorUrlFromLimitAndOffset(
      routeUrl,
      delegates.previous,
    );

    return <Page<Delegate>>{
      count: delegates.count,
      next: nextURL?.toString(),
      previous: previousURL?.toString(),
      results: delegates.results,
    };
  }
}
