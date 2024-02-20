import { Inject, Injectable } from '@nestjs/common';
import { SafeRepository } from '@/domain/safe/safe.repository';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { SafeList } from '@/routes/owners/entities/safe-list.entity';

@Injectable()
export class OwnersService {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
  ) {}

  async getSafesByOwner(args: {
    chainId: string;
    ownerAddress: string;
  }): Promise<SafeList> {
    return this.safeRepository.getSafesByOwner(args);
  }

  async getAllSafesByOwner(args: {
    ownerAddress: string;
  }): Promise<{ [chainId: string]: Array<string> }> {
    return this.safeRepository.getAllSafesByOwner(args);
  }
}
