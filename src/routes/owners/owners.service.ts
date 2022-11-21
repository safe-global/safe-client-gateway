import { Inject, Injectable } from '@nestjs/common';
import { SafeList } from '../../domain/safe/entities/safe-list.entity';
import { SafeRepository } from '../../domain/safe/safe.repository';
import { ISafeRepository } from '../../domain/safe/safe.repository.interface';

@Injectable()
export class OwnersService {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
  ) {}

  async getSafesByOwner(
    chainId: string,
    ownerAddress: string,
  ): Promise<SafeList> {
    return this.safeRepository.getSafesByOwner(chainId, ownerAddress);
  }
}
