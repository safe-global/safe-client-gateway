import { IChainsRepository } from './chains.repository.interface';
import { Chain } from './entities/chain.entity';
import { Page } from '../entities/page.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigApi } from '../interfaces/config-api.interface';
import { MasterCopy } from './entities/master-copies.entity';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { ChainsValidator } from './chains.validator';
import { MasterCopyValidator } from './master-copy.validator';

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

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const page = await this.configApi.getChains({ limit, offset });
    page?.results.map((result) => this.chainValidator.validate(result));
    return page;
  }

  async clearChains(): Promise<void> {
    return this.configApi.clearChains();
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
