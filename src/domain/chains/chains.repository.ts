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
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { MasterCopy } from './entities/master-copies.entity';
import { masterCopySchema } from './entities/schemas/master-copy.schema';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  private readonly isValidChain: ValidateFunction<Chain>;
  private readonly isValidMasterCopy: ValidateFunction<MasterCopy>;

  constructor(
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
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
    this.isValidMasterCopy = this.jsonSchemaService.compile(
      masterCopySchema,
    ) as ValidateFunction<MasterCopy>;
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

  async getMasterCopies(chainId: string): Promise<MasterCopy[]> {
    const transactionApi = await this.transactionApiManager.getTransactionApi(
      chainId,
    );
    const masterCopies = await transactionApi.getMasterCopies();

    if (
      !masterCopies.every((masterCopy) => this.isValidMasterCopy(masterCopy))
    ) {
      const errors = this.isValidMasterCopy.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return masterCopies;
  }
}
