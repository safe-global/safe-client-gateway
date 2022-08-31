import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { IConfigurationService } from '../../common/config/configuration.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { Page } from '../../common/entities/page.entity';
import { Chain } from '../../chains/entities';
import isValidChain from '../../chains/entities/schemas/chain.schema';
import { DefinedError } from 'ajv';
import { ValidationErrorFactory } from '../errors/validation-error-factory';

@Injectable()
export class ConfigApi {
  private readonly baseUri: string;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly validationErrorFactory: ValidationErrorFactory,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('safeConfig.baseUri');
  }

  async getChains(): Promise<Page<Chain>> {
    const key = 'chains'; // TODO key is not final
    const url = `${this.baseUri}/api/v1/chains`;
    const page: Page<Chain> = await this.dataSource.get(key, url);
    const chains = page.results;

    if (!chains.every((chain) => isValidChain(chain))) {
      // TODO: probably we want to invalidate cache at this point
      const errors = isValidChain.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return page;
  }

  async getChain(chainId: string): Promise<Chain> {
    const key = `chains-${chainId}`; // TODO key is not final
    const url = `${this.baseUri}/api/v1/chains/${chainId}`;
    const chain: Chain = await this.dataSource.get(key, url);

    if (!isValidChain(chain)) {
      // TODO: probably we want to invalidate cache at this point
      const errors = isValidChain.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return chain;
  }
}
