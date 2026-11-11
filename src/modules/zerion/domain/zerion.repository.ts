// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ZerionChainMappingService } from '#/modules/zerion/datasources/zerion-chain-mapping.service';
import { ZerionRateLimiter } from '#/modules/zerion/datasources/zerion-rate-limiter.service';
import type { IZerionRepository } from '#/modules/zerion/domain/zerion.repository.interface';

@Injectable()
export class ZerionRepository implements IZerionRepository {
  constructor(
    private readonly zerionChainMappingService: ZerionChainMappingService,
    private readonly zerionRateLimiter: ZerionRateLimiter,
  ) {}

  async getChainIdToNetworkMapping(
    isTestnet: boolean,
  ): Promise<Record<string, string>> {
    return await this.zerionChainMappingService.getChainIdToNetworkMapping(
      isTestnet,
    );
  }

  async assertWithinBudget(args: {
    datasource: string;
    address?: Address;
  }): Promise<void> {
    await this.zerionRateLimiter.assertWithinBudget(args);
  }
}
