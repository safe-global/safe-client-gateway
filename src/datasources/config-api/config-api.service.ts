import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '../../common/config/configuration.service.interface';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { Page } from '../../common/entities/page.entity';
import { Chain } from '../../chains/entities';
import { DefinedError, ValidateFunction } from 'ajv';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import {
  chainSchema,
  nativeCurrencySchema,
} from './entities/schemas/chain.schema';

@Injectable()
export class ConfigApi {
  private readonly baseUri: string;
  private readonly isValidChain: ValidateFunction<Chain>;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('safeConfig.baseUri');
    this.jsonSchemaService.addSchema(nativeCurrencySchema, 'nativeCurrency');
    this.isValidChain = this.jsonSchemaService.compile(
      chainSchema,
    ) as ValidateFunction<Chain>;
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const key = `chains-limit=${limit}-offset=${offset}`; // TODO key is not final
    const url = `${this.baseUri}/api/v1/chains`;
    const page: Page<Chain> = await this.dataSource.get(key, url, {
      params: {
        limit,
        offset,
      },
    });

    if (!page?.results.every((chain) => this.isValidChain(chain))) {
      // TODO: probably we want to invalidate cache at this point
      const errors = this.isValidChain.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return page;
  }

  async getChain(chainId: string): Promise<Chain> {
    const key = `chains-${chainId}`; // TODO key is not final
    const url = `${this.baseUri}/api/v1/chains/${chainId}`;
    const data = await this.dataSource.get(key, url);

    if (!this.isValidChain(data)) {
      // TODO: probably we want to invalidate cache at this point
      const errors = this.isValidChain.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return data;
  }
}
