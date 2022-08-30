import { Balance } from './entities/balance.entity';
import { Backbone } from '../../chains/entities';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import isValidBackbone from '../../chains/entities/schemas/backbone.schema';
import { Logger } from '@nestjs/common';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { DefinedError } from 'ajv';

export class TransactionApi {
  private readonly logger = new Logger(TransactionApi.name);

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    private readonly validationErrorFactory: ValidationErrorFactory,
  ) {}

  async getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    // TODO key is not final
    const cacheKey = `balances-${this.chainId}-${safeAddress}-${trusted}-${excludeSpam}`;
    const url = `${this.baseUrl}/api/v1/safes/${safeAddress}/balances/usd/`;
    return await this.dataSource.get<Balance[]>(cacheKey, url, {
      params: {
        trusted: trusted,
        excludeSpam: excludeSpam,
      },
    });
  }

  async getBackbone(): Promise<Backbone> {
    // TODO key is not final
    const cacheKey = `backbone-${this.chainId}`;
    const url = `${this.baseUrl}/api/v1/about`;
    const backbone = await this.dataSource.get(cacheKey, url);

    if (!isValidBackbone(backbone)) {
      const errors = isValidBackbone.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return backbone;
  }
}
