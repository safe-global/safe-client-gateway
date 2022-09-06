import { Balance } from './entities/balance.entity';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { DefinedError, ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import {
  balanceSchema,
  balanceTokenSchema,
} from './entities/schemas/balance.schema';
import { backboneSchema } from './entities/schemas/backbone.schema';
import { Backbone } from './entities/backbone.entity';

export class TransactionApi {
  private readonly isValidBalance: ValidateFunction<Balance>;
  private readonly isValidBackbone: ValidateFunction<Backbone>;

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly dataSource: CacheFirstDataSource,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(balanceTokenSchema, 'balanceToken');
    this.isValidBalance = this.jsonSchemaService.compile(
      balanceSchema,
    ) as ValidateFunction<Balance>;
    this.isValidBackbone = this.jsonSchemaService.compile(
      backboneSchema,
    ) as ValidateFunction<Backbone>;
  }

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

    if (!balances.every((balance) => this.isValidBalance(balance))) {
      // TODO: probably we want to invalidate cache at this point
      const errors = this.isValidBalance.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return balances;
  }

  async getBackbone(): Promise<Backbone> {
    // TODO key is not final
    const cacheKey = `backbone-${this.chainId}`;
    const url = `${this.baseUrl}/api/v1/about`;
    const backbone = await this.dataSource.get(cacheKey, url);

    if (!this.isValidBackbone(backbone)) {
      // TODO: probably we want to invalidate cache at this point
      const errors = this.isValidBackbone.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return backbone;
  }
}
