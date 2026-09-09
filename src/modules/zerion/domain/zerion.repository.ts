// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import type { IZerionRepository } from '@/modules/zerion/domain/zerion.repository.interface';

@Injectable()
export class ZerionRepository implements IZerionRepository {
  constructor(
    private readonly zerionChainMappingService: ZerionChainMappingService,
  ) {}

  async getNetworksByChainId(
    isTestnet: boolean,
  ): Promise<Record<string, string>> {
    return await this.zerionChainMappingService.getChainIdToNetworkMapping(
      isTestnet,
    );
  }
}
