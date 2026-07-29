// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Address } from 'viem';
import type { Page } from '@/domain/entities/page.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type { CreateDelegateDto } from '@/modules/delegate/routes/entities/create-delegate.dto.entity';
import type { GetDelegateDto } from '@/modules/delegate/routes/entities/get-delegate.dto.entity';
import type { DeleteDelegateV3Dto } from '@/modules/delegate/routes/v3/entities/delete-delegate.v3.dto.entity';
import type { UpdateDelegateV3Dto } from '@/modules/delegate/routes/v3/entities/update-delegate.v3.dto.entity';
import {
  cursorUrlFromLimitAndOffset,
  type PaginationData,
} from '@/routes/common/pagination/pagination.data';

@Injectable()
export class DelegatesV3Service {
  constructor(
    @Inject(IDelegatesV3Repository)
    private readonly repository: IDelegatesV3Repository,
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
    const { safe, delegate, delegator, signature, label } =
      args.createDelegateDto;
    await this.repository.postDelegate({
      chainId: args.chainId,
      safeAddress: safe,
      delegate,
      delegator,
      signature,
      label,
    });
  }

  async updateDelegate(args: {
    chainId: string;
    updateDelegateV3Dto: UpdateDelegateV3Dto;
  }): Promise<void> {
    const { safe, delegate, delegator, signature, label } =
      args.updateDelegateV3Dto;
    await this.repository.updateDelegate({
      chainId: args.chainId,
      safeAddress: safe,
      delegate,
      delegator,
      signature,
      label,
    });
  }

  async deleteDelegate(args: {
    chainId: string;
    delegateAddress: Address;
    deleteDelegateV3Dto: DeleteDelegateV3Dto;
  }): Promise<void> {
    const { safe, signature } = args.deleteDelegateV3Dto;
    let { delegator } = args.deleteDelegateV3Dto;

    if (!delegator) {
      if (!safe) {
        // Note: this point shouldn't be reached, schema validation should cover it
        throw Error(
          'Either safe or delegator should be non-null when deleting a delegate',
        );
      }
      delegator = await this._getDelegatorForDelegateAndSafe(
        args.chainId,
        args.delegateAddress,
        safe,
      );
    }

    await this.repository.deleteDelegate({
      chainId: args.chainId,
      delegate: args.delegateAddress,
      delegator,
      safeAddress: safe,
      signature,
    });
  }

  private async _getDelegatorForDelegateAndSafe(
    chainId: string,
    delegate: Address,
    safeAddress: Address,
  ): Promise<Address> {
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
