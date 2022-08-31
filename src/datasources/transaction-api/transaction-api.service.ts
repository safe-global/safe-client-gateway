import { Balance } from './entities/balance.entity';
import { Backbone } from '../../chains/entities';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import isValidBackbone from '../../chains/entities/schemas/backbone.schema';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { DefinedError } from 'ajv';
import isValidBalance from '../../balances/entities/schemas/balance.schema';

export class TransactionApi {
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
    const balances: [] = await this.dataSource.get(cacheKey, url, {
      params: {
        trusted: trusted,
        excludeSpam: excludeSpam,
      },
    });

    if (!balances.every((balance) => isValidBalance(balance))) {
      // TODO: probably we want to invalidate cache at this point
      const errors = isValidBalance.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return balances;
  }

  async getBackbone(): Promise<Backbone> {
    // TODO key is not final
    const cacheKey = `backbone-${this.chainId}`;
    const url = `${this.baseUrl}/api/v1/about`;
    const backbone = await this.dataSource.get(cacheKey, url);

    if (!isValidBackbone(backbone)) {
      // TODO: probably we want to invalidate cache at this point
      const errors = isValidBackbone.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return backbone;
  }
}
