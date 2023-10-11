import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ChainsValidator } from '@/domain/chains/chains.validator';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { MasterCopy } from '@/domain/chains/entities/master-copies.entity';
import { MasterCopyValidator } from '@/domain/chains/master-copy.validator';
import { Page } from '@/domain/entities/page.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  constructor(
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly chainValidator: ChainsValidator,
    private readonly masterCopyValidator: MasterCopyValidator,
  ) {}

  async getChain(chainId: string): Promise<Chain> {
    const chain = await this.configApi.getChain(chainId);
    return this.chainValidator.validate(chain);
  }

  async clearChain(chainId: string): Promise<void> {
    return this.configApi.clearChain(chainId);
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const page = await this.configApi.getChains({ limit, offset });
    page?.results.map((result) => this.chainValidator.validate(result));
    return page;
  }

  async getMasterCopies(chainId: string): Promise<MasterCopy[]> {
    const transactionApi =
      await this.transactionApiManager.getTransactionApi(chainId);
    const masterCopies = await transactionApi.getMasterCopies();
    return masterCopies.map((masterCopy) =>
      this.masterCopyValidator.validate(masterCopy),
    );
  }
}
