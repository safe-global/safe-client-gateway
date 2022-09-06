import { IChainsRepository } from './chains.repository.interface';
import { Chain } from './entities/chain.entity';
import { Page } from '../entities/page.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigApi } from '../interfaces/config-api.interface';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  constructor(@Inject(IConfigApi) private readonly configApi: IConfigApi) {}

  async getChain(chainId: string): Promise<Chain> {
    return this.configApi.getChain(chainId);
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    return this.configApi.getChains(limit, offset);
  }
}
