import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IDelegateRepository } from '../../domain/delegate/delegate.repository.interface';
import { Page } from '../common/entities/page.entity';
import {
  cursorUrlFromLimitAndOffset,
  PaginationData,
} from '../common/pagination/pagination.data';
import { CreateDelegateDto } from './entities/create-delegate.entity';
import { DelegateParamsDto } from './entities/delegate-params.entity';
import { Delegate } from './entities/delegate.entity';
import { DeleteDelegateDto } from './entities/delete-delegate.entity';
import { DeleteSafeDelegateRequest } from './entities/delete-safe-delegate-request.entity';

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
    paginationData: PaginationData,
  ): Promise<Page<Delegate>> {
    if (
      !(
        delegateParams.safe ||
        delegateParams.delegate ||
        delegateParams.delegator ||
        delegateParams.label
      )
    ) {
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
      paginationData.limit,
      paginationData.offset,
    );

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
  ): Promise<unknown> {
    return await this.repository.postDelegate(
      chainId,
      createDelegateDto.safe,
      createDelegateDto.delegate,
      createDelegateDto.delegator,
      createDelegateDto.signature,
      createDelegateDto.label,
    );
  }

  async deleteDelegate(
    chainId: string,
    delegateAddress: string,
    deleteDelegateDto: DeleteDelegateDto,
  ): Promise<unknown> {
    return await this.repository.deleteDelegate(
      chainId,
      delegateAddress,
      deleteDelegateDto.delegator,
      deleteDelegateDto.signature,
    );
  }

  async deleteSafeDelegate(
    chainId: string,
    delegateAddress: string,
    deleteSafeDelegateRequest: DeleteSafeDelegateRequest,
  ): Promise<unknown> {
    if (delegateAddress !== deleteSafeDelegateRequest.delegate) {
      throw new BadRequestException();
    }

    return await this.repository.deleteSafeDelegate(
      chainId,
      deleteSafeDelegateRequest.delegate,
      deleteSafeDelegateRequest.safe,
      deleteSafeDelegateRequest.signature,
    );
  }
}
