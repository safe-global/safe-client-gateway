import { Delegate } from '@/domain/delegate/entities/delegate.entity';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { Page } from '@/domain/entities/page.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { CreateDelegateDto } from '@/routes/delegates/entities/create-delegate.dto.entity';
import { GetDelegateDto } from '@/routes/delegates/entities/get-delegate.dto.entity';
import { DeleteDelegateV2Dto } from '@/routes/delegates/v2/entities/delete-delegate.v2.dto.entity';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class DelegatesV2Service {
  constructor(
    @Inject(IDelegatesV2Repository)
    private readonly repository: IDelegatesV2Repository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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
    delegateAddress: `0x${string}`;
    deleteDelegateV2Dto: DeleteDelegateV2Dto;
  }): Promise<unknown> {
    const { deleteDelegateV2Dto } = args;
    let { delegator } = deleteDelegateV2Dto;

    if (!delegator) {
      if (!deleteDelegateV2Dto.safe) {
        // Note: this point shouldn't be reached, schema validation should cover it
        throw Error(
          'Either safe or delegator should be non-null when deleting a delegate',
        );
      }
      delegator = await this._getDelegatorForDelegateAndSafe(
        args.chainId,
        args.delegateAddress,
        deleteDelegateV2Dto.safe,
      );
    }

    return await this.repository.deleteDelegate({
      chainId: args.chainId,
      delegate: args.delegateAddress,
      delegator,
      safeAddress: deleteDelegateV2Dto.safe,
      signature: deleteDelegateV2Dto.signature,
    });
  }

  private async _getDelegatorForDelegateAndSafe(
    chainId: string,
    delegate: `0x${string}`,
    safeAddress: `0x${string}`,
  ): Promise<`0x${string}`> {
    const response = await this.repository.getDelegates({
      chainId,
      delegate,
      safeAddress,
    });

    if (!response.results.length) {
      this.loggingService.warn(
        `Delegator for delegate ${delegate} and Safe ${safeAddress} not found`,
      );
      throw new NotFoundException();
    }

    return response.results[0].delegator;
  }
}
