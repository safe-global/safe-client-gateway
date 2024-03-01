import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { Singleton } from '@/domain/chains/entities/singleton.entity';
import { SingletonValidator } from '@/domain/chains/singleton.validator';
import { Page } from '@/domain/entities/page.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  constructor(
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly singletonValidator: SingletonValidator,
  ) {}

  async getChain(chainId: string): Promise<Chain> {
    const chain = await this.configApi.getChain(chainId);
    return ChainSchema.parse(chain);
  }

  async clearChain(chainId: string): Promise<void> {
    return this.configApi.clearChain(chainId);
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const page = await this.configApi.getChains({ limit, offset });
    page.results.map((result) => ChainSchema.parse(result));
    return page;
  }

  async getSingletons(chainId: string): Promise<Singleton[]> {
    const transactionApi =
      await this.transactionApiManager.getTransactionApi(chainId);
    const singletons = await transactionApi.getSingletons();
    return singletons.map((singleton) =>
      this.singletonValidator.validate(singleton),
    );
  }
}
