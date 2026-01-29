import { Inject, Injectable } from '@nestjs/common';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { SafeList } from '@/modules/owners/routes/entities/safe-list.entity';
import { SafesByChainId } from '@/modules/safe/domain/entities/safes-by-chain-id.entity';
import type { Address } from 'viem';

@Injectable()
export class OwnersService {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    return this.safeRepository.getSafesByOwner(args);
  }

  async getSafesByOwnerV2(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    return this.safeRepository.getSafesByOwnerV2(args);
  }

  async getAllSafesByOwner(args: {
    ownerAddress: Address;
  }): Promise<SafesByChainId> {
    return this.safeRepository.getAllSafesByOwner(args);
  }

  async getAllSafesByOwnerV2(args: {
    ownerAddress: Address;
  }): Promise<SafesByChainId> {
    return this.safeRepository.getAllSafesByOwnerV2(args);
  }
}
