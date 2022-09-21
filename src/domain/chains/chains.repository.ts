import { IChainsRepository } from './chains.repository.interface';
import { Chain } from './entities/chain.entity';
import { Page } from '../entities/page.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigApi } from '../interfaces/config-api.interface';
import { DefinedError, ValidateFunction } from 'ajv';
import {
  blockExplorerUriTemplateSchema,
  chainSchema,
  gasPriceSchema,
  nativeCurrencySchema,
  rpcUriSchema,
  themeSchema,
} from './entities/schemas/chain.schema';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  private readonly isValidChain: ValidateFunction<Chain>;

  constructor(
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(
      nativeCurrencySchema,
      'nativeCurrencySchema',
    );
    this.jsonSchemaService.addSchema(rpcUriSchema, 'rpcUriSchema');
    this.jsonSchemaService.addSchema(
      blockExplorerUriTemplateSchema,
      'blockExplorerUriTemplateSchema',
    );
    this.jsonSchemaService.addSchema(themeSchema, 'themeSchema');
    this.jsonSchemaService.addSchema(gasPriceSchema, 'gasPriceSchema');
    this.isValidChain = this.jsonSchemaService.compile(
      chainSchema,
    ) as ValidateFunction<Chain>;
  }

  async getChain(chainId: string): Promise<Chain> {
    const chain = await this.configApi.getChain(chainId);

    if (!this.isValidChain(chain)) {
      const errors = this.isValidChain.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return chain;
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const page = await this.configApi.getChains(limit, offset);

    if (!page?.results.every((chain) => this.isValidChain(chain))) {
      const errors = this.isValidChain.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return page;
  }
}
