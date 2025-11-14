import { Inject, Injectable } from '@nestjs/common';
import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { SafeList } from '@/modules/owners/routes/entities/safe-list.entity';
import type { Address } from 'viem';

@Injectable()
export class OwnersService {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
  ) {}

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList> {
    return this.safeRepository.getSafesByOwner(args);
  }

  // TODO: Remove with /owners/:ownerAddress/safes
  // @deprecated
  async deprecated__getAllSafesByOwner(args: {
    ownerAddress: Address;
  }): Promise<{ [chainId: string]: Array<string> }> {
    return this.safeRepository.deprecated__getAllSafesByOwner(args);
  }

  async getAllSafesByOwner(args: {
    ownerAddress: Address;
  }): Promise<{ [chainId: string]: Array<string> | null }> {
    return this.safeRepository.getAllSafesByOwner(args);
  }
}
