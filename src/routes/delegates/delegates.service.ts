import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { IDelegateRepository } from '../../domain/delegate/delegate.repository.interface';
import { Delegate } from './entities/delegate.entity';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import {
  DelegateParamsDto,
  isDelegateParamsDto,
} from './entities/delegate-params.entity';

@Injectable()
export class DelegatesService {
  constructor(
    @Inject(IDelegateRepository)
    private readonly repository: IDelegateRepository,
  ) {}

  async getDelegates(
    chainId: string,
    routeUrl: Readonly<URL>,
    delegateParams: DelegateParamsDto,
    paginationData?: PaginationData,
  ): Promise<Page<Delegate>> {
    if (!isDelegateParamsDto(delegateParams)) {
      throw new HttpException(
        'At least one query param must be provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    const delegates = await this.repository.getDelegates(
      chainId,
      delegateParams.safe,
      delegateParams.delegate,
      delegateParams.delegator,
      delegateParams.label,
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
